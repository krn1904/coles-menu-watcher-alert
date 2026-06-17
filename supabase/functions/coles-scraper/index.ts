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
  discountPct,
  type NormalizedDeal,
} from "../_shared/deals.ts";

const PAGE_HEADERS = {
  ...BROWSER_HEADERS,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};
const MIN_COLES_DEALS = Number(Deno.env.get("MIN_COLES_DEALS") || "10");

// Recursively walk parsed JSON looking for Coles product objects. Coles product
// nodes look like { _type:'PRODUCT', name, brand, pricing:{ now, was }, ... }.
// Walking defensively keeps the scraper working across minor shape changes.
type ColesProduct = {
  name?: string;
  brand?: string;
  pricing?: { now?: number; was?: number; saveStatement?: string };
  imageUris?: Array<{ uri?: string; altText?: string }>;
  id?: string | number;
  productId?: string | number;
};

function collectProducts(node: unknown, out: ColesProduct[], seen = new Set<unknown>()): void {
  if (!node || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  const obj = node as Record<string, unknown>;
  const pricing = obj.pricing as ColesProduct["pricing"] | undefined;
  if (typeof obj.name === "string" && pricing && typeof pricing.now === "number") {
    out.push(obj as ColesProduct);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach((item) => collectProducts(item, out, seen));
    else if (v && typeof v === "object") collectProducts(v, out, seen);
  }
}

// Find the product-image CDN base ("assetsUrl") anywhere in the parsed page data.
function findAssetsUrl(node: unknown, seen = new Set<unknown>()): string | null {
  if (!node || typeof node !== "object" || seen.has(node)) return null;
  seen.add(node);
  const obj = node as Record<string, unknown>;
  if (typeof obj.assetsUrl === "string" && obj.assetsUrl.includes("productimages")) {
    return obj.assetsUrl;
  }
  for (const v of Object.values(obj)) {
    const found = findAssetsUrl(v, seen);
    if (found) return found;
  }
  return null;
}

function extractNextData(html: string): unknown | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getServiceClient();
  const weekStart = getWeekStart();

  try {
    // Coles "Half Price" specials search page (server-rendered with __NEXT_DATA__).
    // Coles works from the edge IP directly, so we fetch direct first and only
    // fall back to the proxy (if configured) when the direct response looks
    // blocked. This keeps proxy credits for Woolworths, which actually needs them.
    const target = "https://www.coles.com.au/on-special?filter_Special=halfprice";

    let nextData: unknown | null = null;
    let lastHtml = "";
    const useProxyOptions = proxyConfigured() ? [false, true] : [false];
    for (const useProxy of useProxyOptions) {
      const res = useProxy
        ? await proxiedFetch(target, { headers: PAGE_HEADERS })
        : await fetch(target, { headers: PAGE_HEADERS });
      lastHtml = await res.text();
      if (!res.ok) continue;
      // The real page embeds product data in __NEXT_DATA__. Note: a legitimate
      // Coles page also references "_Incapsula_Resource" in a script tag, so the
      // presence of that string is NOT a reliable block signal.
      nextData = extractNextData(lastHtml);
      if (nextData) break;
    }

    if (!nextData) {
      const challenged = /Request unsuccessful|Incapsula incident|incident ID/i.test(lastHtml);
      throw new Error(
        challenged || !proxyConfigured()
          ? "Blocked by Coles anti-bot (Incapsula). Set SCRAPER_PROXY_URL to an AU rendering proxy to enable Coles ingestion."
          : "Could not locate __NEXT_DATA__ in Coles response (page shape changed).",
      );
    }

    const products: ColesProduct[] = [];
    collectProducts(nextData, products);

    // Coles serves product images from a CDN, exposed as "assetsUrl" in the
    // page data (e.g. https://cdn.productimages.coles.com.au/productimages).
    // imageUris hold relative paths like "/1/1251527.jpg".
    const assetsUrl = findAssetsUrl(nextData) || "https://cdn.productimages.coles.com.au/productimages";

    const deals: NormalizedDeal[] = [];
    for (const p of products) {
      const sale = Number(p.pricing?.now || 0);
      const was = Number(p.pricing?.was || 0);
      if (!sale) continue;
      // Keep only genuine half-price-ish specials.
      if (!was || was <= sale) continue;

      const name = [p.brand, p.name].filter(Boolean).join(" ").trim() || (p.name ?? "").trim();
      const productId = String(p.id ?? p.productId ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      const img = p.imageUris?.find((i) => i.uri)?.uri || "";
      const imageUrl = !img
        ? ""
        : img.startsWith("http")
        ? img
        : `${assetsUrl}${img.startsWith("/") ? "" : "/"}${img}`;
      deals.push({
        name,
        category: "Groceries",
        original_price: was,
        sale_price: sale,
        discount_percentage: discountPct(was, sale),
        image_url: imageUrl,
        store: "coles",
        product_id: productId,
      });
    }

    if (deals.length < MIN_COLES_DEALS) {
      const msg = `Coles fetched too few deals (${deals.length}). Possible block or page-shape change.`;
      await logFetch(supabase, "coles", false, msg, {
        fetched: deals.length,
        inserted: 0,
        updated: 0,
        week_start: weekStart,
        min_expected: MIN_COLES_DEALS,
        errors: [msg],
      });
      return jsonResponse(
        { success: false, store: "coles", fetched: deals.length, inserted: 0, updated: 0, errors: [msg] },
        502,
      );
    }

    const { inserted, updated, errors } = await upsertDeals(supabase, deals, weekStart);
    const message = `Coles: fetched ${deals.length}, inserted ${inserted}, updated ${updated}, failed ${errors.length}`;
    await logFetch(supabase, "coles", errors.length === 0, message, {
      fetched: deals.length,
      inserted,
      updated,
      week_start: weekStart,
      min_expected: MIN_COLES_DEALS,
      errors,
    });

    return jsonResponse(
      { success: errors.length === 0, store: "coles", fetched: deals.length, inserted, updated, errors },
      errors.length === 0 ? 200 : 207,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Coles scraper error";
    await logFetch(supabase, "coles", false, msg, {
      fetched: 0,
      inserted: 0,
      updated: 0,
      week_start: weekStart,
      min_expected: MIN_COLES_DEALS,
      errors: [msg],
    });
    return jsonResponse(
      { success: false, store: "coles", fetched: 0, inserted: 0, updated: 0, errors: [msg] },
      502,
    );
  }
});
