export type ColesProduct = {
  _type?: string;
  name?: string;
  brand?: string;
  description?: string;
  size?: string;
  pricing?: {
    now?: number;
    was?: number;
    savePercent?: number;
    priceDescription?: string;
    saveStatement?: string;
  };
  imageUris?: Array<{ uri?: string; altText?: string }>;
  id?: string | number;
  productId?: string | number;
  merchandiseHeir?: {
    category?: string;
    subCategory?: string;
    categoryGroup?: string;
  };
  onlineHeirs?: Array<{
    aisle?: string;
    category?: string;
    subCategory?: string;
  }>;
};

export type ColesSearchResults = {
  results?: ColesProduct[];
  noOfResults?: number;
  pageSize?: number;
  start?: number;
};

export function extractNextData(html: string): unknown | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function getBuildId(nextData: unknown): string | null {
  const obj = nextData as Record<string, unknown>;
  return typeof obj.buildId === "string" ? obj.buildId : null;
}

export function getSearchResults(nextData: unknown): ColesSearchResults | null {
  const pageProps = (nextData as { props?: { pageProps?: { searchResults?: ColesSearchResults } } })
    ?.props?.pageProps;
  return pageProps?.searchResults ?? null;
}

// Fallback when searchResults.results is absent (older page shapes).
export function collectProducts(node: unknown, out: ColesProduct[], seen = new Set<unknown>()): void {
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

export function findAssetsUrl(node: unknown, seen = new Set<unknown>()): string | null {
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

export function getProductCategory(product: ColesProduct): string {
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

export function isHalfPriceSpecial(product: ColesProduct): boolean {
  const sale = Number(product.pricing?.now || 0);
  if (!sale) return false;

  const was = Number(product.pricing?.was || 0);
  const desc = (product.pricing?.priceDescription || "").toLowerCase();
  const savePct = Number(product.pricing?.savePercent || 0);

  if (desc.includes("1/2") || desc.includes("half")) return true;
  if (savePct >= 40) return true;
  if (was > sale) return true;

  const comparableWas = Number((product.pricing as Record<string, unknown>)?.comparableWas || 0);
  if (comparableWas > sale) return true;

  return true;
}

function resolveColesPricing(product: ColesProduct): { sale: number; was: number; discount: number } | null {
  const sale = Number(product.pricing?.now || 0);
  if (!sale) return null;

  let was = Number(product.pricing?.was || 0);
  const savePct = Number(product.pricing?.savePercent || 0);

  if (!was) was = Number((product.pricing as Record<string, unknown>)?.comparableWas || 0);
  if (!was && savePct > 0 && savePct < 100) {
    was = Math.round((sale / (1 - savePct / 100)) * 100) / 100;
  }
  if (!was || was <= sale) was = sale * 2;

  let discount = savePct > 0 ? Math.round(savePct) : Math.round(((was - sale) / was) * 100);
  if (!discount || discount < 1) discount = 50;

  return { sale, was, discount };
}

export function productToDeal(
  product: ColesProduct,
  assetsUrl: string,
): {
  name: string;
  category: string;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  image_url: string;
  product_id: string;
} | null {
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
    category: getProductCategory(product),
    original_price: was,
    sale_price: sale,
    discount_percentage: discount,
    image_url: imageUrl,
    product_id: productId,
  };
}
