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

const ORIGIN = "https://www.woolworths.com.au";
const HALF_PRICE_URL = "/shop/browse/specials/half-price";
// Fallback category id if dynamic discovery fails. Woolworths may rotate this.
const FALLBACK_CATEGORY_ID = "specialsgroup.3676";
const PAGE_SIZE = 36; // Woolworths' browse API caps page size at 36.
const MAX_PAGES = Number(Deno.env.get("WOW_MAX_PAGES") || "15");

type WoolworthsProduct = {
  Name?: string;
  Brand?: string;
  WasPrice?: number;
  Price?: number;
  IsOnSpecial?: boolean;
  IsHalfPrice?: boolean;
  LargeImageFile?: string;
  MediumImageFile?: string;
  SmallImageFile?: string;
  Stockcode?: string | number;
};

type BrowseResponse = {
  Bundles?: Array<{ Products?: WoolworthsProduct[] }>;
  TotalRecordCount?: number;
};

// Woolworths' APIs reject requests without a primed session cookie. Hit the
// homepage first to collect cookies, then reuse them on the API calls. When a
// proxy is configured we use a sticky session so the cookie jar stays valid.
async function primeCookies(session?: string): Promise<string> {
  try {
    const res = await proxiedFetch(
      `${ORIGIN}/`,
      { headers: { ...BROWSER_HEADERS, Accept: "text/html" } },
      session,
    );
    // Drain the body so the connection is reused cleanly.
    await res.text();
    const raw = res.headers.get("set-cookie") || "";
    return raw
      .split(/,(?=[^;]+?=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  } catch (_e) {
    return "";
  }
}

// Resolve the current "Half Price" specials category id. Woolworths exposes the
// full specials tree at PiesCategoriesWithSpecials; we find the node whose URL
// is "half-price". Falls back to a known id if discovery fails.
async function resolveHalfPriceCategoryId(cookie: string, session?: string): Promise<string> {
  try {
    const res = await proxiedFetch(
      `${ORIGIN}/apis/ui/PiesCategoriesWithSpecials`,
      {
        headers: {
          ...BROWSER_HEADERS,
          Accept: "application/json, text/plain, */*",
          Referer: `${ORIGIN}/shop/browse/specials`,
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      session,
    );
    if (!res.ok) return FALLBACK_CATEGORY_ID;
    const data = await res.json();
    let found = FALLBACK_CATEGORY_ID;
    const walk = (node: unknown): void => {
      if (found !== FALLBACK_CATEGORY_ID || !node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const obj = node as Record<string, unknown>;
      if (
        obj.UrlFriendlyName === "half-price" &&
        typeof obj.NodeId === "string" &&
        obj.NodeId.startsWith("specialsgroup")
      ) {
        found = obj.NodeId;
        return;
      }
      Object.values(obj).forEach(walk);
    };
    walk(data);
    return found;
  } catch (_e) {
    return FALLBACK_CATEGORY_ID;
  }
}

async function fetchBrowsePage(
  categoryId: string,
  pageNumber: number,
  cookie: string,
  session?: string,
): Promise<BrowseResponse> {
  const body = {
    categoryId,
    pageNumber,
    pageSize: PAGE_SIZE,
    sortType: "TraderRelevance",
    url: HALF_PRICE_URL,
    location: HALF_PRICE_URL,
    formatObject: '{"name":"Half Price"}',
    isSpecial: true,
    isBundle: false,
    isMobile: false,
    filters: [],
    token: "",
  };
  const res = await proxiedFetch(
    `${ORIGIN}/apis/ui/browse/category`,
    {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Referer: `${ORIGIN}${HALF_PRICE_URL}`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    },
    session,
  );
  if (!res.ok) throw new Error(`Woolworths browse HTTP ${res.status} (page ${pageNumber})`);
  return await res.json() as BrowseResponse;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getServiceClient();
  const weekStart = getWeekStart();
  // Sticky session id only matters when routing through a proxy.
  const session = proxyConfigured() ? `wow-${Date.now()}` : undefined;

  try {
    const cookie = await primeCookies(session);
    const categoryId = await resolveHalfPriceCategoryId(cookie, session);

    const raw: WoolworthsProduct[] = [];
    let total = Infinity;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await fetchBrowsePage(categoryId, page, cookie, session);
      if (typeof data.TotalRecordCount === "number") total = data.TotalRecordCount;
      const pageProducts = (data.Bundles || []).flatMap((b) => b.Products || []);
      if (pageProducts.length === 0) break;
      raw.push(...pageProducts);
      if (raw.length >= total) break;
    }

    const deals: NormalizedDeal[] = [];
    const seen = new Set<string>();
    for (const p of raw) {
      const sale = Number(p.Price || 0);
      const was = Number(p.WasPrice || 0);
      if (!sale || p.IsOnSpecial === false) continue;
      if (!was || was <= sale) continue;

      const name = (p.Name || "").trim();
      if (!name) continue;
      const productId = String(
        p.Stockcode || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      );
      if (seen.has(productId)) continue;
      seen.add(productId);

      const brand = (p.Brand || "").trim();
      const fullName = brand && !name.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brand} ${name}`
        : name;
      deals.push({
        name: fullName,
        category: "Groceries",
        original_price: was,
        sale_price: sale,
        discount_percentage: discountPct(was, sale),
        image_url: p.LargeImageFile || p.MediumImageFile || p.SmallImageFile || "",
        store: "woolworths",
        product_id: productId,
      });
    }

    if (deals.length === 0) {
      const msg = proxyConfigured()
        ? "Woolworths returned no half-price specials (check proxy/cookies)."
        : "Woolworths returned no half-price specials. The datacenter IP is likely blocked — set SCRAPER_PROXY_URL to an AU proxy.";
      await logFetch(supabase, "woolworths", false, msg, { fetched: 0, inserted: 0, updated: 0, errors: [msg] });
      return jsonResponse(
        { success: false, store: "woolworths", fetched: 0, inserted: 0, updated: 0, errors: [msg] },
        502,
      );
    }

    const { inserted, updated, errors } = await upsertDeals(supabase, deals, weekStart);
    const message = `Woolworths: fetched ${deals.length}, inserted ${inserted}, updated ${updated}, failed ${errors.length}`;
    await logFetch(supabase, "woolworths", errors.length === 0, message, {
      fetched: deals.length,
      inserted,
      updated,
      errors,
    });

    return jsonResponse(
      { success: errors.length === 0, store: "woolworths", fetched: deals.length, inserted, updated, errors },
      errors.length === 0 ? 200 : 207,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Woolworths scraper error";
    await logFetch(supabase, "woolworths", false, msg, { fetched: 0, inserted: 0, updated: 0, errors: [msg] });
    return jsonResponse(
      { success: false, store: "woolworths", fetched: 0, inserted: 0, updated: 0, errors: [msg] },
      500,
    );
  }
});
