import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  BROWSER_HEADERS,
  corsHeaders,
  jsonResponse,
  getServiceClient,
  getWeekStart,
  proxiedFetch,
  proxyConfigured,
  upsertDeals,
  logFetch,
  type NormalizedDeal,
} from "../_shared/deals.ts";
import {
  type ColesProduct,
  collectProducts,
  extractNextData,
  findAssetsUrl,
  getSearchResults,
  productToDeal,
} from "../_shared/coles.ts";

const PAGE_HEADERS = {
  ...BROWSER_HEADERS,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};
const HALF_PRICE_BASE = "https://www.coles.com.au/on-special?filter_Special=halfprice";
const MIN_COLES_DEALS = Number(Deno.env.get("MIN_COLES_DEALS") || "40");
const MAX_PAGES = Number(Deno.env.get("COLES_MAX_PAGES") || "25");
const PAGE_DELAY_MS = Number(Deno.env.get("COLES_PAGE_DELAY_MS") || "250");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHalfPricePage(
  page: number,
  session?: string,
): Promise<{ html: string; ok: boolean }> {
  const target = `${HALF_PRICE_BASE}&page=${page}`;
  const useProxyOptions = proxyConfigured() ? [false, true] : [false];
  let lastHtml = "";
  for (const useProxy of useProxyOptions) {
    const res = useProxy
      ? await proxiedFetch(target, { headers: PAGE_HEADERS }, session)
      : await fetch(target, { headers: PAGE_HEADERS });
    lastHtml = await res.text();
    if (!res.ok) continue;
    if (extractNextData(lastHtml)) return { html: lastHtml, ok: true };
  }
  return { html: lastHtml, ok: false };
}

function parseProductsFromPage(html: string): {
  products: ColesProduct[];
  assetsUrl: string | null;
  noOfResults: number | null;
} {
  const nextData = extractNextData(html);
  if (!nextData) return { products: [], assetsUrl: null, noOfResults: null };

  const searchResults = getSearchResults(nextData);
  let products = searchResults?.results ?? [];
  if (products.length === 0) {
    products = [];
    collectProducts(nextData, products);
  }

  return {
    products,
    assetsUrl: findAssetsUrl(nextData),
    noOfResults: searchResults?.noOfResults ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getServiceClient();
  const weekStart = getWeekStart();
  const session = proxyConfigured() ? `coles-${Date.now()}` : undefined;

  try {
    const rawProducts: ColesProduct[] = [];
    const seenIds = new Set<string>();
    let assetsUrl = "https://cdn.productimages.coles.com.au/productimages";
    let pagesFetched = 0;
    let reportedTotal: number | null = null;
    let lastHtml = "";

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { html, ok } = await fetchHalfPricePage(page, session);
      lastHtml = html;
      if (!ok) {
        if (page === 1) break;
        // Transient block/rate-limit on later pages: keep what we already fetched.
        break;
      }

      const parsed = parseProductsFromPage(html);
      if (parsed.assetsUrl) assetsUrl = parsed.assetsUrl;
      if (typeof parsed.noOfResults === "number") reportedTotal = parsed.noOfResults;

      if (parsed.products.length === 0) break;

      pagesFetched++;
      for (const product of parsed.products) {
        const id = String(product.id ?? product.productId ?? "");
        if (id) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);
        }
        rawProducts.push(product);
      }

      if (page < MAX_PAGES && PAGE_DELAY_MS > 0) await sleep(PAGE_DELAY_MS);
    }

    if (pagesFetched === 0) {
      const challenged = /Request unsuccessful|Incapsula incident|incident ID/i.test(lastHtml);
      throw new Error(
        challenged || !proxyConfigured()
          ? "Blocked by Coles anti-bot (Incapsula). Set SCRAPER_PROXY_URL to an AU rendering proxy to enable Coles ingestion."
          : "Could not locate __NEXT_DATA__ in Coles response (page shape changed).",
      );
    }

    const deals: NormalizedDeal[] = [];
    for (const product of rawProducts) {
      const deal = productToDeal(product, assetsUrl);
      if (!deal) continue;
      deals.push({
        ...deal,
        store: "coles",
      });
    }

    if (deals.length < MIN_COLES_DEALS) {
      const msg = `Coles fetched too few deals (${deals.length} from ${pagesFetched} pages). Possible block or page-shape change.`;
      await logFetch(supabase, "coles", false, msg, {
        fetched: deals.length,
        inserted: 0,
        updated: 0,
        week_start: weekStart,
        pages_fetched: pagesFetched,
        reported_total: reportedTotal,
        min_expected: MIN_COLES_DEALS,
        errors: [msg],
      });
      return jsonResponse(
        { success: false, store: "coles", fetched: deals.length, inserted: 0, updated: 0, errors: [msg] },
        502,
      );
    }

    const { inserted, updated, errors } = await upsertDeals(supabase, deals, weekStart);
    const message = `Coles: fetched ${deals.length} (${pagesFetched} pages), inserted ${inserted}, updated ${updated}, failed ${errors.length}`;
    await logFetch(supabase, "coles", errors.length === 0, message, {
      fetched: deals.length,
      inserted,
      updated,
      week_start: weekStart,
      pages_fetched: pagesFetched,
      reported_total: reportedTotal,
      min_expected: MIN_COLES_DEALS,
      errors,
    });

    return jsonResponse(
      {
        success: errors.length === 0,
        store: "coles",
        fetched: deals.length,
        inserted,
        updated,
        pages_fetched: pagesFetched,
        errors,
      },
      errors.length === 0 ? 200 : 207,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Coles scraper error";
    await logFetch(supabase, "coles", false, msg, {
      fetched: 0,
      inserted: 0,
      updated: 0,
      week_start: weekStart,
      pages_fetched: 0,
      min_expected: MIN_COLES_DEALS,
      errors: [msg],
    });
    return jsonResponse(
      { success: false, store: "coles", fetched: 0, inserted: 0, updated: 0, errors: [msg] },
      502,
    );
  }
});
