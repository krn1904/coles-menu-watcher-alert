import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
const PAGE_SIZE = 15;
const COMPARISON_PAGE_SIZE = 10;
type StoreFilter = "all" | "coles" | "woolworths";
type SortMode = "latest" | "discount" | "price";
type ComparisonGroup = {
  key: string;
  canonicalName: string;
  confidence: "high" | "medium";
  coles?: Deal;
  woolworths?: Deal;
};

const formatPrice = (price: number) => `$${price.toFixed(2)}`;
const formatWeekStart = (weekStart: string | null) => {
  if (!weekStart) return "N/A";
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
};

const getCurrentWeekStart = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (utc.getUTCDay() - 3 + 7) % 7; // Wednesday anchor
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().split("T")[0];
};

const dealTimestamp = (deal: Deal) => Date.parse(deal.created_at || "") || 0;
const discountValue = (deal: Deal) => deal.discount_percentage ?? 0;
const maybeDiscountValue = (deal?: Deal) => (deal ? discountValue(deal) : 0);

const MULTI_WORD_BRANDS = [
  "head shoulders",
  "oral b",
  "red rock",
  "natural confectionery",
  "m m",
];
const TOKEN_STOPWORDS = new Set([
  "the", "and", "with", "for", "from", "of", "in", "to", "a", "an",
  "pack", "pk", "size", "new", "classic", "original", "ultimate", "gift",
  "share", "block", "bar", "box", "tube", "bottle", "drink", "liquid",
  "soft", "fresh", "care",
]);

const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "chocolate", pattern: /cadbury|chocolate|kinder|m&m|maltesers|kit kat|lindt/i },
  { category: "nappies", pattern: /huggies|napp|babylove|curash/i },
  { category: "shampoo", pattern: /shampoo|conditioner|head\s*&?\s*shoulders|pantene/i },
  { category: "oral care", pattern: /toothpaste|toothbrush|oral-?b|colgate/i },
  { category: "chips snacks", pattern: /chips|crackers|shapes|nuts|popcorn/i },
  { category: "coffee tea", pattern: /coffee|nescafe|moccona|tea/i },
  { category: "cleaning", pattern: /finish|dishwash|cold power|radiant|detergent|laundry/i },
  { category: "paper", pattern: /paper towel|toilet tissue|quilton|icare|kleenex/i },
  { category: "dairy", pattern: /milk|yoghurt|cheese|butter|cream/i },
  { category: "drinks", pattern: /pepsi|coca|cola|juice|powerade|gatorade/i },
];

const DealCard: React.FC<{ deal: Deal }> = ({ deal }) => (
  <Card className="overflow-hidden transition-all hover:shadow-md relative">
    <span className="deal-badge">{deal.discount_percentage}% OFF</span>
    <div className="aspect-square bg-gray-100 flex items-center justify-center">
      <img
        src={deal.image_url || ""}
        alt={deal.name}
        className="object-contain"
      />
    </div>
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{deal.category}</span>
        {deal.store && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-coles-red">
            {deal.store}
          </span>
        )}
      </div>
      <h3 className="font-medium line-clamp-2">{deal.name}</h3>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs line-through text-gray-400">
            {formatPrice(deal.original_price)}
          </span>
          <span className="text-lg font-bold text-coles-red">
            {formatPrice(deal.sale_price)}
          </span>
        </div>
        <span className="price-tag">HALF PRICE</span>
      </div>
    </CardContent>
  </Card>
);

const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/ultramen/g, "ultra men")
    .replace(/m&m/g, "m m")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getSignificantTokens = (name: string): string[] => {
  return normalizeName(name)
    .replace(/\b\d+(\.\d+)?\s?(g|kg|ml|l|pack|pk|x|ct)\b/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !TOKEN_STOPWORDS.has(t));
};

const deriveCategory = (name: string): string => {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return "other";
};

const getBrandKey = (name: string): string => {
  const normalized = normalizeName(name);
  for (const brand of MULTI_WORD_BRANDS) {
    if (normalized.startsWith(brand)) return brand;
  }
  const tokens = getSignificantTokens(name);
  return tokens[0] || "";
};

const jaccardScore = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const token of setA) if (setB.has(token)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? inter / union : 0;
};

const sharedTokenCount = (a: string[], b: string[]): number => {
  const setB = new Set(b);
  return new Set(a.filter((t) => setB.has(t))).size;
};

