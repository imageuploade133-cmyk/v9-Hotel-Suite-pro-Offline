

'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  query,
  getDocs,
  where,
  limit,
  orderBy,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Utensils,
  Search,
  ShoppingCart,
  Plus,
  Trash2,
  MoreVertical,
  Edit,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  Tags,
  Eye,
  ArrowLeft,
  Percent,
  Info,
} from 'lucide-react';
import type { MenuItem, CartItem, Menu } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MenuItemFormDialog } from '@/components/menu/menu-item-form-dialog';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MenuCartSidebar } from '@/components/menu/menu-cart-sidebar';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { getLucideIcon } from '@/lib/icon-map';
import { PlaceOrderDialog } from '@/components/menu/place-order-dialog';
import { MenuPreviewDialog } from '@/components/menu/menu-preview-dialog';
import Link from 'next/link';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useParams } from 'next/navigation';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';

const PAGE_SIZE = 6;


function MenuItemCard({
  item,
  onAddToCart,
  onEdit,
  onDelete,
  currency,
  buttonColor,
  menuCategoriesData,
  isOrderingEnabled,
}: {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  currency: string;
  buttonColor?: string;
  menuCategoriesData: any[];
  isOrderingEnabled: boolean;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false); // New state for the action modal
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false); // State for nested delete AlertDialog
  const categoryData = menuCategoriesData?.find(c => c.name === item.category);
  const Icon = categoryData?.iconName ? getLucideIcon(categoryData.iconName) : null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

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

  const itemWithCorrectPrice = { ...item, price: displayPrice };


  const handleAddToCartClick = () => {
    if (!isOrderingEnabled) return;
    setIsAdding(true);
    onAddToCart(itemWithCorrectPrice);
    setTimeout(() => {
        setIsAdding(false);
    }, 300);
  }

  const getButtonStyle = (color?: string) => {
    if (!color) return {};
    if (color.startsWith('linear-gradient')) {
      return { backgroundImage: color };
    }
    return { backgroundColor: color };
  };


  return (
    <Card className={cn("flex flex-col overflow-hidden transition-all duration-300 group/card", isAdding && 'transform scale-105 shadow-2xl border-primary')}>
        <div className="relative aspect-video">
           {isPromoActive && (
              <Badge className="absolute top-2 left-2 z-10 bg-red-600 text-white gap-1">
                  <Percent className="h-3 w-3"/>
                  SALE
              </Badge>
          )}
          {item.images && item.images.length > 0 ? (
             <Carousel className="h-full w-full">
              <CarouselContent>
                {item.images.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="relative aspect-video">
                      <Image
                        src={image}
                        alt={`${item.name} - Image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {item.images.length > 1 && (
                <>
                  <CarouselPrevious className="absolute left-2 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover/card:opacity-100" />
                  <CarouselNext className="absolute right-2 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover/card:opacity-100" />
                </>
              )}
            </Carousel>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Utensils className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                <div>
                    <CardTitle>{item.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
                      {item.category}
                    </Badge>
                </div>
                <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Actions for {item.name}</DialogTitle>
                            <DialogDescription>
                                Select an action to perform on this menu item.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Button
                                variant="outline"
                                onClick={() => { onEdit(item); setIsActionModalOpen(false); }}
                                className="w-full justify-start"
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Item
                            </Button>
                            <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
                              <AlertDialogTrigger asChild>
                                <Button
                                    variant="destructive"
                                    className="w-full justify-start"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Item
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the menu item "{item.name}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setIsConfirmDeleteOpen(false)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      onDelete(item);
                                      setIsConfirmDeleteOpen(false);
                                      setIsActionModalOpen(false); // Close parent action modal too
                                    }}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsActionModalOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                </div>
                 <CardDescription className="mt-2">{item.description}</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col items-center gap-2 mt-auto bg-muted/50 p-4">
                 <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{formatCurrency(displayPrice)}</span>
                    {isPromoActive && (
                        <span className="text-sm text-muted-foreground line-through">
                            {formatCurrency(item.price)}
                        </span>
                    )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <Button
                          onClick={handleAddToCartClick}
                          className="w-full"
                          style={getButtonStyle(buttonColor)}
                          disabled={!isOrderingEnabled}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Add to Cart
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!isOrderingEnabled && (
                    <TooltipContent>
                      <p className="flex items-center gap-2">
                        <Info className="h-4 w-4"/>
                         Online ordering is disabled for this menu.
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
            </CardFooter>
        </div>
    </Card>
  );
}


function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                    <Skeleton className="aspect-video w-full" />
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardFooter className="flex flex-col items-center gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" onClick={onNext} disabled={!canNext}>
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}


function MenuEditorPageComponent({ menuId }: { menuId: string }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('All');
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<MenuItem | null>(null);
  const [itemToRemove, setItemToRemove] = React.useState<CartItem | null>(null);
  const [isClearCartAlertOpen, setIsClearCartAlertOpen] = React.useState(false);
  const [isPlaceOrderOpen, setIsPlaceOrderOpen] = React.useState(false);


  // Pagination State
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const menuDocRef = React.useMemo(() => firestore && menuId ? doc(firestore, 'menus', menuId) : null, [firestore, menuId]);
  const { data: menuData, isLoading: isMenuLoading } = useDoc<Menu>(menuDocRef);

  const menuCategoriesQuery = React.useMemo(() => {
    if (!firestore || !menuId) return null;
    return query(collection(firestore, `menus/${menuId}/categories`));
  }, [firestore, menuId]);
  const { data: menuCategoriesData, isLoading: areCategoriesLoading } = useCollection<{id: string, name: string, iconName?: string}>(menuCategoriesQuery);


  const currency = settings?.currency || 'USD';
  const menuButtonColor = settings?.menuButtonColor;
  const menuCartIconColor = settings?.menuCartIconColor;
  const menuActiveCategoryColor = settings?.menuActiveCategoryColor;
  const isOrderingEnabled = menuData?.isOrderingEnabled ?? true;

  const fetchMenuItems = React.useCallback(async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!firestore || !menuId) return;
    setIsLoading(true);

    const constraints: QueryConstraint[] = [];
    if (activeCategory !== 'All') {
      constraints.push(where('category', '==', activeCategory));
    }
    if (searchTerm) {
      constraints.push(where('name', '>=', searchTerm));
      constraints.push(where('name', '<=', searchTerm + ''));
    }
    constraints.push(orderBy('name'));

    const baseQuery = query(collection(firestore, `menus/${menuId}/items`), ...constraints);

    let paginatedQuery;
    const isInitialOrReload = direction === 'initial' || reloadCounter > 0;

    if (direction === 'next' && lastVisible) {
      paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      paginatedQuery = query(baseQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
      paginatedQuery = query(baseQuery, limit(PAGE_SIZE));
    }

    try {
      const snapshot = await getDocs(paginatedQuery);

      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        setMenuItems(data);
        const newFirst = snapshot.docs[0];
        const newLast = snapshot.docs[snapshot.docs.length - 1];
        setFirstVisible(newFirst);
        setLastVisible(newLast);

        const nextQuery = query(baseQuery, startAfter(newLast), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        setHasMore(!nextSnapshot.empty);

        if (direction === 'next') setPage(p => p + 1);
        else if (direction === 'prev' && page > 1) setPage(p => p - 1);
        else if (isInitialOrReload) setPage(1);
      } else {
        if (isInitialOrReload) setMenuItems([]);
        setHasMore(false);
        if (direction === 'prev' && page > 1) {
          // Re-fetch the first page instead.
          const firstPageQuery = query(baseQuery, limit(PAGE_SIZE));
          const firstPageSnapshot = await getDocs(firstPageQuery);
          if (!firstPageSnapshot.empty) {
            const data = firstPageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
            setMenuItems(data);
            setFirstVisible(firstPageSnapshot.docs[0]);
            setLastVisible(firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1]);
            setPage(1);
             const nextQuery = query(baseQuery, startAfter(firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1]), limit(1));
             const nextSnapshot = await getDocs(nextQuery);
             setHasMore(!nextSnapshot.empty);
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch menu items.' });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, activeCategory, searchTerm, lastVisible, firstVisible, page, toast, reloadCounter, menuId]);

  React.useEffect(() => {
    fetchMenuItems('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, searchTerm, reloadCounter, menuId]);

  const handleNextPage = () => {
    if (hasMore) fetchMenuItems('next');
  };

  const handlePrevPage = () => {
    if (page > 1) fetchMenuItems('prev');
  };


  const categories = React.useMemo(() => {
    if (!menuCategoriesData) return ['All'];
    return ['All', ...menuCategoriesData.map(c => c.name)];
  }, [menuCategoriesData]);

  const handleAddToCart = (item: MenuItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
     toast({
      variant: 'success',
      title: 'Added to Cart',
      description: `1 x "${item.name}" was added to your order.`,
    });
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      const item = cart.find(i => i.id === itemId);
      if (item) setItemToRemove(item);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveFromCart = (item: CartItem) => {
    setItemToRemove(item);
  };

  const confirmRemoveFromCart = () => {
    if (!itemToRemove) return;
    setCart(prevCart => prevCart.filter(item => item.id !== itemToRemove.id));
    setItemToRemove(null);
  };


  const handleClearCart = () => {
    setIsClearCartAlertOpen(true);
  };

  const confirmClearCart = () => {
    setCart([]);
    setIsClearCartAlertOpen(false);
  };

  const handleDataMutation = () => {
    setReloadCounter(prev => prev + 1);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  // Modified handleDelete to directly perform deletion
  const handleDelete = async (item: MenuItem) => {
    if (!item || !firestore || !menuId) return;
    try {
      await deleteDoc(doc(firestore, `menus/${menuId}/items`, item.id));
      toast({
        variant: 'success',
        title: 'Menu Item Deleted',
        description: `"${item.name}" has been removed from the menu.`,
      });
      handleDataMutation();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Item',
        description: error.message || 'An unexpected error occurred.',
      });
    }
  };

  const handleOrderSuccess = () => {
    setIsPlaceOrderOpen(false);
    setCart([]);
    toast({
      variant: 'success',
      title: 'Order Placed!',
      description: 'Your order has been sent to the kitchen.',
      duration: 8000,
    });
  };

  const cartProps = {
    cart,
    currency,
    onUpdateQuantity: handleUpdateQuantity,
    onRemoveFromCart: handleRemoveFromCart,
    onClearCart: handleClearCart,
    onPlaceOrder: () => setIsPlaceOrderOpen(true),
    buttonColor: menuButtonColor,
    cartIconColor: menuCartIconColor,
    isOrderingEnabled: isOrderingEnabled,
    menuId,
  };

  const getCategoryButtonStyle = (color?: string) => {
    if (!color) {
        return {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
        };
    }
    if (color.startsWith('linear-gradient')) {
      return {
        backgroundImage: color,
        color: 'hsl(var(--primary-foreground))',
       };
    }
    return {
        backgroundColor: color,
        color: 'hsl(var(--primary-foreground))',

    };
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <Button variant="ghost" asChild className="self-start -ml-4">
            <Link href="/menus">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Menus
            </Link>
        </Button>
        <div className="flex flex-col lg:flex-row lg:gap-6">
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Utensils className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">
                    {isMenuLoading ? <Skeleton className="h-10 w-64" /> : menuData?.name || 'Menu Editor'}
                    </h1>
                    <div className="text-muted-foreground mt-2">
                        {isMenuLoading ? <div className="animate-pulse rounded-md bg-muted h-5 w-80" /> : menuData?.description || 'Manage your menu items, categories, and appearance.'}
                    </div>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-2">
                  <div className="relative flex-1 sm:flex-initial sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                      placeholder="Search for a dish..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <Button onClick={() => setIsPreviewOpen(true)} variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                  </Button>
                  <Button variant="outline" asChild>
                  <Link href={`/menu-editor/${menuId}/categories`}>Manage Categories</Link>
                  </Button>
                  <Button onClick={handleCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Item
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                  <Link href="/settings/menu">
                      <SettingsIcon className="h-4 w-4" />
                  </Link>
                  </Button>
              </div>

                <Carousel
                    opts={{
                        align: 'start',
                        dragFree: true,
                    }}
                    className="w-full"
                    >
                    <CarouselContent className="pl-1">
                        {areCategoriesLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <CarouselItem key={i} className="basis-auto">
                            <Skeleton className="h-9 w-24 rounded-md" />
                            </CarouselItem>
                        ))
                        ) : (
                        categories.map((category, index) => {
                            const categoryData = menuCategoriesData?.find(c => c.name === category);
                            const Icon = categoryData?.iconName ? getLucideIcon(categoryData.iconName) : null;
                            const isActive = activeCategory === category;
                            return (
                                <CarouselItem key={`${category}-${index}`} className="basis-auto">
                                <Button
                                    variant="outline"
                                    className={cn(
                                    'group transition-all hover:bg-primary/90 hover:text-primary-foreground',
                                    !isActive && 'text-foreground',
                                    )}
                                    style={isActive ? getCategoryButtonStyle(menuActiveCategoryColor) : {}}
                                    onClick={() => setActiveCategory(category)}
                                >
                                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                                    {category}
                                </Button>
                                </CarouselItem>
                            )
                        })
                        )}
                    </CarouselContent>
                    <CarouselPrevious className="absolute left-0 top-1/2 z-10 -translate-y-1/2" />
                    <CarouselNext className="absolute right-0 top-1/2 z-10 -translate-y-1/2" />
                </Carousel>


                {isLoading ? (
                <LoadingSkeleton />
                ) : menuItems && menuItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {menuItems.map(item => (
                    <MenuItemCard
                        key={item.id}
                        item={item}
                        onAddToCart={handleAddToCart}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        currency={currency}
                        buttonColor={menuButtonColor}
                        menuCategoriesData={menuCategoriesData || []}
                        isOrderingEnabled={isOrderingEnabled}
                    />
                    ))}
                </div>
                ) : (
                <EmptyState
                    icon={Search}
                    title="No Dishes Found"
                    description="Your search or filter returned no results. Try a different category or search term."
                    className="min-h-[50vh]"
                />
                )}
                {!isLoading && (menuItems.length > 0 || page > 1) && (
                    <div className="mt-4 flex items-center justify-end">
                        <PaginationControls
                        canPrev={page > 1}
                        canNext={hasMore}
                        onPrev={handlePrevPage}
                        onNext={handleNextPage}
                        />
                    </div>
                )}
            </div>

            <div className="hidden lg:block ml-8 w-full max-w-sm flex-shrink-0">
                <div className="sticky top-20">
                    <MenuCartSidebar {...cartProps} />
                </div>
            </div>
        </div>
      </div>

      {isMobile && <MenuCartSidebar {...cartProps} />}

      <MenuItemFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleDataMutation}
        menuId={menuId}
        item={editingItem}
      />

      <PlaceOrderDialog
        isOpen={isPlaceOrderOpen}
        onClose={() => setIsPlaceOrderOpen(false)}
        cart={cart}
        onSuccess={handleOrderSuccess}
        menuId={menuId}
      />

      <MenuPreviewDialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen} menuId={menuId} />


      <AlertDialog open={!!itemToRemove} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{itemToRemove?.name}" from your cart?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveFromCart}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearCartAlertOpen} onOpenChange={setIsClearCartAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Entire Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all items from your cart? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearCart}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Clear Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

export default withAuth(MenuEditorPageComponent, PagePermission.MANAGE_MENUS);
