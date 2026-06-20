// Coles half-price scrape logic shared by the CI script and local runs.
import { proxyConfigured, proxiedFetch } from "./proxy.mjs";
import { categorizeProductName } from "./categorize-product.mjs";
import { isHalfPriceSpecial, resolveColesPricing } from "./coles-pricing.mjs";

export const HALF_PRICE_BASE = "https://www.coles.com.au/on-special?filter_Special=halfprice";
export const DEFAULT_ASSETS_URL = "https://cdn.productimages.coles.com.au/productimages";

export const PAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-AU,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function getSearchResults(nextData) {
  return nextData?.props?.pageProps?.searchResults ?? null;
}

export function collectProducts(node, out, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  const pricing = node.pricing;
  if (typeof node.name === "string" && pricing && typeof pricing.now === "number") {
    out.push(node);
  }
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach((item) => collectProducts(item, out, seen));
    else if (v && typeof v === "object") collectProducts(v, out, seen);
  }
}

export function findAssetsUrl(node, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return null;
  seen.add(node);
  if (typeof node.assetsUrl === "string" && node.assetsUrl.includes("productimages")) {
    return node.assetsUrl;
  }
  for (const v of Object.values(node)) {
    const found = findAssetsUrl(v, seen);
    if (found) return found;
  }
  return null;
}

export function getProductCategory(product) {
  const online = product.onlineHeirs?.[0];
  if (online?.subCategory) return online.subCategory;
  if (online?.category) return online.category;
  if (online?.aisle) return online.aisle;
  const merch = product.merchandiseHeir;
  if (merch?.subCategory) return merch.subCategory;
  if (merch?.category) return merch.category;
  if (merch?.categoryGroup) return merch.categoryGroup;
  return "Groceries";
}

export { isHalfPriceSpecial } from "./coles-pricing.mjs";

export function productToDeal(product, assetsUrl) {
  if (!isHalfPriceSpecial(product)) return null;

  const pricing = resolveColesPricing(product);
  if (!pricing) return null;
  const { sale, was, discount } = pricing;

  const name = [product.brand, product.name].filter(Boolean).join(" ").trim() || (product.name ?? "").trim();
  if (!name) return null;

  const productId = String(product.id ?? product.productId ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  const img = product.imageUris?.find((i) => i.uri)?.uri || "";
  const imageUrl = !img
    ? ""
    : img.startsWith("http")
      ? img
      : `${assetsUrl}${img.startsWith("/") ? "" : "/"}${img}`;

  return {
    name,
    category: categorizeProductName(name, getProductCategory(product)),
    original_price: was,
    sale_price: sale,
    discount_percentage: discount,
    image_url: imageUrl,
    store: "coles",
    product_id: productId,
  };
}

function parseProductsFromPage(html) {
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

async function fetchHalfPricePage(page, env, session, retries = 3) {
  const target = `${HALF_PRICE_BASE}&page=${page}`;
  let lastHtml = "";
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = proxyConfigured(env)
      ? await proxiedFetch(target, { headers: PAGE_HEADERS }, env, session)
      : await fetch(target, { headers: PAGE_HEADERS });
    lastHtml = await res.text();
    if (res.ok && extractNextData(lastHtml)) return { html: lastHtml, ok: true };
    if (attempt < retries) await sleep(400 * attempt);
  }
  return { html: lastHtml, ok: false };
}

export async function scrapeColesHalfPrice(env, { maxPages = 45, pageDelayMs = 350, onPage } = {}) {
  if (!proxyConfigured(env)) {
    throw new Error(
      "SCRAPER_PROXY_URL is required for Coles (Incapsula blocks datacenter IPs). " +
        "Set an AU-geolocated proxy — see .env.example.",
    );
  }

  const session = `coles-${Date.now()}`;
  const rawProducts = [];
  const seenIds = new Set();
  let assetsUrl = DEFAULT_ASSETS_URL;
  let pagesFetched = 0;
  let pagesFailed = 0;
  let reportedTotal = null;
  let lastHtml = "";
  let consecutiveEmpty = 0;

  for (let page = 1; page <= maxPages; page++) {
    const { html, ok } = await fetchHalfPricePage(page, env, session);
    lastHtml = html;
    if (!ok) {
      pagesFailed++;
      console.warn(`Coles page ${page} failed (${pagesFailed} failures) — continuing`);
      if (page === 1) break;
      if (pagesFailed >= 5) break;
      continue;
    }

    const parsed = parseProductsFromPage(html);
    if (parsed.assetsUrl) assetsUrl = parsed.assetsUrl;
    if (typeof parsed.noOfResults === "number") {
      reportedTotal =
        reportedTotal == null ? parsed.noOfResults : Math.max(reportedTotal, parsed.noOfResults);
    }

    if (parsed.products.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) break;
      continue;
    }
    consecutiveEmpty = 0;

    pagesFetched++;
    let added = 0;
    for (const product of parsed.products) {
      const id = String(product.id ?? product.productId ?? "");
      if (id) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }
      rawProducts.push(product);
      added++;
    }

    onPage?.(page, added, rawProducts.length, reportedTotal);
    // Do not stop when rawProducts >= reportedTotal — Coles noOfResults is unreliable mid-pagination.
    if (page < maxPages && pageDelayMs > 0) await sleep(pageDelayMs);
  }

  if (pagesFetched === 0) {
    const challenged = /Request unsuccessful|Incapsula incident|incident ID/i.test(lastHtml);
    throw new Error(
      challenged
        ? "Blocked by Coles anti-bot (Incapsula). Check SCRAPER_PROXY_URL uses an AU rendering proxy."
        : "Could not locate __NEXT_DATA__ in Coles response (page shape changed).",
    );
  }

  const deals = [];
  for (const product of rawProducts) {
    const deal = productToDeal(product, assetsUrl);
    if (deal) deals.push(deal);
  }

  if (rawProducts.length > 0 && deals.length < rawProducts.length * 0.5) {
    console.warn(
      `Coles: ${rawProducts.length} raw products → ${deals.length} half-price deals (check pricing fields if low).`,
    );
  }

  if (deals.length === 0) {
    throw new Error("No half-price specials parsed (page shape changed or proxy blocked).");
  }

  return {
    deals,
    pagesFetched,
    pagesFailed,
    reportedTotal,
    fetched: deals.length,
    truncated: pagesFailed > 0 || pagesFetched >= maxPages,
  };
}
