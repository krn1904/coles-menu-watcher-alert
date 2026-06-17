// Woolworths half-price scrape logic shared by the local script and tests.
import { proxyConfigured, proxiedFetch } from "./proxy.mjs";
import { categorizeProductName } from "./categorize-product.mjs";

export const ORIGIN = "https://www.woolworths.com.au";
export const HALF_PRICE_URL = "/shop/browse/specials/half-price";
export const FALLBACK_CATEGORY_ID = "specialsgroup.3676";
export const PAGE_SIZE = 36;

export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-AU,en;q=0.9",
};

function setCookieToHeader(res) {
  const jar =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  return jar
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

export async function primeCookies(env, session) {
  const res = await proxiedFetch(
    `${ORIGIN}/`,
    { headers: { ...BROWSER_HEADERS, Accept: "text/html" } },
    env,
    session,
  );
  await res.text();
  if (!res.ok) {
    throw new Error(`Woolworths homepage HTTP ${res.status} (blocked without AU proxy?)`);
  }
  return setCookieToHeader(res);
}

export async function resolveCategoryId(cookie, env, session) {
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
      env,
      session,
    );
    if (!res.ok) return FALLBACK_CATEGORY_ID;
    const data = await res.json();
    let found = null;
    const walk = (node) => {
      if (found || !node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (
        node.UrlFriendlyName === "half-price" &&
        typeof node.NodeId === "string" &&
        node.NodeId.startsWith("specialsgroup")
      ) {
        found = node.NodeId;
        return;
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
    return found || FALLBACK_CATEGORY_ID;
  } catch {
    return FALLBACK_CATEGORY_ID;
  }
}

export async function fetchBrowsePage(categoryId, pageNumber, cookie, env, session) {
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
      body: JSON.stringify({
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
      }),
    },
    env,
    session,
  );
  if (!res.ok) {
    throw new Error(`Woolworths browse HTTP ${res.status} (page ${pageNumber})`);
  }
  return res.json();
}

export function discountPct(original, sale) {
  if (!original || original <= sale) return 50;
  return Math.round(((original - sale) / original) * 100);
}

export function normalizeProducts(raw) {
  const seen = new Set();
  const deals = [];
  for (const p of raw) {
    const sale = Number(p.Price || 0);
    const was = Number(p.WasPrice || 0);
    if (!sale || p.IsOnSpecial === false) continue;
    if (!was || was <= sale) continue;
    const name = (p.Name || "").trim();
    if (!name) continue;
    const productId = String(p.Stockcode || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    if (seen.has(productId)) continue;
    seen.add(productId);
    const brand = (p.Brand || "").trim();
    const fullName =
      brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
    deals.push({
      name: fullName,
      category: categorizeProductName(fullName),
      original_price: was,
      sale_price: sale,
      discount_percentage: discountPct(was, sale),
      image_url: p.LargeImageFile || p.MediumImageFile || p.SmallImageFile || "",
      store: "woolworths",
      product_id: productId,
    });
  }
  return deals;
}

export async function scrapeWoolworthsHalfPrice(env, { maxPages = 60, onPage } = {}) {
  if (!proxyConfigured(env)) {
    throw new Error(
      "SCRAPER_PROXY_URL is required for Woolworths (Akamai blocks datacenter IPs). " +
        "Set an AU-geolocated proxy — see .env.example.",
    );
  }

  const session = `wow-${Date.now()}`;
  const cookie = await primeCookies(env, session);
  const categoryId = await resolveCategoryId(cookie, env, session);

  const raw = [];
  let total = Infinity;
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchBrowsePage(categoryId, page, cookie, env, session);
    if (typeof data.TotalRecordCount === "number") total = data.TotalRecordCount;
    const products = (data.Bundles || []).flatMap((b) => b.Products || []);
    if (products.length === 0) break;
    raw.push(...products);
    onPage?.(page, products.length, raw.length, total);
    if (raw.length >= total) break;
  }

  const deals = normalizeProducts(raw);
  if (deals.length === 0) {
    throw new Error("No half-price specials parsed (page shape changed or proxy blocked).");
  }

  return {
    deals,
    categoryId,
    fetched: deals.length,
    reportedTotal: Number.isFinite(total) ? total : null,
    rawCount: raw.length,
    truncated: Number.isFinite(total) && raw.length < total,
  };
}
