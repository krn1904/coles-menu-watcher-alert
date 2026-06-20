import type { Database } from "@/integrations/supabase/types";
import { CATEGORY_RULES, isCategoryId, type CategoryId } from "./categories";
import { getBrandKeyFromNormalized } from "./brands";

export type Deal = Database["public"]["Tables"]["deals"]["Row"];

export type ComparisonConfidence = "high" | "medium" | "low";

export type ComparisonGroup = {
  key: string;
  canonicalName: string;
  category: CategoryId;
  confidence: ComparisonConfidence;
  matchScore: number;
  coles?: Deal;
  woolworths?: Deal;
  cheaperStore?: "coles" | "woolworths" | "tie";
  savingsAmount?: number;
};

const TOKEN_STOPWORDS = new Set([
  "the", "and", "with", "for", "from", "of", "in", "to", "a", "an",
  "pack", "pk", "size", "new", "classic", "original", "ultimate", "gift",
  "share", "block", "bar", "box", "tube", "bottle", "drink", "liquid",
  "soft", "fresh", "care", "each", "per", "value", "family", "australian",
  "australia", "style", "cut", "potato", "flavoured", "flavor", "flavour",
  "range", "selected", "select", "special", "bonus", "extra", "free",
  "multipack", "multi", "single", "serve", "serving", "approx", "approximate",
]);

const DB_CATEGORY_MAP: Array<{ category: CategoryId; pattern: RegExp }> = [
  { category: "clothing", pattern: /clothing|apparel|fashion|sleepwear/i },
  { category: "baby-kids", pattern: /baby|napp|infant/i },
  { category: "personal-care", pattern: /health|beauty|personal|hair|skin|oral/i },
  { category: "household-cleaning", pattern: /household|clean|laundry|paper/i },
  { category: "pet", pattern: /pet/i },
  { category: "dairy-eggs", pattern: /dairy|milk|cheese|egg/i },
  { category: "drinks", pattern: /drink|beverage|liquor/i },
  { category: "frozen", pattern: /frozen food|freezer/i },
  { category: "meat-seafood", pattern: /meat|seafood|deli/i },
  { category: "fresh-produce", pattern: /fruit|vegetable|produce/i },
  { category: "bakery", pattern: /bakery|bread/i },
  // Do NOT map generic "Groceries" → pantry (mislabels clothing etc.)
];

export type DealWithOverride = Deal & { display_category?: string | null };

export function getDealCategory(deal: DealWithOverride): CategoryId {
  if (deal.display_category && isCategoryId(deal.display_category)) {
    return deal.display_category;
  }
  return deriveCategory(deal.name, deal.category);
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getCurrentWeekStart(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (utc.getUTCDay() - 3 + 7) % 7;
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().split("T")[0];
}

export function formatWeekStart(weekStart: string | null): string {
  if (!weekStart) return "N/A";
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/ultramen/g, "ultra men")
    .replace(/m&m/g, "m m")
    .replace(/(\d+)x(\d+)/g, "$1 x $2")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSignificantTokens(name: string): string[] {
  return normalizeName(name)
    .replace(/\b\d+(\.\d+)?\s?(g|kg|ml|l|litre|liter|pack|pk|x|ct|ea|each)\b/g, " ")
    .replace(/\b\d+\s?pack\b/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !TOKEN_STOPWORDS.has(t));
}

export function deriveCategory(name: string, dbCategory?: string | null): CategoryId {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  if (dbCategory) {
    for (const rule of CATEGORY_RULES) {
      if (rule.pattern.test(dbCategory)) return rule.category;
    }
    for (const rule of DB_CATEGORY_MAP) {
      if (rule.pattern.test(dbCategory)) return rule.category;
    }
  }
  return "other";
}

export function getBrandKey(name: string): string {
  const normalized = normalizeName(name);
  const tokens = getSignificantTokens(name);
  return getBrandKeyFromNormalized(normalized, tokens);
}

export function jaccardScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const token of setA) if (setB.has(token)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? inter / union : 0;
}

export function sharedTokenCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return new Set(a.filter((t) => setB.has(t))).size;
}

function extractSizeKey(name: string): string | null {
  const m = normalizeName(name).match(/\b(\d+(\.\d+)?)\s?(g|kg|ml|l|pk|pack|ct|ea)\b/);
  return m ? m[0].replace(/\s+/g, "") : null;
}

function brandsCompatible(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  // smith / smiths after normalization
  if (a.replace(/s$/, "") === b.replace(/s$/, "")) return true;
  return a.includes(b) || b.includes(a);
}

export function scorePair(a: Deal, b: Deal): { score: number; shared: number; confidence: ComparisonConfidence } {
  const tokensA = getSignificantTokens(a.name);
  const tokensB = getSignificantTokens(b.name);
  const categoryA = getDealCategory(a);
  const categoryB = getDealCategory(b);
  const brandA = getBrandKey(a.name);
  const brandB = getBrandKey(b.name);
  const shared = sharedTokenCount(tokensA, tokensB);
  const brandMatch = brandsCompatible(brandA, brandB);

  // Brand + at least one other overlapping token (e.g. flavour / product line)
  const tokensBeyondBrand = shared - (brandMatch && brandA ? 1 : 0);
  const minShared = brandMatch && brandA ? 1 : 2;

  if (shared < minShared && tokensBeyondBrand < 1) {
    return { score: 0, shared, confidence: "low" };
  }

  let score = jaccardScore(tokensA, tokensB);

  // Boost brand-aligned pairs
  if (brandMatch && brandA) score += 0.2;
  else if (brandA && brandB && !brandMatch) score *= 0.4;

  // Soft category penalty instead of hard reject (stores tag categories differently)
  if (categoryA !== categoryB) {
    if (categoryA === "other" || categoryB === "other") score -= 0.05;
    else score -= 0.15;
  } else {
    score += 0.05;
  }

  const sizeA = extractSizeKey(a.name);
  const sizeB = extractSizeKey(b.name);
  if (sizeA && sizeB) {
    score += sizeA === sizeB ? 0.2 : -0.15;
  } else if (sizeA || sizeB) {
    score -= 0.05;
  }

  // Longest shared token run (catches "dairy milk" style phrases)
  const setB = new Set(tokensB);
  let run = 0;
  for (const t of tokensA) if (setB.has(t)) run++;
  if (run >= 3) score += 0.1;

  score = Math.max(0, Math.min(score, 1));

  let confidence: ComparisonConfidence = "low";
  if (score >= 0.55) confidence = "high";
  else if (score >= 0.32) confidence = "medium";

  return { score, shared, confidence };
}

