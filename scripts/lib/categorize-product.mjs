// Rule-based product categorization (no AI / no paid APIs).
// Category slugs align with src/lib/categories.ts

export const CATEGORY_RULES = [
  {
    category: "Clothing & Apparel",
    slug: "clothing",
    pattern:
      /pyjama|pajama|sleepwear|nightdress|knit pyjama|satin pyjama|ladies|mens|boys|girls|shirt|dress\b|pants|jeans|sock|underwear|bra\b|hoodie|jacket|footwear|shoe|caprice|spiderman.*pyjama|size\s+[xsml\d]/i,
  },
  { category: "Baby & Kids", slug: "baby-kids", pattern: /huggies|napp|babylove|curash|infant|toddler|kids?\s*snack|wipes/i },
  { category: "Personal Care", slug: "personal-care", pattern: /shampoo|conditioner|toothpaste|toothbrush|oral-?b|colgate|deodorant|razor|gillette|schick|body\s*wash|moisturis/i },
  { category: "Household & Cleaning", slug: "household-cleaning", pattern: /finish|dishwash|cold power|radiant|detergent|laundry|bleach|paper towel|toilet tissue|quilton|icare|kleenex|viva/i },
  { category: "Pet", slug: "pet", pattern: /pedigree|whiskas|dine\s|schmackos|pet food|dog food|cat food/i },
  { category: "Health & Wellness", slug: "health", pattern: /panadol|nurofen|vitamin|supplement|bandage|first aid|medic/i },
  { category: "Pantry & Snacks", slug: "pantry-snacks", pattern: /cadbury|chocolate|kinder|m&m|chips|crackers|shapes|nuts|popcorn|biscuit|cookie|muesli bar|arnotts|smiths|doritos|pringles|peanut butter|vegemite|nutella|pasta|rice|noodle|sauce|soup/i },
  { category: "Drinks", slug: "drinks", pattern: /coffee|nescafe|moccona|tea\b|lipton|pepsi|coca|cola|juice|powerade|gatorade|water\b|soft drink|energy drink/i },
  { category: "Dairy & Eggs", slug: "dairy-eggs", pattern: /\bmilk\b|yoghurt|cheese|butter|\bcream\b|\begg/i },
  { category: "Frozen Food", slug: "frozen", pattern: /frozen meal|frozen veg|frozen pizza|ice cream|mcain|birds eye|frozen pea/i },
  { category: "Meat & Seafood", slug: "meat-seafood", pattern: /chicken|beef|lamb|pork|mince|sausage|bacon|salmon|prawn|seafood/i },
  { category: "Fresh Produce", slug: "fresh-produce", pattern: /apple|banana|potato|onion|tomato|lettuce|carrot|broccoli|avocado|fruit|vegetable|salad/i },
  { category: "Bakery", slug: "bakery", pattern: /bread|muffin|croissant|bagel|\bbun\b/i },
];

export function categorizeProductName(name, dbCategory) {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  if (dbCategory && dbCategory !== "Groceries") return dbCategory;
  return "Groceries";
}
