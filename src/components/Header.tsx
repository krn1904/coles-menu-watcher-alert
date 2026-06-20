
import React, { useState } from 'react';
import { Scale, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#deals', label: 'Compare deals' },
];

const Header: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 w-full bg-white/95 backdrop-blur border-b border-gray-200 z-50 shadow-sm">
      <div className="container mx-auto flex justify-between items-center py-3 px-4">
        <a href="#" className="flex items-center gap-2 min-w-0">
          <Scale className="h-6 w-6 text-coles-red shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight truncate">
              HalfPrice Compare
            </h1>
            <p className="text-[10px] text-gray-500 leading-none hidden sm:block">
              Coles vs Woolworths
            </p>
          </div>
        </a>

        <nav className="hidden md:block">
          <ul className="flex items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-gray-600 hover:text-coles-red transition-colors text-sm font-medium"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Button asChild size="sm" className="bg-coles-red hover:bg-red-700">
                <a href="#deals">Browse specials</a>
              </Button>
            </li>
          </ul>
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 mt-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-base font-medium text-gray-700 hover:text-coles-red"
                >
                  {link.label}
                </a>
              ))}
              <Button asChild className="bg-coles-red hover:bg-red-700 mt-4">
                <a href="#deals" onClick={() => setOpen(false)}>
                  Browse specials
                </a>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Header;
