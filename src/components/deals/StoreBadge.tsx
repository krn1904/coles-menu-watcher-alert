import { STORE_META, type StoreId } from "@/lib/store-links";
import { cn } from "@/lib/utils";

type Props = {
  store: StoreId;
  size?: "sm" | "md";
  className?: string;
};

export function StoreBadge({ store, size = "sm", className }: Props) {
  const meta = STORE_META[store];
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold uppercase tracking-wide rounded-full text-white",
        meta.bgClass,
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        className,
      )}
    >
      {meta.shortLabel}
    </span>
  );
}
