import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_BY_ID, type CategoryId } from "@/lib/categories";
import {
  type ComparisonGroup,
  type DealWithOverride,
  formatPrice,
  getDealCategory,
} from "@/lib/product-match";
import { getStoreSearchUrl, STORE_META } from "@/lib/store-links";
import { CategoryPicker } from "./CategoryPicker";
import { cn } from "@/lib/utils";

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect fill='%23f3f4f6' width='120' height='120'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='11'%3ENo image%3C/text%3E%3C/svg%3E";

function StorePriceCell({
  store,
  deal,
  isWinner,
  compact,
}: {
  store: "coles" | "woolworths";
  deal?: DealWithOverride;
  isWinner: boolean;
  compact?: boolean;
}) {
  const meta = STORE_META[store];
  const label = store === "coles" ? "C" : "W";

  if (!deal) {
    return (
      <div className="flex-1 rounded-md border border-dashed border-gray-200 bg-gray-50 px-2 py-2 text-center min-w-0">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
            meta.bgClass,
          )}
        >
          {label}
        </span>
        <p className="text-[10px] text-gray-400 mt-1">N/A</p>
      </div>
    );
  }

  return (
    <a
      href={getStoreSearchUrl(store, deal.name)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex-1 rounded-md border px-2 py-2 min-w-0 transition-colors hover:opacity-90 group/cell",
        isWinner
          ? `${meta.borderClass} bg-green-50 ring-1 ring-green-200`
          : "border-gray-200 bg-white hover:border-gray-300",
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
            meta.bgClass,
          )}
        >
          {label}
        </span>
        {isWinner && (
          <span className="text-[9px] font-semibold text-green-700 uppercase tracking-wide">Best</span>
        )}
        <ExternalLink className="h-3 w-3 text-gray-300 group-hover/cell:text-gray-500 shrink-0 ml-auto" />
      </div>
      <p className={cn("font-bold leading-none", compact ? "text-sm" : "text-base", meta.textClass)}>
        {formatPrice(deal.sale_price)}
      </p>
      <p className="text-[10px] line-through text-gray-400">{formatPrice(deal.original_price)}</p>
    </a>
  );
}

type Props = {
  group: ComparisonGroup;
  compact?: boolean;
  onCategoryChange: (dealId: string, categoryId: CategoryId | null) => void;
};

export function ComparisonCard({ group, compact = true, onCategoryChange }: Props) {
  const primaryDeal = group.coles ?? group.woolworths;
  const category = primaryDeal ? getDealCategory(primaryDeal) : group.category;
  const cat = CATEGORY_BY_ID[category];
  const hasBoth = Boolean(group.coles && group.woolworths);
  const winner = group.cheaperStore;
  const heroDeal = group.coles ?? group.woolworths;
  const heroImage = heroDeal?.image_url || PLACEHOLDER_IMG;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center p-2 border-b">
        <img
          src={heroImage}
          alt={group.canonicalName}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
        />
        {hasBoth && group.savingsAmount != null && group.savingsAmount > 0 && winner && winner !== "tie" && (
          <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold bg-green-600 text-white px-1.5 py-0.5 rounded-full shadow-sm">
            Save {formatPrice(group.savingsAmount)}
          </span>
        )}
        {hasBoth && winner === "tie" && (
          <span className="absolute top-1.5 right-1.5 text-[10px] font-medium bg-gray-700 text-white px-1.5 py-0.5 rounded-full">
            Same price
          </span>
        )}
      </div>

      <CardContent className="p-3 flex flex-col flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-gray-500">{cat.emoji} {cat.label}</span>
          {group.confidence === "high" && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Match</Badge>
          )}
          {!hasBoth && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
              {group.coles ? "Coles only" : "Woolies only"}
            </Badge>
          )}
        </div>

        <h3 className="font-medium text-sm line-clamp-2 leading-snug min-h-[2.5rem]">
          {group.canonicalName}
        </h3>

        {primaryDeal && (
          <CategoryPicker deal={primaryDeal} onCategoryChange={onCategoryChange} compact />
        )}

        <div className="flex gap-1.5 mt-auto">
          <StorePriceCell
            store="coles"
            deal={group.coles}
            isWinner={winner === "coles"}
            compact={compact}
          />
          <StorePriceCell
            store="woolworths"
            deal={group.woolworths}
            isWinner={winner === "woolworths"}
            compact={compact}
          />
        </div>

        {hasBoth && winner && winner !== "tie" && group.savingsAmount != null && group.savingsAmount > 0 && (
          <p className="text-[10px] text-center text-green-700 font-medium">
            Cheaper at {STORE_META[winner].label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
