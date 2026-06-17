export type CategoryId =
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
  { id: "pantry-snacks", label: "Pantry & Snacks", emoji: "🍿" },
  { id: "drinks", label: "Drinks", emoji: "🥤" },
  { id: "dairy-eggs", label: "Dairy & Eggs", emoji: "🥛" },
  { id: "frozen", label: "Frozen", emoji: "🧊" },
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

export const CATEGORY_RULES: CategoryRule[] = [
  { category: "baby-kids", pattern: /huggies|napp|babylove|curash|infant|toddler|kids?\s*snack|wipes/i },
  { category: "personal-care", pattern: /shampoo|conditioner|toothpaste|toothbrush|oral-?b|colgate|deodorant|razor|gillette|schick|dove\s|palmolive|body\s*wash|moisturis/i },
  { category: "household-cleaning", pattern: /finish|dishwash|cold power|radiant|detergent|laundry|bleach|toilet\s*clean|surface\s*clean|glad\s|wrap|foil|paper towel|toilet tissue|quilton|icare|kleenex|viva/i },
  { category: "pet", pattern: /pedigree|whiskas|dine\s|schmackos|pet\s|dog\s|cat\s/i },
  { category: "health", pattern: /panadol|nurofen|vitamin|supplement|bandage|first aid|medic/i },
  { category: "pantry-snacks", pattern: /cadbury|chocolate|kinder|m&m|maltesers|kit kat|lindt|chips|crackers|shapes|nuts|popcorn|biscuit|cookie|muesli bar|arnotts|smiths|doritos|pringles|peanut butter|vegemite|nutella|pasta|rice|noodle|sauce|soup|can\b|tin\b/i },
  { category: "drinks", pattern: /coffee|nescafe|moccona|tea\b|lipton|pepsi|coca|cola|juice|powerade|gatorade|water\b|soft drink|energy drink|milk drink/i },
  { category: "dairy-eggs", pattern: /milk\b|yoghurt|cheese|butter|cream\b|egg/i },
  { category: "frozen", pattern: /frozen|ice cream|pizza\b|mcain|birds eye/i },
  { category: "meat-seafood", pattern: /chicken|beef|lamb|pork|mince|sausage|bacon|ham\b|salmon|prawn|fish\b|seafood/i },
  { category: "fresh-produce", pattern: /apple|banana|potato|onion|tomato|lettuce|carrot|broccoli|avocado|fruit|vegetable|salad/i },
  { category: "bakery", pattern: /bread|roll|muffin|croissant|bagel|wrap\b|bun\b/i },
];

export function getCategoryLabel(id: CategoryId): string {
  return CATEGORY_BY_ID[id]?.label ?? "Other";
}
