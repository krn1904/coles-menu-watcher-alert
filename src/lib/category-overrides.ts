import type { CategoryId } from "./categories";

export function productOverrideKey(store: string | null, productId: string | null): string | null {
  if (!store || !productId) return null;
  return `${store}:${productId}`;
}

/** Merge saved SKU overrides onto deal rows for the UI. */
export function mergeProductOverrides<T extends { store: string | null; product_id: string | null }>(
  deals: T[],
  overrides: Array<{ store: string; product_id: string; display_category: string }>,
): Array<T & { display_category: CategoryId | null }> {
  const map = new Map(
    overrides.map((o) => [productOverrideKey(o.store, o.product_id), o.display_category as CategoryId]),
  );
  return deals.map((d) => ({
    ...d,
    display_category: map.get(productOverrideKey(d.store, d.product_id) ?? "") ?? null,
  }));
}
