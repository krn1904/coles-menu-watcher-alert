import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
const PAGE_SIZE = 15;

const formatPrice = (price: number) => `$${price.toFixed(2)}`;

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
      <div className="text-xs text-gray-500 mb-1">{deal.category}</div>
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

const SampleDeals: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDeals(data);
      setLoading(false);
    };
    fetchDeals();
  }, []);

  const totalPages = useMemo(() => Math.ceil(deals.length / PAGE_SIZE), [deals]);
  const paginatedDeals = useMemo(
    () => deals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [deals, page]
  );

  const getPageNumbers = (): (number | string)[] => {
    const range = [];
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
        Here are the latest half-price deals from Coles:
      </p>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {paginatedDeals.map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>

          {/* Improved Pagination */}
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