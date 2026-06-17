
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SampleDeals from '@/components/SampleDeals';
import { ArrowRight, Scale, Search, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow">
        <section className="bg-gradient-to-b from-white via-coles-gray to-white py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-sm font-medium text-coles-red mb-3 uppercase tracking-wide">
                Free · No signup · Updated weekly
              </p>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Find the <span className="text-coles-red">cheaper store</span> for every half-price special
              </h1>
              <p className="text-lg text-gray-700 mb-8">
                Coles and Woolworths both run half-price specials — but not always on the same
                products, and rarely at the same price. We match similar items and show you where
                to buy for less.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="bg-coles-red hover:bg-red-700">
                  <a href="#deals" className="inline-flex items-center gap-2">
                    Compare deals now
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#how-it-works">How it works</a>
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-14 max-w-4xl mx-auto">
              <HeroCard
                icon={<Search className="h-6 w-6 text-coles-red" />}
                title="Search & filter"
                text="Browse by category or search for brands you buy every week."
              />
              <HeroCard
                icon={<Scale className="h-6 w-6 text-woolies-green" />}
                title="Side-by-side prices"
                text="See Coles and Woolworths prices for matched products with the best deal highlighted."
              />
              <HeroCard
                icon={<ShoppingCart className="h-6 w-6 text-coles-red" />}
                title="Shop the right store"
                text="One click opens the product on the store site so you can add it to your cart."
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-14 bg-white border-y">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">How it works</h2>
            <ol className="space-y-8">
              <Step
                n={1}
                title="We collect this week's half-price specials"
                text="Every day our scrapers pull the latest half-price catalogue from Coles and Woolworths."
              />
              <Step
                n={2}
                title="We match similar products across stores"
                text="Using product names, brands, sizes and categories we pair items that are likely the same thing — even when the stores name them differently."
              />
              <Step
                n={3}
                title="You compare and shop smarter"
                text="See which store is cheaper, filter by what you need, and jump straight to the store to buy."
              />
            </ol>
          </div>
        </section>

        <section id="deals" className="py-14 bg-coles-gray">
          <div className="container mx-auto px-4">
            <SampleDeals />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

function HeroCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
      <div className="inline-flex p-3 rounded-full bg-gray-50 mb-4">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coles-red text-white font-bold text-sm">
        {n}
      </span>
      <div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-gray-600">{text}</p>
      </div>
    </li>
  );
}

export default Index;