const getComparisonKey = (name: string): string => {
  return getSignificantTokens(name)
    .slice(0, 5)
    .join(" ");
};

const SampleDeals: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [pairedOnly, setPairedOnly] = useState(true);
  const [activeWeekStart, setActiveWeekStart] = useState(getCurrentWeekStart());

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      const weekStart = getCurrentWeekStart();
      setActiveWeekStart(weekStart);
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("week_start", weekStart)
        .order("created_at", { ascending: false });
      if (error) {
        setDeals([]);
        setLoading(false);
        return;
      }
      if (data) setDeals(data);
      setLoading(false);
    };
    fetchDeals();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [storeFilter, sortMode, comparisonMode, pairedOnly]);

  const filteredDeals = useMemo(() => {
    const byStore = storeFilter === "all"
      ? deals
      : deals.filter((d) => d.store === storeFilter);
    const sorted = [...byStore];
    sorted.sort((a, b) => {
      if (sortMode === "discount") return discountValue(b) - discountValue(a);
      if (sortMode === "price") return a.sale_price - b.sale_price;
      return dealTimestamp(b) - dealTimestamp(a);
    });
    return sorted;
  }, [deals, sortMode, storeFilter]);

  const comparisonGroups = useMemo(() => {
    const colesDeals = filteredDeals.filter((d) => d.store === "coles");
    const wooliesDeals = filteredDeals.filter((d) => d.store === "woolworths");
    const groups: ComparisonGroup[] = [];
    const usedWoolies = new Set<string>();

    for (const colesDeal of colesDeals) {
      const colesTokens = getSignificantTokens(colesDeal.name);
      const colesCategory = deriveCategory(colesDeal.name);
      const colesBrand = getBrandKey(colesDeal.name);

      let best: Deal | undefined;
      let bestScore = 0;
      let bestShared = 0;

      for (const wooliesDeal of wooliesDeals) {
        if (usedWoolies.has(wooliesDeal.id)) continue;
        const wooliesCategory = deriveCategory(wooliesDeal.name);
        const wooliesBrand = getBrandKey(wooliesDeal.name);
        if (colesCategory !== wooliesCategory || colesBrand !== wooliesBrand) continue;

        const wooliesTokens = getSignificantTokens(wooliesDeal.name);
        const score = jaccardScore(colesTokens, wooliesTokens);
        const shared = sharedTokenCount(colesTokens, wooliesTokens);

        if (shared < 2) continue;
        if (score > bestScore || (score === bestScore && shared > bestShared)) {
          best = wooliesDeal;
          bestScore = score;
          bestShared = shared;
        }
      }

      if (!best || bestScore < 0.35) {
        if (!pairedOnly) {
          groups.push({
            key: `${colesDeal.id}-solo`,
            canonicalName: colesDeal.name,
            confidence: "medium",
            coles: colesDeal,
          });
        }
        continue;
      }

      usedWoolies.add(best.id);
      groups.push({
        key: getComparisonKey(colesDeal.name) || `${colesDeal.id}-${best.id}`,
        canonicalName: colesDeal.name,
        confidence: bestScore >= 0.5 ? "high" : "medium",
        coles: colesDeal,
        woolworths: best,
      });
    }

    if (!pairedOnly) {
      for (const wooliesDeal of wooliesDeals) {
        if (usedWoolies.has(wooliesDeal.id)) continue;
        groups.push({
          key: `${wooliesDeal.id}-solo`,
          canonicalName: wooliesDeal.name,
          confidence: "medium",
          woolworths: wooliesDeal,
        });
      }
    }

    return groups.sort((a, b) => {
      const pairedA = a.coles && a.woolworths ? 1 : 0;
      const pairedB = b.coles && b.woolworths ? 1 : 0;
      if (pairedA !== pairedB) return pairedB - pairedA;
      const bestA = Math.max(maybeDiscountValue(a.coles), maybeDiscountValue(a.woolworths));
      const bestB = Math.max(maybeDiscountValue(b.coles), maybeDiscountValue(b.woolworths));
      return bestB - bestA;
    });
  }, [filteredDeals, pairedOnly]);

  const totalPages = useMemo(() => {
    if (comparisonMode) return Math.max(1, Math.ceil(comparisonGroups.length / COMPARISON_PAGE_SIZE));
    return Math.max(1, Math.ceil(filteredDeals.length / PAGE_SIZE));
  }, [comparisonMode, comparisonGroups.length, filteredDeals.length]);

  const paginatedDeals = useMemo(
    () => filteredDeals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDeals, page]
  );
  const paginatedGroups = useMemo(
    () => comparisonGroups.slice((page - 1) * COMPARISON_PAGE_SIZE, page * COMPARISON_PAGE_SIZE),
    [comparisonGroups, page]
  );

  const storeCounts = useMemo(() => ({
    coles: deals.filter((d) => d.store === "coles").length,
    woolworths: deals.filter((d) => d.store === "woolworths").length,
  }), [deals]);

  const getPageNumbers = (): (number | string)[] => {
    const range: (number | string)[] = [];
    const delta = 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      const left = Math.max(2, page - delta);
      const right = Math.min(totalPages - 1, page + delta);

      range.push(1);
      if (left > 2) range.push("...");

      for (let i = left; i <= right; i++) range.push(i);

      if (right < totalPages - 1) range.push("...");
      range.push(totalPages);
    }

    return range;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Half-Price Deals</h2>
      <p className="text-gray-600 mb-8">
        Here are the current week half-price deals from Coles and Woolworths:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Active week</p><p className="font-semibold">{formatWeekStart(activeWeekStart)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total active deals</p><p className="font-semibold">{deals.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Coles</p><p className="font-semibold">{storeCounts.coles}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Woolworths</p><p className="font-semibold">{storeCounts.woolworths}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "coles", "woolworths"] as const).map((store) => (
          <button
            key={store}
            onClick={() => setStoreFilter(store)}
            className={`px-3 py-1 rounded text-sm transition ${
              storeFilter === store ? "bg-coles-red text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {store === "all" ? "All stores" : store[0].toUpperCase() + store.slice(1)}
          </button>
        ))}
        {(["latest", "discount", "price"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`px-3 py-1 rounded text-sm transition ${
              sortMode === mode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Sort: {mode}
          </button>
        ))}
        <button
          onClick={() => setComparisonMode((v) => !v)}
          className={`px-3 py-1 rounded text-sm transition ${
            comparisonMode ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {comparisonMode ? "Comparison mode: on" : "Comparison mode: off"}
        </button>
        {comparisonMode && (
          <button
            onClick={() => setPairedOnly((v) => !v)}
            className={`px-3 py-1 rounded text-sm transition ${
              pairedOnly ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {pairedOnly ? "Paired only: on" : "Paired only: off"}
          </button>
        )}
      </div>

      {!loading && filteredDeals.length === 0 && (
        <p className="text-gray-500 mb-8">
          No active-week deals for this filter yet. They will appear after the next scrape.
        </p>
      )}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {comparisonMode ? (
            <div className="space-y-3">
              {paginatedGroups.map((group) => (
                <Card key={group.key}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium">{group.canonicalName}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        group.confidence === "high" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {group.confidence} confidence
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border rounded p-3">
                        <p className="text-xs text-gray-500 mb-1">Coles</p>
                        {group.coles ? (
                          <p className="text-sm">
                            <span className="font-semibold">{formatPrice(group.coles.sale_price)}</span>{" "}
                            <span className="line-through text-gray-400">{formatPrice(group.coles.original_price)}</span>{" "}
                            <span className="text-coles-red font-semibold">{group.coles.discount_percentage}% off</span>
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">Not in current feed</p>
                        )}
                      </div>
                      <div className="border rounded p-3">
                        <p className="text-xs text-gray-500 mb-1">Woolworths</p>
                        {group.woolworths ? (
                          <p className="text-sm">
                            <span className="font-semibold">{formatPrice(group.woolworths.sale_price)}</span>{" "}
                            <span className="line-through text-gray-400">{formatPrice(group.woolworths.original_price)}</span>{" "}
                            <span className="text-coles-red font-semibold">{group.woolworths.discount_percentage}% off</span>
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">Not in current feed</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {paginatedDeals.map(deal => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}

          <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition disabled:opacity-50"
            >
              Previous
            </button>
            {getPageNumbers().map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`px-3 py-1 rounded transition ${
                    page === p
                      ? "bg-coles-red text-white font-bold"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  disabled={page === p}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SampleDeals;