export function getCheaperStore(
  coles?: Deal,
  woolworths?: Deal,
): { store: "coles" | "woolworths" | "tie"; savings: number } | null {
  if (!coles || !woolworths) return null;
  const diff = woolworths.sale_price - coles.sale_price;
  if (Math.abs(diff) < 0.01) return { store: "tie", savings: 0 };
  return diff > 0
    ? { store: "coles", savings: diff }
    : { store: "woolworths", savings: -diff };
}

export function buildComparisonGroups(
  deals: Deal[],
  options: { pairedOnly?: boolean; minScore?: number } = {},
): ComparisonGroup[] {
  const { pairedOnly = false, minScore = 0.28 } = options;
  const colesDeals = deals.filter((d) => d.store === "coles");
  const wooliesDeals = deals.filter((d) => d.store === "woolworths");

  // Index Woolworths by brand bucket for faster + broader matching
  const wooliesByBrand = new Map<string, Deal[]>();
  for (const w of wooliesDeals) {
    const brand = getBrandKey(w.name) || "_unknown";
    const list = wooliesByBrand.get(brand) ?? [];
    list.push(w);
    wooliesByBrand.set(brand, list);
  }

  type Candidate = {
    coles: Deal;
    woolworths: Deal;
    score: number;
    confidence: ComparisonConfidence;
  };

  const candidates: Candidate[] = [];

  for (const coles of colesDeals) {
    const brand = getBrandKey(coles.name);
    const buckets = new Set<Deal>();
    if (brand) {
      for (const w of wooliesByBrand.get(brand) ?? []) buckets.add(w);
      // Fuzzy brand bucket (smith / smiths)
      const stem = brand.replace(/s$/, "");
      for (const [key, list] of wooliesByBrand) {
        if (key.startsWith(stem) || stem.startsWith(key.replace(/s$/, ""))) {
          list.forEach((w) => buckets.add(w));
        }
      }
    }
    // Fallback: compare against all woolies if brand unknown or bucket too small
    const pool = buckets.size >= 3 ? [...buckets] : wooliesDeals;

    for (const woolworths of pool) {
      const { score, confidence } = scorePair(coles, woolworths);
      if (score >= minScore) candidates.push({ coles, woolworths, score, confidence });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const usedColes = new Set<string>();
  const usedWoolies = new Set<string>();
  const groups: ComparisonGroup[] = [];

  for (const c of candidates) {
    if (usedColes.has(c.coles.id) || usedWoolies.has(c.woolworths.id)) continue;
    usedColes.add(c.coles.id);
    usedWoolies.add(c.woolworths.id);

    const category = getDealCategory(c.coles);
    const cheaper = getCheaperStore(c.coles, c.woolworths);
    groups.push({
      key: `${c.coles.id}-${c.woolworths.id}`,
      canonicalName:
        c.coles.name.length <= c.woolworths.name.length ? c.coles.name : c.woolworths.name,
      category,
      confidence: c.confidence,
      matchScore: c.score,
      coles: c.coles,
      woolworths: c.woolworths,
      cheaperStore: cheaper?.store,
      savingsAmount: cheaper?.savings,
    });
  }

  if (!pairedOnly) {
    for (const coles of colesDeals) {
      if (usedColes.has(coles.id)) continue;
      groups.push({
        key: `${coles.id}-solo-coles`,
        canonicalName: coles.name,
        category: getDealCategory(coles),
        confidence: "low",
        matchScore: 0,
        coles,
      });
    }
    for (const woolworths of wooliesDeals) {
      if (usedWoolies.has(woolworths.id)) continue;
      groups.push({
        key: `${woolworths.id}-solo-woolies`,
        canonicalName: woolworths.name,
        category: getDealCategory(woolworths),
        confidence: "low",
        matchScore: 0,
        woolworths,
      });
    }
  }

  return groups;
}

export function dealMatchesSearch(deal: Deal, query: string): boolean {
  if (!query.trim()) return true;
  return normalizeName(deal.name).includes(normalizeName(query));
}

export function discountLabel(pct: number | null): string {
  const n = pct ?? 50;
  if (n >= 48) return "Half price";
  if (n >= 40) return `${n}% off`;
  return `${n}% off`;
}

/** Summary stats for UI diagnostics */
export function getMatchDiagnostics(deals: Deal[]) {
  const coles = deals.filter((d) => d.store === "coles").length;
  const woolies = deals.filter((d) => d.store === "woolworths").length;
  const paired = buildComparisonGroups(deals, { pairedOnly: true });
  const high = paired.filter((g) => g.confidence === "high").length;
  const medium = paired.filter((g) => g.confidence === "medium").length;
  return {
    coles,
    woolies,
    pairedCount: paired.length,
    highConfidence: high,
    mediumConfidence: medium,
    colesMatchedPct: coles > 0 ? Math.round((paired.length / coles) * 100) : 0,
  };
}
