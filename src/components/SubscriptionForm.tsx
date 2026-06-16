import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const categories = [
  { id: "groceries", label: "Groceries" },
  { id: "fresh-produce", label: "Fresh Produce" },
  { id: "meat-seafood", label: "Meat & Seafood" },
  { id: "bakery", label: "Bakery" },
  { id: "dairy", label: "Dairy" },
  { id: "frozen", label: "Frozen Food" },
  { id: "drinks", label: "Drinks" }
];

const SubscriptionForm: React.FC = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minDiscount, setMinDiscount] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, categoryId]);
    } else {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    }
  };

  const handleDiscountChange = (value: number[]) => {
    setMinDiscount(value[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from("subscriptions").insert([
        {
          email,
          categories: selectedCategories.length > 0 ? selectedCategories : null,
          min_discount: minDiscount,
        }
      ]);
      if (error) throw error;

      toast({
        title: "Subscription Successful!",
        description: "You'll receive alerts when new deals matching your preferences become available.",
      });
      
      // Reset form
      setEmail('');
      setSelectedCategories([]);
      setMinDiscount(25);
    } catch (error) {
      toast({
        title: "Subscription Failed",
        description: "There was an issue with your subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-md">
      <CardHeader>
        <CardTitle>Subscribe to Deal Alerts</CardTitle>
        <CardDescription>
          Get notified when items matching your preferences go on sale at Coles and Woolworths.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Categories (optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={(checked) => 
                      handleCategoryChange(category.id, checked === true)
                    }
                  />
                  <label 
                    htmlFor={category.id}
                    className="text-sm cursor-pointer"
                  >
                    {category.label}
                  </label>
                </div>
              ))}
            </div>
            {selectedCategories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No selection will notify you about all categories.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Minimum Discount: {minDiscount}% off
            </label>
            <Slider
              defaultValue={[25]}
              value={[minDiscount]}
              onValueChange={handleDiscountChange}
              max={80}
              min={10}
              step={5}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10% off</span>
              <span>80% off</span>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-coles-red hover:bg-red-700" 
          onClick={handleSubmit}
          disabled={isSubmitting || !email}
        >
          {isSubmitting ? "Subscribing..." : "Subscribe for Alerts"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SubscriptionForm;
