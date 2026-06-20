import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Scale, LayoutGrid, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import {
  buildComparisonGroups,
  dealMatchesSearch,
  deriveCategory,
  formatWeekStart,
  getCurrentWeekStart,
  getCheaperStore,
  type ComparisonGroup,
} from "@/lib/product-match";
import { ComparisonCard } from "@/components/deals/ComparisonCard";
import { DealCard } from "@/components/deals/DealCard";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type ViewMode = "compare" | "browse";
type StoreFilter = "all" | "coles" | "woolworths";
type SortMode = "savings" | "discount" | "price" | "name";

const BROWSE_PAGE_SIZE = 16;
const COMPARE_PAGE_SIZE = 24;

const SampleDeals: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("compare");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("savings");
  const [searchQuery, setSearchQuery] = useState("");
  const [pairedOnly, setPairedOnly] = useState(true);
  const [activeWeekStart, setActiveWeekStart] = useState(getCurrentWeekStart());

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    const weekStart = getCurrentWeekStart();
    setActiveWeekStart(weekStart);
    const { data, error: fetchError } = await supabase
      .from("deals")
      .select("*")
      .eq("week_start", weekStart)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setDeals([]);
      setError("Could not load deals. Please try again.");
      setLoading(false);
      return;
    }
    setDeals(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  useEffect(() => {
    setPage(1);
  }, [viewMode, storeFilter, categoryFilter, sortMode, searchQuery, pairedOnly]);

  const storeCounts = useMemo(
    () => ({
      coles: deals.filter((d) => d.store === "coles").length,
      woolworths: deals.filter((d) => d.store === "woolworths").length,
    }),
    [deals],
  );

  const comparisonGroups = useMemo(() => {
    const searched = deals.filter((d) => dealMatchesSearch(d, searchQuery));
    const byCategory =
      categoryFilter === "all"
        ? searched
        : searched.filter((d) => deriveCategory(d.name, d.category) === categoryFilter);
    return buildComparisonGroups(byCategory, { pairedOnly });
  }, [deals, searchQuery, categoryFilter, pairedOnly]);

  const comparisonStats = useMemo(() => {
    const paired = comparisonGroups.filter((g) => g.coles && g.woolworths);
    let cheaperColes = 0;
    let cheaperWoolies = 0;
    let samePrice = 0;
    let totalSavings = 0;
    for (const g of paired) {
      const c = getCheaperStore(g.coles, g.woolworths);
      if (!c) continue;
      if (c.store === "coles") {
        cheaperColes++;
        totalSavings += c.savings;
      } else if (c.store === "woolworths") {
        cheaperWoolies++;
        totalSavings += c.savings;
      } else {
        samePrice++;
      }
    }
    return {
      paired: paired.length,
      cheaperColes,
      cheaperWoolies,
      samePrice,
      totalSavings,
      colesOnly: comparisonGroups.filter((g) => g.coles && !g.woolworths).length,
      wooliesOnly: comparisonGroups.filter((g) => g.woolworths && !g.coles).length,
    };
  }, [comparisonGroups]);

  const sortedGroups = useMemo(() => {
    const groups = [...comparisonGroups];
    groups.sort((a, b) => {
      if (sortMode === "savings") {
        const savA = a.savingsAmount ?? (a.coles && a.woolworths ? 0 : -1);
        const savB = b.savingsAmount ?? (b.coles && b.woolworths ? 0 : -1);
        const pairedA = a.coles && a.woolworths ? 1 : 0;
        const pairedB = b.coles && b.woolworths ? 1 : 0;
        if (pairedA !== pairedB) return pairedB - pairedA;
        return savB - savA;
      }
      if (sortMode === "name") return a.canonicalName.localeCompare(b.canonicalName);
      const priceA = Math.min(a.coles?.sale_price ?? Infinity, a.woolworths?.sale_price ?? Infinity);
      const priceB = Math.min(b.coles?.sale_price ?? Infinity, b.woolworths?.sale_price ?? Infinity);
      if (sortMode === "price") return priceA - priceB;
      const discA = Math.max(a.coles?.discount_percentage ?? 0, a.woolworths?.discount_percentage ?? 0);
      const discB = Math.max(b.coles?.discount_percentage ?? 0, b.woolworths?.discount_percentage ?? 0);
      return discB - discA;
    });
    return groups;
  }, [comparisonGroups, sortMode]);

  const browseDeals = useMemo(() => {
    let list = deals.filter((d) => dealMatchesSearch(d, searchQuery));
    if (storeFilter !== "all") list = list.filter((d) => d.store === storeFilter);
    if (categoryFilter !== "all") {
      list = list.filter((d) => deriveCategory(d.name, d.category) === categoryFilter);
    }
    list.sort((a, b) => {
      if (sortMode === "price") return a.sale_price - b.sale_price;
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "discount") {
        return (b.discount_percentage ?? 0) - (a.discount_percentage ?? 0);
      }
      return 0;
    });
    return list;
  }, [deals, searchQuery, storeFilter, categoryFilter, sortMode]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    for (const d of deals) {
      const cat = deriveCategory(d.name, d.category);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [deals]);

  const pageSize = viewMode === "compare" ? COMPARE_PAGE_SIZE : BROWSE_PAGE_SIZE;
  const itemCount = viewMode === "compare" ? sortedGroups.length : browseDeals.length;
  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const paginatedGroups = sortedGroups.slice((page - 1) * pageSize, page * pageSize);
  const paginatedDeals = browseDeals.slice((page - 1) * pageSize, page * pageSize);

  const visibleCategories = CATEGORIES.filter((c) => (categoryCounts.get(c.id) ?? 0) > 0);

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Scale className="h-7 w-7 text-coles-red" />
            Compare half-price specials
          </h2>
          <p className="text-gray-600 mt-2 max-w-2xl">
            See the same product at Coles and Woolworths side by side. We highlight where it is
            cheaper so you know where to shop.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDeals} disabled={loading} className="shrink-0">
          <RefreshCw className={cnIcon(loading)} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Week from" value={formatWeekStart(activeWeekStart)} />
        <StatCard label="Matched pairs" value={String(comparisonStats.paired)} highlight />
        <StatCard label="Cheaper at Coles" value={String(comparisonStats.cheaperColes)} />
        <StatCard label="Cheaper at Woolworths" value={String(comparisonStats.cheaperWoolies)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Coles specials" value={String(storeCounts.coles)} />
        <StatCard label="Woolworths specials" value={String(storeCounts.woolworths)} />
        <StatCard label="Coles-only" value={String(comparisonStats.colesOnly)} />
        <StatCard label="Woolworths-only" value={String(comparisonStats.wooliesOnly)} />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search products — e.g. Cadbury, Huggies, Finish..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip active={viewMode === "compare"} onClick={() => setViewMode("compare")}>
          <Scale className="h-3.5 w-3.5 mr-1 inline" />
          Compare
        </FilterChip>
        <FilterChip active={viewMode === "browse"} onClick={() => setViewMode("browse")}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1 inline" />
          Browse all
        </FilterChip>
        <span className="w-px h-6 bg-gray-200 mx-1 self-center hidden sm:block" />
        {viewMode === "browse" &&
          (["all", "coles", "woolworths"] as const).map((store) => (
            <FilterChip key={store} active={storeFilter === store} onClick={() => setStoreFilter(store)}>
              {store === "all" ? "All stores" : store === "coles" ? "Coles" : "Woolworths"}
            </FilterChip>
          ))}
        {viewMode === "compare" && (
          <FilterChip active={pairedOnly} onClick={() => setPairedOnly((v) => !v)}>
            {pairedOnly ? "Matched pairs only" : "Include store-only"}
          </FilterChip>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
          All categories
        </FilterChip>
        {visibleCategories.map((cat) => (
          <FilterChip
            key={cat.id}
            active={categoryFilter === cat.id}
            onClick={() => setCategoryFilter(cat.id)}
          >
            {cat.emoji} {cat.label} ({categoryCounts.get(cat.id)})
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ["savings", "Biggest savings"],
            ["discount", "Highest discount"],
            ["price", "Lowest price"],
            ["name", "A–Z"],
          ] as const
        ).map(([mode, label]) => (
          <FilterChip key={mode} active={sortMode === mode} onClick={() => setSortMode(mode)} muted>
            {label}
          </FilterChip>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDeals} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : itemCount === 0 ? (
        <EmptyState searchQuery={searchQuery} onRefresh={fetchDeals} />
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, itemCount)} of {itemCount}
            {viewMode === "compare" ? " comparisons" : " deals"}
          </p>

          {viewMode === "compare" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {paginatedGroups.map((group: ComparisonGroup) => (
                <ComparisonCard key={group.key} group={group} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {paginatedDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
};

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-green-200 bg-green-50/50" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-lg">{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  children,
  active,
  onClick,
  muted,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm transition border ${
        active
          ? muted
            ? "bg-gray-800 text-white border-gray-800"
            : "bg-coles-red text-white border-coles-red"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-gray-600 px-2">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

function EmptyState({ searchQuery, onRefresh }: { searchQuery: string; onRefresh: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <p className="text-gray-600 mb-2">
        {searchQuery
          ? `No deals match "${searchQuery}" for this week.`
          : "No half-price deals for this week yet."}
      </p>
      <p className="text-sm text-gray-400 mb-6">
        Specials refresh each Wednesday. Check back after the next scrape.
      </p>
      <Button variant="outline" onClick={onRefresh}>
        Refresh deals
      </Button>
    </div>
  );
}

function cnIcon(loading: boolean) {
  return `h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`;
}

export default SampleDeals;
