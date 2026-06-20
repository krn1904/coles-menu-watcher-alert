import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORY_BY_ID, type CategoryId } from "@/lib/categories";
import { type Deal, deriveCategory, discountLabel, formatPrice } from "@/lib/product-match";
import { getStoreSearchUrl, type StoreId } from "@/lib/store-links";
import { StoreBadge } from "./StoreBadge";
import { cn } from "@/lib/utils";

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";

type Props = { deal: Deal };

export function DealCard({ deal }: Props) {
  const store = deal.store as StoreId;
  const category = deriveCategory(deal.name, deal.category) as CategoryId;
  const cat = CATEGORY_BY_ID[category];

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md relative flex flex-col h-full">
      <span className="deal-badge">{deal.discount_percentage ?? 50}% OFF</span>
      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-2 border-b">
        <img
          src={deal.image_url || PLACEHOLDER_IMG}
          alt={deal.name}
          className="object-contain max-h-full max-w-full"
          loading="lazy"
        />
      </div>
      <CardContent className="p-3 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-[10px] text-gray-500 truncate">
            {cat.emoji} {cat.label}
          </span>
          {store && <StoreBadge store={store} />}
        </div>
        <h3 className="font-medium line-clamp-2 text-sm flex-1 min-h-[2.5rem]">{deal.name}</h3>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <span className="text-xs line-through text-gray-400 block">
              {formatPrice(deal.original_price)}
            </span>
            <span className={cn(
              "text-base font-bold",
              store === "coles" ? "text-coles-red" : "text-woolies-green",
            )}>
              {formatPrice(deal.sale_price)}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full whitespace-nowrap">
            {discountLabel(deal.discount_percentage)}
          </span>
        </div>
        <Button variant="outline" size="sm" className="w-full mt-2 h-8 text-xs" asChild>
          <a
            href={getStoreSearchUrl(store, deal.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5"
          >
            View on store
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
