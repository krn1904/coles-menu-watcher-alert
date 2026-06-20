export type CategoryId =
  | "clothing"
  | "pantry-snacks"
  | "drinks"
  | "dairy-eggs"
  | "frozen"
  | "meat-seafood"
  | "fresh-produce"
  | "bakery"
  | "baby-kids"
  | "personal-care"
  | "household-cleaning"
  | "pet"
  | "health"
  | "other";

export type CategoryMeta = {
  id: CategoryId;
  label: string;
  emoji: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { id: "clothing", label: "Clothing & Apparel", emoji: "👕" },
  { id: "pantry-snacks", label: "Pantry & Snacks", emoji: "🍿" },
  { id: "drinks", label: "Drinks", emoji: "🥤" },
  { id: "dairy-eggs", label: "Dairy & Eggs", emoji: "🥛" },
  { id: "frozen", label: "Frozen Food", emoji: "🧊" },
  { id: "meat-seafood", label: "Meat & Seafood", emoji: "🥩" },
  { id: "fresh-produce", label: "Fresh Produce", emoji: "🥬" },
  { id: "bakery", label: "Bakery", emoji: "🍞" },
  { id: "baby-kids", label: "Baby & Kids", emoji: "👶" },
  { id: "personal-care", label: "Personal Care", emoji: "🧴" },
  { id: "household-cleaning", label: "Household & Cleaning", emoji: "🧹" },
  { id: "pet", label: "Pet", emoji: "🐾" },
  { id: "health", label: "Health & Wellness", emoji: "💊" },
  { id: "other", label: "Other", emoji: "🛒" },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryMeta>;

export type CategoryRule = { category: CategoryId; pattern: RegExp };

/** Order matters — first match wins. Clothing before frozen (Disney "Frozen" pyjamas). */
export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "clothing",
    pattern:
      /pyjama|pajama|sleepwear|nightdress|nightie|robe|dressing gown|knit pyjama|satin pyjama|ladies|mens|men s|women s|boys|girls|shirt|t shirt|tee\b|dress\b|pants\b|jeans|shorts|sock|underwear|briefs|boxers|bra\b|lingerie|hoodie|jacket|coat|footwear|shoe|sandal|boot|caprice|spiderman.*pyjama|disney.*pyjama|size\s+[xsml\d]/i,
  },
  { category: "baby-kids", pattern: /huggies|napp|babylove|curash|infant formula|toddler|kids?\s*snack|baby wipe|wipes\b/i },
  { category: "personal-care", pattern: /shampoo|conditioner|toothpaste|toothbrush|oral-?b|colgate|deodorant|razor|gillette|schick|dove\s|palmolive|body\s*wash|moisturis/i },
  { category: "household-cleaning", pattern: /finish|dishwash|cold power|radiant|detergent|laundry|bleach|toilet\s*clean|surface\s*clean|glad\s|wrap|foil|paper towel|toilet tissue|quilton|icare|kleenex|viva/i },
  { category: "pet", pattern: /pedigree|whiskas|dine\s|schmackos|pet food|dog food|cat food/i },
  { category: "health", pattern: /panadol|nurofen|vitamin|supplement|bandage|first aid|medic/i },
  { category: "pantry-snacks", pattern: /cadbury|chocolate|kinder|m&m|maltesers|kit kat|lindt|chips|crackers|shapes|nuts|popcorn|biscuit|cookie|muesli bar|arnotts|smiths|doritos|pringles|peanut butter|vegemite|nutella|pasta|rice|noodle|sauce|soup|can\b|tin\b/i },
  { category: "drinks", pattern: /coffee|nescafe|moccona|tea\b|lipton|pepsi|coca|cola|juice|powerade|gatorade|water\b|soft drink|energy drink|milk drink/i },
  { category: "dairy-eggs", pattern: /\bmilk\b|yoghurt|cheese|butter|\bcream\b|\begg/i },
  {
    category: "frozen",
    pattern: /frozen meal|frozen veg|frozen vegetable|frozen fruit|frozen pizza|frozen chips|frozen pie|ice cream|mcain|birds eye|frozen pea/i,
  },
  { category: "meat-seafood", pattern: /chicken|beef|lamb|pork|mince|sausage|bacon|\bham\b|salmon|prawn|\bfish\b|seafood/i },
  { category: "fresh-produce", pattern: /apple|banana|potato|onion|tomato|lettuce|carrot|broccoli|avocado|fruit|vegetable|salad/i },
  { category: "bakery", pattern: /bread|bread roll|muffin|croissant|bagel|\bbun\b/i },
];

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORY_IDS.has(value as CategoryId);
}

export function getCategoryLabel(id: CategoryId): string {
  return CATEGORY_BY_ID[id]?.label ?? "Other";
}
