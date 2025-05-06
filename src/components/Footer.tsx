
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-100 py-8 mt-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} Coles Deal Alert. Not affiliated with Coles Supermarkets.
            </p>
          </div>
          <div className="flex space-x-4">
            <a href="#privacy" className="text-sm text-gray-600 hover:text-coles-red">
              Privacy Policy
            </a>
            <a href="#terms" className="text-sm text-gray-600 hover:text-coles-red">
              Terms of Service
            </a>
            <a href="#contact" className="text-sm text-gray-600 hover:text-coles-red">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
