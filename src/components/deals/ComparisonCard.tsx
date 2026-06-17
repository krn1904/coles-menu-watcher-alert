import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_BY_ID } from "@/lib/categories";
import {
  type ComparisonGroup,
  type Deal,
  discountLabel,
  formatPrice,
} from "@/lib/product-match";
import { getStoreSearchUrl, STORE_META } from "@/lib/store-links";
import { StoreBadge } from "./StoreBadge";
import { cn } from "@/lib/utils";

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";

function StorePricePanel({
  store,
  deal,
  isWinner,
}: {
  store: "coles" | "woolworths";
  deal?: Deal;
  isWinner: boolean;
}) {
  const meta = STORE_META[store];
  if (!deal) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 flex flex-col items-center justify-center min-h-[140px] text-center">
        <StoreBadge store={store} />
        <p className="text-sm text-gray-400 mt-3">Not on special this week</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 flex flex-col gap-3 h-full transition-shadow",
        isWinner ? `${meta.borderClass} bg-green-50/60 shadow-sm` : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <StoreBadge store={store} size="md" />
        {isWinner && (
          <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px]">Best price</Badge>
        )}
      </div>
      <div className="aspect-square bg-white rounded-md flex items-center justify-center p-2 border border-gray-100">
        <img
          src={deal.image_url || PLACEHOLDER_IMG}
          alt={deal.name}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">{deal.name}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-xs line-through text-gray-400">{formatPrice(deal.original_price)}</p>
            <p className={cn("text-xl font-bold", meta.textClass)}>{formatPrice(deal.sale_price)}</p>
          </div>
          <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full whitespace-nowrap">
            {discountLabel(deal.discount_percentage)}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-auto"
        asChild
      >
        <a
          href={getStoreSearchUrl(store, deal.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5"
        >
          Shop at {meta.label}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}

type Props = { group: ComparisonGroup };

export function ComparisonCard({ group }: Props) {
  const cat = CATEGORY_BY_ID[group.category];
  const hasBoth = Boolean(group.coles && group.woolworths);
  const winner = group.cheaperStore;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm">{cat.emoji}</span>
              <span className="text-xs text-gray-500">{cat.label}</span>
              {group.confidence === "high" && (
                <Badge variant="secondary" className="text-[10px]">Strong match</Badge>
              )}
              {!hasBoth && (
                <Badge variant="outline" className="text-[10px]">
                  {group.coles ? "Coles only" : "Woolworths only"}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-base md:text-lg leading-snug">{group.canonicalName}</h3>
          </div>
          {hasBoth && group.savingsAmount != null && group.savingsAmount > 0 && winner && winner !== "tie" && (
            <div className="shrink-0 rounded-lg bg-green-100 text-green-900 px-3 py-2 text-sm font-medium text-center sm:text-right">
              Save {formatPrice(group.savingsAmount)}
              <br />
              <span className="text-xs font-normal">buy at {STORE_META[winner].label}</span>
            </div>
          )}
          {hasBoth && winner === "tie" && (
            <div className="shrink-0 rounded-lg bg-gray-100 text-gray-700 px-3 py-2 text-sm font-medium">
              Same price both stores
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StorePricePanel
            store="coles"
            deal={group.coles}
            isWinner={winner === "coles"}
          />
          <StorePricePanel
            store="woolworths"
            deal={group.woolworths}
            isWinner={winner === "woolworths"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
