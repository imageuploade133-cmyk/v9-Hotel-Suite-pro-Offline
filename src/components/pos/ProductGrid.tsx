'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import type { StockItem, StockCategory, ServiceCategory, ServiceItem, UnifiedItem } from '@/lib/types';
import { useBranch } from '@/contexts/branch-context';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, PackageSearch, ChevronLeft, ChevronRight, ShoppingCart, ConciergeBell, ChevronsUpDown, Check, Package, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';
import { EmptyState } from '@/components/ui/empty-state';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';
import { lanSseClient } from '@/lib/lan-sync/sse-client';

interface CategoryOption {
  name: string;
  imageUrl?: string;
}

interface ProductGridProps {
  onAddToCart: (item: UnifiedItem) => void;
  reloadTrigger: number;
}

interface ProductCardProps {
  item: UnifiedItem;
  onAddToCart: (item: UnifiedItem) => void;
  cardBorderEnabled: boolean;
  cardBorderColor: string;
  buttonStyle?: React.CSSProperties;
}

const ProductCard = ({ item, onAddToCart, cardBorderEnabled, cardBorderColor, buttonStyle }: ProductCardProps) => {
    const { settings } = useSettings();
    const isServiceItem = Boolean(item.isService);
    const imageCandidates = [
      item.images?.[0],
      isServiceItem
        ? (settings?.useGlobalServiceImage ? settings?.globalServiceImageUrl : undefined)
        : (settings?.useGlobalStockImage ? settings?.globalStockImageUrl : undefined),
      // Backward-compatible fallback for older service records/settings that only
      // have the shared stock default configured.
      isServiceItem && !settings?.useGlobalServiceImage && settings?.useGlobalStockImage
        ? settings?.globalStockImageUrl
        : undefined,
    ].filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value));
    const [imageIndex, setImageIndex] = React.useState(0);
    const image = imageCandidates[imageIndex];
    const currency = settings?.currency || 'USD';
    const [isAdding, setIsAdding] = React.useState(false);
    const [showAdded, setShowAdded] = React.useState(false);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
    };

    const hasFiniteStock = item.quantity !== Infinity && item.quantity !== undefined && item.quantity !== null;
    const availableQuantity = hasFiniteStock
      ? Math.max(0, Number(item.quantity || 0) - Number((item as any).held || 0))
      : Infinity;
    const isOutOfStock = hasFiniteStock && availableQuantity <= 0;

    const handleAddToCart = () => {
        setIsAdding(true);
        onAddToCart(item);

        setTimeout(() => {
            setIsAdding(false);
            setShowAdded(true);
            setTimeout(() => setShowAdded(false), 1000);
        }, 300);
    };

    return (
        <Card
            className="flex flex-col overflow-hidden relative"
            style={{
                borderStyle: 'solid',
                borderWidth: cardBorderEnabled ? 1 : 0,
                borderColor: cardBorderEnabled ? cardBorderColor : 'transparent',
            }}
        >
            <motion.div
                className="absolute inset-0 z-10 pointer-events-none"
                initial={false}
                animate={showAdded ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="absolute inset-0 bg-green-500/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        className="bg-green-500 text-white rounded-full p-3 shadow-lg"
                    >
                        <ShoppingCart className="h-8 w-8" />
                    </motion.div>
                </div>
            </motion.div>
            <div className="relative aspect-square w-full bg-muted">
                {image ? (
                    <Image
                      src={image}
                      alt={item.name}
                      fill
                      unoptimized
                      className="object-cover"
                      onError={() => setImageIndex(index => Math.min(index + 1, imageCandidates.length))}
                  />
                ) : (
                    <div className="flex items-center justify-center h-full w-full"><ConciergeBell className="h-10 w-10 text-muted-foreground/50"/></div>
                )}
                 {hasFiniteStock && <Badge className="absolute top-2 right-2">{availableQuantity} available</Badge>}
            </div>
            <div className="p-3 flex-1 flex flex-col">
                <CardTitle className="text-sm font-semibold flex-1">{item.name}</CardTitle>
                <p className="text-lg font-bold mt-2">{formatCurrency(item.price || item.sellingPrice)}</p>
            </div>
            <CardFooter className="p-2 pt-0">
                <Button
                    size="sm"
                    style={buttonStyle}
                    className="w-full relative overflow-hidden"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                >
                    <motion.div
                        className="absolute inset-0 bg-primary/30"
                        initial={{ x: '-100%' }}
                        animate={isAdding ? { x: '100%' } : { x: '-100%' }}
                        transition={{ duration: 0.3 }}
                    />
                    <motion.div
                        animate={isAdding ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center"
                    >
                        {showAdded ? (
                            <>
                                <ShoppingCart className="mr-2 h-4 w-4" /> Added!
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" /> Add to Cart
                            </>
                        )}
                    </motion.div>
                </Button>
            </CardFooter>
        </Card>
    );
};

const CategoryThumbnail = ({ category, size = 'sm' }: { category: CategoryOption; size?: 'sm' | 'md' }) => {
    const sizeClasses = size === 'md' ? 'w-8 h-8' : 'w-6 h-6';
    return (
        <div className={cn('rounded-md overflow-hidden relative bg-muted flex-shrink-0 border', sizeClasses)}>
            {category.imageUrl ? (
                <Image src={category.imageUrl} alt={category.name} fill className="object-cover" />
            ) : category.name === 'All' ? (
                <div className="flex items-center justify-center h-full w-full">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
            ) : (
                <div className="flex items-center justify-center h-full w-full">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
            )}
        </div>
    );
};

const DEFAULT_PRODUCT_PAGE_SIZE = 6;
const MIN_PRODUCT_PAGE_SIZE = 1;
const MAX_PRODUCT_PAGE_SIZE = 48;

function getProductGridColumns(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.round(parsed)));
}

