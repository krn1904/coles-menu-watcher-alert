// Rule-based product categorization (no AI / no paid APIs).
// Shared by Woolworths scraper; mirrored in src/lib/categories.ts for the frontend.

export const CATEGORY_RULES = [
  { category: "Baby & Kids", pattern: /huggies|napp|babylove|curash|infant|toddler|kids?\s*snack|wipes/i },
  { category: "Personal Care", pattern: /shampoo|conditioner|toothpaste|toothbrush|oral-?b|colgate|deodorant|razor|gillette|schick|body\s*wash|moisturis/i },
  { category: "Household & Cleaning", pattern: /finish|dishwash|cold power|radiant|detergent|laundry|bleach|toilet\s*clean|surface\s*clean|glad\s|wrap|foil|paper towel|toilet tissue|quilton|icare|kleenex|viva/i },
  { category: "Pet", pattern: /pedigree|whiskas|dine\s|schmackos|pet\s|dog\s|cat\s/i },
  { category: "Health & Wellness", pattern: /panadol|nurofen|vitamin|supplement|bandage|first aid|medic/i },
  { category: "Pantry & Snacks", pattern: /cadbury|chocolate|kinder|m&m|maltesers|kit kat|lindt|chips|crackers|shapes|nuts|popcorn|biscuit|cookie|muesli bar|arnotts|smiths|doritos|pringles|peanut butter|vegemite|nutella|pasta|rice|noodle|sauce|soup/i },
  { category: "Drinks", pattern: /coffee|nescafe|moccona|tea\b|lipton|pepsi|coca|cola|juice|powerade|gatorade|water\b|soft drink|energy drink/i },
  { category: "Dairy & Eggs", pattern: /milk\b|yoghurt|cheese|butter|cream\b|egg/i },
  { category: "Frozen", pattern: /frozen|ice cream|pizza\b|mcain|birds eye/i },
  { category: "Meat & Seafood", pattern: /chicken|beef|lamb|pork|mince|sausage|bacon|ham\b|salmon|prawn|fish\b|seafood/i },
  { category: "Fresh Produce", pattern: /apple|banana|potato|onion|tomato|lettuce|carrot|broccoli|avocado|fruit|vegetable|salad/i },
  { category: "Bakery", pattern: /bread|roll|muffin|croissant|bagel|wrap\b|bun\b/i },
];

export function categorizeProductName(name, dbCategory) {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  if (dbCategory && dbCategory !== "Groceries") return dbCategory;
  return "Groceries";
}
