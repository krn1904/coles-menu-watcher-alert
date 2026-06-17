import type { Database } from "@/integrations/supabase/types";
import { CATEGORY_RULES, type CategoryId } from "./categories";

export type Deal = Database["public"]["Tables"]["deals"]["Row"];

export type ComparisonConfidence = "high" | "medium";

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

const MULTI_WORD_BRANDS = [
  "head shoulders",
  "oral b",
  "red rock",
  "natural confectionery",
  "m m",
  "arnotts",
  "cadbury",
  "huggies",
  "finish",
  "quilton",
];

const TOKEN_STOPWORDS = new Set([
  "the", "and", "with", "for", "from", "of", "in", "to", "a", "an",
  "pack", "pk", "size", "new", "classic", "original", "ultimate", "gift",
  "share", "block", "bar", "box", "tube", "bottle", "drink", "liquid",
  "soft", "fresh", "care", "each", "per", "value", "family",
]);

const DB_CATEGORY_MAP: Array<{ category: CategoryId; pattern: RegExp }> = [
  { category: "baby-kids", pattern: /baby|napp|infant/i },
  { category: "personal-care", pattern: /health|beauty|personal|hair|skin|oral/i },
  { category: "household-cleaning", pattern: /household|clean|laundry|paper/i },
  { category: "pet", pattern: /pet/i },
  { category: "dairy-eggs", pattern: /dairy|milk|cheese|egg/i },
  { category: "drinks", pattern: /drink|beverage|liquor/i },
  { category: "frozen", pattern: /frozen/i },
  { category: "meat-seafood", pattern: /meat|seafood|deli/i },
  { category: "fresh-produce", pattern: /fruit|vegetable|produce/i },
  { category: "bakery", pattern: /bakery|bread/i },
  { category: "pantry-snacks", pattern: /pantry|grocery|snack|confectionery/i },
];

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
    .replace(/ultramen/g, "ultra men")
    .replace(/m&m/g, "m m")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSignificantTokens(name: string): string[] {
  return normalizeName(name)
    .replace(/\b\d+(\.\d+)?\s?(g|kg|ml|l|pack|pk|x|ct|ea)\b/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !TOKEN_STOPWORDS.has(t));
}

export function deriveCategory(name: string, dbCategory?: string | null): CategoryId {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  if (dbCategory) {
    for (const rule of DB_CATEGORY_MAP) {
      if (rule.pattern.test(dbCategory)) return rule.category;
    }
  }
  return "other";
}

export function getBrandKey(name: string): string {
  const normalized = normalizeName(name);
  for (const brand of MULTI_WORD_BRANDS) {
    if (normalized.startsWith(brand)) return brand;
  }
  const tokens = getSignificantTokens(name);
  return tokens[0] || "";
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
  const m = normalizeName(name).match(/\b(\d+(\.\d+)?)\s?(g|kg|ml|l|pk|pack|ct)\b/);
  return m ? m[0].replace(/\s+/g, "") : null;
}

export function scorePair(a: Deal, b: Deal): { score: number; shared: number; confidence: ComparisonConfidence } {
  const tokensA = getSignificantTokens(a.name);
  const tokensB = getSignificantTokens(b.name);
  const categoryA = deriveCategory(a.name, a.category);
  const categoryB = deriveCategory(b.name, b.category);
  const brandA = getBrandKey(a.name);
  const brandB = getBrandKey(b.name);

  if (categoryA !== categoryB) return { score: 0, shared: 0, confidence: "medium" };
  const shared = sharedTokenCount(tokensA, tokensB);
  if (shared < 2) return { score: 0, shared, confidence: "medium" };

  let score = jaccardScore(tokensA, tokensB);
  const sizeA = extractSizeKey(a.name);
  const sizeB = extractSizeKey(b.name);
  if (sizeA && sizeB) {
    score += sizeA === sizeB ? 0.15 : -0.1;
  }
  if (brandA && brandB && brandA === brandB) score += 0.08;
  else if (brandA && brandB && brandA !== brandB && score < 0.55) score *= 0.5;

  const confidence: ComparisonConfidence = score >= 0.5 ? "high" : "medium";
  return { score: Math.min(score, 1), shared, confidence };
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
  const { pairedOnly = false, minScore = 0.35 } = options;
  const colesDeals = deals.filter((d) => d.store === "coles");
  const wooliesDeals = deals.filter((d) => d.store === "woolworths");

  type Candidate = {
    coles: Deal;
    woolworths: Deal;
    score: number;
    confidence: ComparisonConfidence;
  };

  const candidates: Candidate[] = [];
  for (const coles of colesDeals) {
    for (const woolworths of wooliesDeals) {
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

    const category = deriveCategory(c.coles.name, c.coles.category);
    const cheaper = getCheaperStore(c.coles, c.woolworths);
    groups.push({
      key: `${c.coles.id}-${c.woolworths.id}`,
      canonicalName: c.coles.name.length <= c.woolworths.name.length ? c.coles.name : c.woolworths.name,
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
        category: deriveCategory(coles.name, coles.category),
        confidence: "medium",
        matchScore: 0,
        coles,
      });
    }
    for (const woolworths of wooliesDeals) {
      if (usedWoolies.has(woolworths.id)) continue;
      groups.push({
        key: `${woolworths.id}-solo-woolies`,
        canonicalName: woolworths.name,
        category: deriveCategory(woolworths.name, woolworths.category),
        confidence: "medium",
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