function getProductPageSize(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_PRODUCT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PRODUCT_PAGE_SIZE;
  return Math.min(MAX_PRODUCT_PAGE_SIZE, Math.max(MIN_PRODUCT_PAGE_SIZE, Math.round(parsed)));
}

function getProductCardButtonStyle(value: unknown): React.CSSProperties | undefined {
  if (typeof value !== 'string') return undefined;
  const color = value.trim();

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return { backgroundColor: color };
  }

  // The online menu also supports gradient button themes. Keep POS consistent
  // while rejecting arbitrary CSS values from a malformed settings document.
  if (/^linear-gradient\([^{};]+\)$/i.test(color) && !/\burl\s*\(/i.test(color)) {
    return { backgroundImage: color };
  }

  return undefined;
}

export function ProductGrid({ onAddToCart, reloadTrigger }: ProductGridProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = React.useState('');
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();
  const { settings } = useSettings();
  const pageSize = getProductPageSize(settings?.menuItemsPerPage);
  const desktopGridColumns = getProductGridColumns(settings?.menuProductGridColumnsDesktop, 2, 6);
  const mobileGridColumns = getProductGridColumns(settings?.menuProductGridColumnsMobile, 2, 3);
  const productGridStyle = {
    '--pos-product-grid-columns-mobile': mobileGridColumns,
    '--pos-product-grid-columns-desktop': desktopGridColumns,
  } as React.CSSProperties;
  const cardBorderEnabled = settings?.menuCardBorderEnabled !== false;
  const cardBorderColor = typeof settings?.menuCardBorderColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(settings.menuCardBorderColor)
    ? settings.menuCardBorderColor
    : '#E5E7EB';
  const buttonStyle = getProductCardButtonStyle(settings?.menuButtonColor ?? '#2563EB');
  const [items, setItems] = React.useState<UnifiedItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);

  const stockCategoriesQuery = React.useMemo(() => firestore ? query(collection(firestore, getCollectionPath('stockCategories'))) : null, [firestore, getCollectionPath]);
  const { data: stockCategories } = useCollection<StockCategory>(stockCategoriesQuery);

  const serviceCategoriesQuery = React.useMemo(() => firestore ? query(collection(firestore, getCollectionPath('serviceCategories'))) : null, [firestore, getCollectionPath]);
  const { data: serviceCategories } = useCollection<ServiceCategory>(serviceCategoriesQuery);

  const categories = React.useMemo((): CategoryOption[] => {
    const cats: CategoryOption[] = [
      { name: 'All' },
      { name: 'General' },
    ];
    const seen = new Set<string>(['All', 'General']);

    (stockCategories || []).forEach(cat => {
      if (!seen.has(cat.name)) {
        seen.add(cat.name);
        cats.push({ name: cat.name, imageUrl: cat.imageUrl });
      }
    });
    (serviceCategories || []).forEach(cat => {
      if (!seen.has(cat.name)) {
        seen.add(cat.name);
        cats.push({ name: cat.name, imageUrl: cat.imageUrl });
      }
    });
    return cats;
  }, [stockCategories, serviceCategories]);

  const selectedCategoryOption = React.useMemo(
    () => categories.find(c => c.name === selectedCategory) ?? { name: selectedCategory },
    [categories, selectedCategory]
  );

  const filteredCategories = React.useMemo(() => {
    if (!categorySearchTerm) return categories;
    const lowerCaseSearch = categorySearchTerm.toLowerCase();
    return categories.filter(cat => cat.name.toLowerCase().includes(lowerCaseSearch));
  }, [categories, categorySearchTerm]);

  const fetchItems = React.useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);

    const fetchCollection = async (collectionName: string) => {
        const fetchFromLanMaster = async () => {
            try {
                const res = await fetch(`/api/lan-sync/?collection=${encodeURIComponent(collectionName)}`, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    if (json.data) return Object.values(json.data) as any[];
                }
            } catch {}
            return null;
        };

        // On the hotel LAN, the Local Master is authoritative for offline and
        // online terminals alike. Prefer its durable local copy over cloud cache.
        if (isLocalMasterHost()) {
            const localData = await fetchFromLanMaster();
            if (localData) return localData;
        }

        try {
            const q = query(collection(firestore, collectionName), orderBy('name'));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            if (snapshot.metadata.fromCache) {
                const localData = await fetchFromLanMaster();
                if (localData) return localData;
            }
            return [];
        } catch {
            const localData = await fetchFromLanMaster();
            return localData || [];
        }
    };

    try {
        const [stockData, servicesData] = await Promise.all([
            fetchCollection(getCollectionPath('stock')),
            fetchCollection(getCollectionPath('services')),
        ]);

        const unifiedStock = (stockData as StockItem[]).filter(item => !item.hideFromPOS).map(item => ({ ...item, isService: false, price: item.sellingPrice, sourceType: 'Stock' as const }));
        const unifiedServices = (servicesData as ServiceItem[]).map(item => ({ ...item, isService: true, quantity: item.quantity === undefined ? Infinity : item.quantity, sourceType: 'Service' as const }));

        const allItems = [...unifiedStock, ...unifiedServices].sort((a, b) => a.name.localeCompare(b.name));

        setItems(allItems);

    } catch (e) {
        console.error('Error fetching items:', e);
    } finally {
        setIsLoading(false);
    }
  }, [firestore, getCollectionPath]);

  React.useEffect(() => {
      fetchItems();
  }, [fetchItems, reloadTrigger]);

  // Cloud-only terminals receive stock changes directly from Firestore.
  // Local Master/LAN terminals receive the durable local mutations over SSE,
  // so stock cards react immediately even while the hotel has no internet.
  React.useEffect(() => {
    if (!firestore) return;
    const stockCollectionName = getCollectionPath('stock');
    let active = true;
    const applyStockItem = (rawItem: Record<string, any>) => {
      const stockItem = { ...rawItem, isService: false, price: rawItem.sellingPrice, sourceType: 'Stock' as const } as UnifiedItem;
      if (!stockItem.id || stockItem.hideFromPOS) {
        if (stockItem.id) setItems(current => current.filter(item => item.id !== stockItem.id || item.isService));
        return;
      }
      setItems(current => {
        const next = current.filter(item => item.id !== stockItem.id || item.isService);
        next.push(stockItem);
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
    };

    const refreshLanStock = async () => {
      try {
        const response = await fetch(`/api/lan-sync/?collection=${encodeURIComponent(stockCollectionName)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (!active || !payload?.data) return;
        const latest = Object.values(payload.data) as Record<string, any>[];
        const nextStock = latest.filter(item => !item.hideFromPOS).map(item => ({
          ...item, isService: false, price: item.sellingPrice, sourceType: 'Stock' as const,
        })) as UnifiedItem[];
        setItems(current => [...current.filter(item => item.isService), ...nextStock].sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        // SSE reconnects automatically; polling below is the recovery fallback.
      }
    };

    if (isLocalMasterHost()) {
      const unsubscribe = lanSseClient.subscribe(event => {
        if (event.type === 'connected') {
          // Reconcile once after connect/reconnect in case events were missed.
          void refreshLanStock();
          return;
        }
        if (event.collectionName !== stockCollectionName || !event.docId) return;
        if (event.action === 'delete') {
          setItems(current => current.filter(item => item.id !== event.docId || item.isService));
          return;
        }
        if (event.data) applyStockItem({ ...event.data, id: event.docId });
      });
      void refreshLanStock();
      const recoveryPoll = window.setInterval(() => { void refreshLanStock(); }, 5000);
      return () => {
        active = false;
        unsubscribe();
        window.clearInterval(recoveryPoll);
      };
    }

    const stockQuery = query(collection(firestore, stockCollectionName), orderBy('name'));
    const unsubscribe = onSnapshot(stockQuery, snapshot => {
      if (!active) return;
      const nextStock = snapshot.docs
        .map(d => ({ id: d.id, ...d.data(), isService: false, price: d.data().sellingPrice, sourceType: 'Stock' as const }))
        .filter(item => !item.hideFromPOS) as UnifiedItem[];
      setItems(current => [...current.filter(item => item.isService), ...nextStock].sort((a, b) => a.name.localeCompare(b.name)));
    }, error => {
      console.error('[POS] Real-time stock listener failed:', error);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [firestore, getCollectionPath]);

  const filteredItems = React.useMemo(() => {
    let tempItems = items;

    if (selectedCategory !== 'All') {
        tempItems = tempItems.filter(item => item.category === selectedCategory);
    }

    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        tempItems = tempItems.filter(item =>
            item.name.toLowerCase().includes(lowerCaseSearch) ||
            (item.barcode && item.barcode.includes(searchTerm))
        );
    }

    return tempItems;
  }, [items, searchTerm, selectedCategory]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, pageSize]);

  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  React.useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setCurrentPage(1);
    setIsCategoryOpen(false);
    setCategorySearchTerm('');
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search products & services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
            />
          </div>
          <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isCategoryOpen}
                className="w-[180px] flex-shrink-0 justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <CategoryThumbnail category={selectedCategoryOption} size="sm" />
                  <span className="truncate">{selectedCategoryOption.name}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="end">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search category..."
                    value={categorySearchTerm}
                    onChange={(e) => setCategorySearchTerm(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <ScrollArea className="h-[200px]">
                {filteredCategories.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No category found.</div>
                ) : (
                  <div className="p-1">
                    {filteredCategories.map((cat) => (
                      <div
                        key={cat.name}
                        className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors active:bg-accent/80"
                        onClick={() => handleCategorySelect(cat.name)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleCategorySelect(cat.name);
                        }}
                      >
                        <CategoryThumbnail category={cat} size="md" />
                        <span className="flex-1 truncate text-sm">{cat.name}</span>
                        <Check
                          className={cn(
                            'h-4 w-4 flex-shrink-0',
                            selectedCategory === cat.name ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-3 overflow-hidden">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="pos-product-card-grid grid gap-4 p-1" style={productGridStyle}>
                 {Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          ) : paginatedItems && paginatedItems.length > 0 ? (
            <div className="pos-product-card-grid grid gap-4 p-1" style={productGridStyle}>
              {paginatedItems.map(item => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAddToCart={onAddToCart}
                  cardBorderEnabled={cardBorderEnabled}
                  cardBorderColor={cardBorderColor}
                  buttonStyle={buttonStyle}
                />
              ))}
            </div>
          ) : (
             <EmptyState
                icon={PackageSearch}
                title="No Products Found"
                description={`Your search for "${searchTerm}" did not return any results.`}
             />
          )}
        </ScrollArea>
      </CardContent>
       <CardFooter className="p-2 border-t justify-end flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                <ChevronLeft className="mr-1 h-4 w-4"/> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                Next <ChevronRight className="ml-1 h-4 w-4"/>
            </Button>
      </CardFooter>
    </Card>
  );
}
