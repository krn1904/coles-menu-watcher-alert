
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Deal } from '@/types';

const sampleDeals: Deal[] = [
  {
    id: "1",
    name: "Australian Beef Mince",
    originalPrice: 15.00,
    salePrice: 7.50,
    imageUrl: "https://www.coles.com.au/content/dam/coles/cusp/eat-well/eat-well-logos/ewd-3-5star-l.png",
    category: "Meat & Seafood",
    discountPercentage: 50
  },
  {
    id: "2",
    name: "Cadbury Dairy Milk Chocolate 180g",
    originalPrice: 5.50,
    salePrice: 2.75,
    imageUrl: "https://www.coles.com.au/content/dam/coles/cusp/eat-well/eat-well-logos/ewd-1star-l.png",
    category: "Groceries",
    discountPercentage: 50
  },
  {
    id: "3",
    name: "Arnott's Tim Tam Value Pack 330g",
    originalPrice: 6.00,
    salePrice: 3.00,
    imageUrl: "https://www.coles.com.au/content/dam/coles/cusp/eat-well/eat-well-logos/ewd-1-5star-l.png",
    category: "Groceries",
    discountPercentage: 50
  },
  {
    id: "4",
    name: "Fresh Strawberries 250g",
    originalPrice: 4.50,
    salePrice: 2.25,
    imageUrl: "https://www.coles.com.au/content/dam/coles/cusp/eat-well/eat-well-logos/ewd-5star-l.png",
    category: "Fresh Produce",
    discountPercentage: 50
  }
];

const formatPrice = (price: number) => {
  return `$${price.toFixed(2)}`;
};

const DealCard: React.FC<{ deal: Deal }> = ({ deal }) => {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md relative">
      <span className="deal-badge">{deal.discountPercentage}% OFF</span>
      <div className="aspect-square bg-gray-100 flex items-center justify-center p-4">
        <img
          src={deal.imageUrl}
          alt={deal.name}
          className="h-20 w-20 object-contain"
        />
      </div>
      <CardContent className="p-4">
        <div className="text-xs text-gray-500 mb-1">{deal.category}</div>
        <h3 className="font-medium line-clamp-2 h-10">{deal.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs line-through text-gray-400">
              {formatPrice(deal.originalPrice)}
            </span>
            <span className="text-lg font-bold text-coles-red">
              {formatPrice(deal.salePrice)}
            </span>
          </div>
          <span className="price-tag">
            HALF PRICE
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const SampleDeals: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Sample Half-Price Deals</h2>
      <p className="text-gray-600 mb-8">
        Here are examples of the half-price deals you'll be notified about:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {sampleDeals.map(deal => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
};

export default SampleDeals;
