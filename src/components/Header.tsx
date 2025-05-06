
import React from 'react';
import { Bell } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 w-full bg-white border-b border-gray-200 z-10 shadow-sm">
      <div className="container mx-auto flex justify-between items-center py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-coles-red" />
          <h1 className="text-xl font-bold text-coles-red">
            Coles Deal Alert
          </h1>
        </div>
        <nav>
          <ul className="flex space-x-6">
            <li>
              <a 
                href="#how-it-works" 
                className="text-gray-600 hover:text-coles-red transition-colors"
              >
                How It Works
              </a>
            </li>
            <li>
              <a 
                href="#deals" 
                className="text-gray-600 hover:text-coles-red transition-colors"
              >
                Sample Deals
              </a>
            </li>
            <li>
              <a 
                href="#subscribe" 
                className="text-gray-600 hover:text-coles-red transition-colors"
              >
                Subscribe
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
