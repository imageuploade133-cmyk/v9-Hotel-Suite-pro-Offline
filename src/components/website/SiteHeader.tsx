
'use client';

import React, { useState, useEffect } from 'react';
import { useBooking } from './booking-provider';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, CalendarPlus } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useFormContext } from 'react-hook-form';

export const SiteHeader = () => {
  const { openBooking } = useBooking();
  const { settings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { watch } = useFormContext();

  const socialAndBrandingData = watch('websiteData.socialAndBranding', settings?.websiteData?.socialAndBranding || {});

  const sheetTitleId = React.useId();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#accommodations', label: 'Accommodations' },
    { href: '#gallery', label: 'Gallery' },
    { href: '#testimonials', label: 'Testimonials' },
    { href: '#contact', label: 'Concierge' },
  ];

  return (
    <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", isScrolled ? 'bg-charcoal/80 backdrop-blur-lg border-b border-white/5' : 'bg-transparent')}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-24 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 text-2xl md:text-3xl font-website-display font-bold tracking-wider text-white">
            {socialAndBrandingData?.websiteLogoUrl ? (
                <Image src={socialAndBrandingData.websiteLogoUrl} alt={settings?.websiteName || 'Logo'} width={140} height={40} className="object-contain h-10" />
            ) : (
                 <span style={{ fontFamily: 'Poppins, sans-serif' }}>{settings?.websiteName || 'CACID HOTEL'}</span>
            )}
        </a>
        <nav className="hidden lg:flex items-center gap-12">
          {navLinks.map(link => (
            <a key={link.href} className="relative text-[11px] font-bold tracking-[0.2em] uppercase text-white/70 hover:text-white transition-colors duration-300 group" href={link.href}>
              {link.label}
              <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
            <Button
                onClick={() => openBooking()}
                className="hidden sm:inline-flex px-8 h-12 bg-white/10 border border-white/20 text-white text-[11px] font-extrabold uppercase tracking-[0.2em] hover:bg-accent-gold hover:text-black transition-all backdrop-blur-sm rounded-full">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Book Stay
            </Button>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-white/10 hover:text-white">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-charcoal text-white border-l-0 p-0">
                  <SheetHeader className="p-4">
                    <SheetTitle id={sheetTitleId} className="sr-only">Mobile Navigation Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col p-8 pt-12 gap-8">
                    {navLinks.map(link => (
                      <a
                        key={link.href}
                        className="text-2xl font-display text-white/80 hover:text-accent-gold transition-colors"
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    ))}
                  </nav>
                  <div className="mt-auto p-8 border-t border-white/10">
                    <Button
                      onClick={() => { openBooking(); setIsMobileMenuOpen(false); }}
                      className="w-full h-14 bg-accent-gold text-black text-sm font-bold uppercase tracking-widest hover:bg-white transition-all">
                      Book Your Stay
                    </Button>
                  </div>
              </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
};
