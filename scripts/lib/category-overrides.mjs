// Category slug ↔ label map (mirrors src/lib/categories.ts).

export const CATEGORY_SLUG_TO_LABEL = {
  clothing: "Clothing & Apparel",
  "pantry-snacks": "Pantry & Snacks",
  drinks: "Drinks",
  "dairy-eggs": "Dairy & Eggs",
  frozen: "Frozen Food",
  "meat-seafood": "Meat & Seafood",
  "fresh-produce": "Fresh Produce",
  bakery: "Bakery",
  "baby-kids": "Baby & Kids",
  "personal-care": "Personal Care",
  "household-cleaning": "Household & Cleaning",
  pet: "Pet",
  health: "Health & Wellness",
  other: "Other",
};

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function loadProductCategoryOverrides(supabase, store) {
  const { data, error } = await supabase
    .from("product_category_overrides")
    .select("product_id, display_category")
    .eq("store", store);

  if (error) {
    console.warn(`Could not load category overrides for ${store}:`, error.message);
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.product_id, row.display_category]));
}

export function applyCategoryOverride(deal, overrideMap) {
  const slug = overrideMap.get(deal.product_id);
  if (!slug) return deal;
  const label = CATEGORY_SLUG_TO_LABEL[slug];
  if (!label) return deal;
  return { ...deal, category: label };
}

export function applyCategoryOverrides(deals, overrideMap) {
  if (!overrideMap.size) return deals;
  return deals.map((deal) => applyCategoryOverride(deal, overrideMap));
}
