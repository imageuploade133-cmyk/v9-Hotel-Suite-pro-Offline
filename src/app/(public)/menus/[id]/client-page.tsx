
'use client';

import * as React from 'react';
import type { Menu, MenuItem, MenuCategory } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Percent, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Logo } from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from '@/components/ui/card';

const getDisplayPrice = (item: MenuItem) => {
    const promoStartDate = getSafeDate(item.promoStartDate);
    const promoEndDate = getSafeDate(item.promoEndDate);
    const isPromoActive = promoStartDate && promoEndDate ? isWithinInterval(new Date(), { start: startOfDay(promoStartDate), end: endOfDay(promoEndDate) }) : false;

    let displayPrice = item.price;
    if (isPromoActive) {
        if (item.promoType === 'fixed' && item.promoPrice) {
            displayPrice = item.promoPrice;
        } else if (item.promoType === 'percentage' && item.promoPrice) {
            displayPrice = item.price - (item.price * (item.promoPrice / 100));
        }
    }
    return { displayPrice, isPromoActive };
}

const MenuItemCard = ({ item, currency }: { item: MenuItem; currency: string }) => {
  const { displayPrice, isPromoActive } = getDisplayPrice(item);
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md h-full flex flex-col">
      <div className="relative aspect-video bg-muted">
        {item.images && item.images.length > 0 ? (
          <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
        ) : null}
        {isPromoActive && (
          <Badge variant="destructive" className="absolute top-2 right-2">SALE</Badge>
        )}
      </div>
      <CardContent className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-lg">{item.name}</h3>
        {item.description && <p className="text-sm text-muted-foreground mt-1 flex-1">{item.description}</p>}
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-xl font-bold">{formatCurrency(displayPrice)}</span>
          {isPromoActive && (
            <span className="text-sm text-muted-foreground line-through">
              {formatCurrency(item.price)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


export function MenuClientPage({ menu, categories, items }: { menu: Menu, categories: MenuCategory[], items: MenuItem[] }) {
    const { settings } = useSettings();
    const currency = settings?.currency || 'USD';
    const [searchTerm, setSearchTerm] = React.useState('');
    const [activeCategory, setActiveCategory] = React.useState('All');

    const filteredItems = React.useMemo(() => {
        let categoryFiltered = items;
        if (activeCategory !== 'All') {
            categoryFiltered = items.filter(item => item.category === activeCategory);
        }
        if (!searchTerm) {
            return categoryFiltered;
        }
        const lowercasedSearch = searchTerm.toLowerCase();
        return categoryFiltered.filter(item =>
            item.name.toLowerCase().includes(lowercasedSearch) ||
            (item.description && item.description.toLowerCase().includes(lowercasedSearch))
        );
    }, [items, searchTerm, activeCategory]);

    const groupedItems = React.useMemo(() => {
        const acc: Record<string, MenuItem[]> = {};
        filteredItems.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
        });
        return acc;
    }, [filteredItems]);

    const orderedCategories = React.useMemo(() => {
        const categoryOrder = categories.map(c => c.name);
        return Object.keys(groupedItems).sort((a, b) => {
            const indexA = categoryOrder.indexOf(a);
            const indexB = categoryOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [groupedItems, categories]);


    return (
        <div className="bg-background min-h-screen">
            <header className="py-8 text-center space-y-4 border-b">
                 {menu.logoImageUrl ? (
                    <Image src={menu.logoImageUrl} alt={`${menu.name} Logo`} width={80} height={80} className="mx-auto rounded-md object-contain" />
                ) : (
                    <div className="flex justify-center"><Logo className="h-16 w-16 text-primary" /></div>
                )}
                <h1 className="text-4xl font-bold tracking-tight">{menu.name}</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">{menu.description}</p>
            </header>

            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm py-4 border-b">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search menu..."
                            className="pl-10 h-11"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                        <CarouselContent>
                            <CarouselItem className="basis-auto">
                                <Button variant={activeCategory === 'All' ? 'default' : 'outline'} onClick={() => setActiveCategory('All')}>All</Button>
                            </CarouselItem>
                            {categories.map((category) => (
                                <CarouselItem key={category.id} className="basis-auto">
                                    <Button
                                        variant={activeCategory === category.name ? 'default' : 'outline'}
                                        onClick={() => setActiveCategory(category.name)}
                                    >
                                        {category.iconName && <DynamicIcon iconName={category.iconName} className="mr-2 h-4 w-4" />}
                                        {category.name}
                                    </Button>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12" />
                        <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12" />
                    </Carousel>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-12">
                 {orderedCategories.length > 0 ? orderedCategories.map(categoryName => {
                     return (
                        <section key={categoryName} id={categoryName.toLowerCase().replace(/\s+/g, '-')}>
                            <h2 className="text-3xl font-semibold mb-6">{categoryName}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groupedItems[categoryName].map(item => (
                                    <MenuItemCard key={item.id} item={item} currency={currency} />
                                ))}
                            </div>
                        </section>
                     )
                 }) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>No results found for your search.</p>
                    </div>
                 )}
            </main>
        </div>
    );
}
