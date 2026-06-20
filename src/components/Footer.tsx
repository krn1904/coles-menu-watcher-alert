
import React from 'react';
import { getStoreSpecialsUrl } from '@/lib/store-links';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-10 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="max-w-md">
            <p className="font-semibold text-white mb-2">HalfPrice Compare</p>
            <p className="text-sm text-gray-400">
              Independent price comparison for Australian supermarket half-price specials.
              Not affiliated with Coles or Woolworths.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 text-sm">
            <div>
              <p className="font-medium text-white mb-2">Store catalogues</p>
              <ul className="space-y-1">
                <li>
                  <a
                    href={getStoreSpecialsUrl('coles')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    Coles half-price
                  </a>
                </li>
                <li>
                  <a
                    href={getStoreSpecialsUrl('woolworths')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    Woolworths half-price
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-white mb-2">About</p>
              <p className="text-gray-400 text-sm">
                Deals refresh weekly (Wednesday). Data sourced from public store catalogues.
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-8 pt-6 border-t border-gray-800">
          © {new Date().getFullYear()} HalfPrice Compare. Prices may change — always confirm on the store website.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
