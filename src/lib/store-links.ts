export type StoreId = "coles" | "woolworths";

export const STORE_META: Record<
  StoreId,
  { label: string; shortLabel: string; color: string; bgClass: string; textClass: string; borderClass: string }
> = {
  coles: {
    label: "Coles",
    shortLabel: "Coles",
    color: "#e41e26",
    bgClass: "bg-coles-red",
    textClass: "text-coles-red",
    borderClass: "border-coles-red",
  },
  woolworths: {
    label: "Woolworths",
    shortLabel: "Woolies",
    color: "#178841",
    bgClass: "bg-woolies-green",
    textClass: "text-woolies-green",
    borderClass: "border-woolies-green",
  },
};

export function getStoreSearchUrl(store: StoreId, productName: string): string {
  const q = encodeURIComponent(productName.trim());
  if (store === "coles") {
    return `https://www.coles.com.au/search?q=${q}`;
  }
  return `https://www.woolworths.com.au/shop/search/products?searchTerm=${q}`;
}

export function getStoreSpecialsUrl(store: StoreId): string {
  if (store === "coles") {
    return "https://www.coles.com.au/on-special?filter_Special=halfprice";
  }
  return "https://www.woolworths.com.au/shop/browse/specials/half-price";
}
