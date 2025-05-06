
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SubscriptionForm from '@/components/SubscriptionForm';
import SampleDeals from '@/components/SampleDeals';
import { ArrowRight, Bell, ShoppingBag, Mail } from 'lucide-react';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-white to-coles-gray py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-8 md:mb-0">
                <h1 className="text-4xl md:text-5xl font-bold mb-6">
                  Never Miss a <span className="text-coles-red">Half Price</span> Deal Again
                </h1>
                <p className="text-lg text-gray-700 mb-8">
                  Get notified about Coles' half price specials as soon as they're available.
                  We'll email you when items matching your preferences go on sale.
                </p>
                <a 
                  href="#subscribe" 
                  className="inline-flex items-center gap-2 bg-coles-red text-white px-6 py-3 rounded-md hover:bg-red-700 transition-colors"
                >
                  Subscribe Now
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
              <div className="md:w-1/2 md:pl-12">
                <div className="bg-white p-6 rounded-lg shadow-lg relative">
                  <div className="animate-bounce-slight absolute -top-10 right-10">
                    <div className="relative">
                      <div className="bg-yellow-100 text-yellow-800 font-bold px-4 py-2 rounded-full">
                        50% OFF
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                        <div className="w-2 h-10 bg-yellow-100"></div>
                      </div>
                    </div>
                  </div>
                  <img 
                    src="https://www.coles.com.au/content/dam/coles/cusp/about-coles/1440x673_About_Coles_Masthead_Image.jpg" 
                    alt="Coles Supermarket" 
                    className="w-full h-auto rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                  <Bell className="h-8 w-8 text-coles-red" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Subscribe</h3>
                <p className="text-gray-600">
                  Enter your email and set your preferences for products and minimum discount.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                  <ShoppingBag className="h-8 w-8 text-coles-red" />
                </div>
                <h3 className="text-xl font-semibold mb-3">We Monitor</h3>
                <p className="text-gray-600">
                  Our system constantly checks Coles for new half-price specials matching your criteria.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                  <Mail className="h-8 w-8 text-coles-red" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Get Notified</h3>
                <p className="text-gray-600">
                  Receive timely email alerts about deals so you never miss out on savings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sample Deals Section */}
        <section id="deals" className="py-16 bg-coles-gray">
          <div className="container mx-auto px-4">
            <SampleDeals />
          </div>
        </section>

        {/* Subscribe Section */}
        <section id="subscribe" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-4">Subscribe for Alerts</h2>
            <p className="text-center text-gray-600 max-w-2xl mx-auto mb-8">
              Enter your email to receive notifications when Coles adds new items to their half-price specials. 
              Customize your alert preferences to get only the deals you care about.
            </p>
            <SubscriptionForm />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
