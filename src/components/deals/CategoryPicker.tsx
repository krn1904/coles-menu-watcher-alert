import { Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { getDealCategory, type DealWithOverride } from "@/lib/product-match";
import { cn } from "@/lib/utils";

type Props = {
  deal: DealWithOverride;
  onCategoryChange: (deal: DealWithOverride, categoryId: CategoryId | null) => void;
  compact?: boolean;
  className?: string;
};

export function CategoryPicker({ deal, onCategoryChange, compact, className }: Props) {
  const current = getDealCategory(deal);
  const isOverride = Boolean(deal.display_category);

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        if (value === "__auto__") {
          onCategoryChange(deal, null);
        } else {
          onCategoryChange(deal, value as CategoryId);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "h-7 text-[10px] border-dashed gap-1",
          compact ? "w-full" : "w-auto max-w-[140px]",
          isOverride && "border-amber-400 bg-amber-50",
          className,
        )}
        title="Change category"
      >
        <Tag className="h-3 w-3 shrink-0 opacity-60" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__auto__" className="text-xs">
          ↺ Auto-detect (saved for this product)
        </SelectItem>
        {CATEGORIES.map((cat) => (
          <SelectItem key={cat.id} value={cat.id} className="text-xs">
            {cat.emoji} {cat.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Apply override to a deal row in local state */
export function applyCategoryOverrideLocal(
  deal: DealWithOverride,
  categoryId: CategoryId | null,
): DealWithOverride {
  return { ...deal, display_category: categoryId };
}
