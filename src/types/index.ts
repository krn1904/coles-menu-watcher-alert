
export interface Deal {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  imageUrl: string;
  category: string;
  discountPercentage: number;
}

export interface SubscriptionFormData {
  email: string;
  categories: string[];
  minDiscount: number;
}
