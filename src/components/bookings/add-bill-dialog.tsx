'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Booking, MenuItem, BillItem, Menu, LaundryServiceItem, Bill } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { ScrollArea } from '../ui/scroll-area';
import { Search, PlusCircle, MinusCircle, Trash2, Plus, ShoppingCart, ConciergeBell, ChefHat, WashingMachine } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '../ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';

interface AddBillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirm: (booking: Booking, items: BillItem[], total: number) => void;
}

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

function MenuItemCard({ item, onAddToCart, currency }: { item: MenuItem; onAddToCart: (item: MenuItem, price: number) => void; currency: string; }) {
  const { displayPrice, isPromoActive } = getDisplayPrice(item);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <Card className="flex flex-col overflow-hidden">
        {item.images && item.images.length > 0 && (
            <div className="relative aspect-video w-full">
                <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                 {isPromoActive && <Badge variant="destructive" className="absolute top-2 right-2">SALE</Badge>}
            </div>
        )}
        <CardHeader>
            <CardTitle>{item.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
            <div className="flex items-baseline gap-2">
                <span className="font-bold text-lg">{formatCurrency(displayPrice)}</span>
                {isPromoActive && <span className="text-sm text-muted-foreground line-through">{formatCurrency(item.price)}</span>}
            </div>
        </CardContent>
        <CardFooter>
            <Button size="sm" className="w-full" variant="outline" onClick={() => onAddToCart(item, displayPrice)}>
                <Plus className="mr-2 h-4 w-4" />
                Add
            </Button>
        </CardFooter>
    </Card>
  )
}

function MenuTabContent({ menuId, searchTerm, onAddToCart }: { menuId: string; searchTerm: string; onAddToCart: (item: MenuItem, price: number) => void; }) {
    const firestore = useFirestore();
    const { settings } = useSettings();
    const currency = settings?.currency || 'USD';

    const itemsQuery = React.useMemo(() => {
        if (!firestore) return null;
        let q = query(collection(firestore, `menus/${menuId}/items`));
        if (searchTerm) {
            q = query(q, where('name', '>=', searchTerm), where('name', '<=', searchTerm + '\uf8ff'));
        }
        return q;
    }, [firestore, menuId, searchTerm]);
    const { data: items, isLoading: areItemsLoading } = useCollection<MenuItem>(itemsQuery);

    const categoriesQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, `menus/${menuId}/categories`));
    }, [firestore, menuId]);
    const { data: categories } = useCollection(categoriesQuery);

    const groupedItems = React.useMemo(() => {
        if (!items) return {};
        return items.reduce((acc, item) => {
            const category = item.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, MenuItem[]>);
    }, [items]);

    const orderedCategories = React.useMemo(() => {
        if (!categories) return Object.keys(groupedItems);

        const categoryOrder = (categories as any[]).map(c => c.name);
        return Object.keys(groupedItems).sort((a, b) => {
            const indexA = categoryOrder.indexOf(a);
            const indexB = categoryOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

    }, [groupedItems, categories]);


    if (areItemsLoading) return <div className="text-center py-10">Loading items...</div>
    if (!items || items.length === 0) return <div className="text-center py-10 text-muted-foreground">No items found in this menu.</div>

    return (
        <div className="space-y-6">
            {orderedCategories.map(category => (
                 <div key={category}>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <DynamicIcon iconName={category} className="h-4 w-4 text-muted-foreground" />
                        {category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {groupedItems[category].map(item => (
                            <MenuItemCard key={item.id} item={item} onAddToCart={onAddToCart} currency={currency} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function LaundryTabContent({ onAddToCart }: { onAddToCart: (item: LaundryServiceItem) => void }) {
    const firestore = useFirestore();
    const { settings } = useSettings();
    const currency = settings?.currency || 'USD';

    const laundryItemsQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'laundryItems'));
    }, [firestore]);
    const { data: laundryServiceItems, isLoading } = useCollection<LaundryServiceItem>(laundryItemsQuery);

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    if (isLoading) return <div className="text-center py-10">Loading laundry services...</div>
    if (!laundryServiceItems || laundryServiceItems.length === 0) return <div className="text-center py-10 text-muted-foreground">No laundry services have been set up.</div>

    return (
        <div className="space-y-3">
            {laundryServiceItems.map((item) => (
                <Card key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onAddToCart(item)}>
                        <Plus className="mr-2 h-4 w-4" /> Add
                    </Button>
                </Card>
            ))}
        </div>
    )
}


function ServiceTabContent({ onAddToCart }: { onAddToCart: (item: BillItem) => void }) {
    const [name, setName] = React.useState('');
    const [price, setPrice] = React.useState('');
    const [quantity, setQuantity] = React.useState('1');

    const handleAddService = () => {
        const priceNum = parseFloat(price);
        const quantityNum = parseInt(quantity, 10);
        if (name && !isNaN(priceNum) && priceNum > 0 && !isNaN(quantityNum) && quantityNum > 0) {
            onAddToCart({
                id: `service-${Date.now()}`,
                name,
                price: priceNum,
                quantity: quantityNum,
                paid: false,
                isService: true,
                images: null,
                billId: '', // placeholder, will be set later
            });
            setName('');
            setPrice('');
            setQuantity('1');
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">Add Custom Service or Charge</h3>
            <div className="space-y-3">
                 <div className="space-y-1">
                    <Label htmlFor="service-name">Service/Item Name</Label>
                    <Input id="service-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Early Check-in Fee" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <Label htmlFor="service-quantity">Quantity</Label>
                        <Input id="service-quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min={1} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="service-price">Price (per item)</Label>
                        <Input id="service-price" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g., 25.50" min={0} />
                    </div>
                </div>
                 <Button onClick={handleAddService} disabled={!name || !price || !quantity}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Service to Bill
                </Button>
            </div>
        </div>
    )
}

export function AddBillDialog({ isOpen, onClose, booking, onConfirm }: AddBillDialogProps) {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const [mainTab, setMainTab] = React.useState('restaurant');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [cart, setCart] = React.useState<BillItem[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSwitchTabConfirm, setShowSwitchTabConfirm] = React.useState(false);
  const [nextTab, setNextTab] = React.useState('');


  const menusQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'menus'), orderBy('createdAt', 'asc'));
  }, [firestore]);
  const { data: menus, isLoading: areMenusLoading } = useCollection<Menu>(menusQuery);

  const [activeMenuTab, setActiveMenuTab] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (menus && menus.length > 0 && !activeMenuTab) {
      setActiveMenuTab(menus[0].id);
    }
  }, [menus, activeMenuTab]);

  const currency = settings?.currency || 'USD';

  const { totalBill, buttonText, ButtonIcon } = React.useMemo(() => {
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const hasRestaurantItems = cart.some(item => !item.isService && !item.id.startsWith('laundry-'));
    const hasLaundryItems = cart.some(item => item.id.startsWith('laundry-'));

    let text = "Charge to Room";
    let Icon = ConciergeBell;

    if (hasRestaurantItems) {
        text = "Charge & Send to Kitchen";
        Icon = ChefHat;
    } else if (hasLaundryItems) {
        text = "Charge for Laundry";
        Icon = WashingMachine;
    }

    return { totalBill: total, buttonText: text, ButtonIcon: Icon };
  }, [cart]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  const addToCart = (item: MenuItem | LaundryServiceItem | BillItem, price?: number) => {
    let billItem: BillItem;
    if ('isService' in item && item.isService) { // It's already a BillItem (from ServiceTabContent)
        billItem = item;
    } else if ('duration' in item) { // It's a LaundryServiceItem
        billItem = {
            id: `laundry-${item.id}`,
            name: `Laundry: ${item.name}`,
            price: (item as LaundryServiceItem).price,
            quantity: 1,
            paid: false,
            images: null,
            isService: true,
            billId: '',
        };
    } else { // It's a MenuItem
        billItem = {
            id: item.id,
            name: item.name,
            price: price ?? (item as MenuItem).price,
            quantity: 1,
            paid: false,
            images: (item as MenuItem).images ?? null,
            isService: false,
            billId: '',
        };
    }

    setCart(prev => {
      const existingItem = prev.find(i => i.id === billItem.id);
      if (existingItem) {
        return prev.map(i => i.id === billItem.id ? { ...i, quantity: i.quantity + billItem.quantity } : i);
      }
      return [...prev, billItem];
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
      if (quantity <= 0) {
          setCart(prev => prev.filter(i => i.id !== itemId));
      } else {
          setCart(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
      }
  };

  const handleMainTabChange = (newTab: string) => {
    if (cart.length > 0 && mainTab !== newTab) {
      setNextTab(newTab);
      setShowSwitchTabConfirm(true);
    } else {
      setMainTab(newTab);
    }
  };

  const confirmTabSwitch = () => {
    setCart([]); // Clear the cart
    setMainTab(nextTab);
    setShowSwitchTabConfirm(false);
  };

  const handleConfirm = async () => {
    if (!booking) return;
    onConfirm(booking, cart, totalBill);
    onClose();
  };

  if (!booking) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add to Room Bill: Room {booking.roomNumber}</DialogTitle>
            <DialogDescription>
              Select items from the menu to add to the guest's bill.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 flex-1 min-h-0 pt-4">
            <div className="flex flex-col gap-4 min-h-0">
              <Tabs value={mainTab} onValueChange={handleMainTabChange} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="restaurant">Restaurant Menu</TabsTrigger>
                  <TabsTrigger value="laundry">Laundry</TabsTrigger>
                  <TabsTrigger value="services">Services &amp; Charges</TabsTrigger>
                </TabsList>
                <TabsContent value="restaurant" className="flex-1 flex flex-col mt-4 gap-4 overflow-hidden">
                  {areMenusLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <Tabs value={activeMenuTab} onValueChange={setActiveMenuTab} className="flex-1 flex flex-col">
                      <div className="flex items-center gap-4">
                        <TabsList>
                          {menus?.map(menu => (
                            <TabsTrigger key={menu.id} value={menu.id}>{menu.name}</TabsTrigger>
                          ))}
                        </TabsList>
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search menu items..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                      <ScrollArea className="flex-1 mt-4">
                        {menus?.map(menu => (
                          <TabsContent key={menu.id} value={menu.id}>
                            <MenuTabContent menuId={menu.id} searchTerm={searchTerm} onAddToCart={addToCart} />
                          </TabsContent>
                        ))}
                      </ScrollArea>
                    </Tabs>
                  )}
                </TabsContent>
                <TabsContent value="laundry" className="mt-4">
                    <LaundryTabContent onAddToCart={addToCart} />
                </TabsContent>
                <TabsContent value="services" className="mt-4">
                    <ServiceTabContent onAddToCart={addToCart} />
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex flex-col gap-4 border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold text-lg text-center flex items-center justify-center gap-2">
                <ShoppingCart className="h-5 w-5"/>
                Current Bill
              </h3>
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4 -mr-4">
                    {cart.length === 0 ? (
                        <p className="text-center text-muted-foreground pt-10">No items added yet.</p>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} each</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                        <MinusCircle className="h-4 w-4" />
                                    </Button>
                                    <span className="font-bold w-5 text-center">{item.quantity}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                        <PlusCircle className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="font-semibold w-20 text-right">{formatCurrency(item.price * item.quantity)}</p>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateQuantity(item.id, 0)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
              </ScrollArea>
              <Separator />
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total To Add:</span>
                <span>{formatCurrency(totalBill)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isSaving || cart.length === 0}>
                <ButtonIcon className="mr-2 h-4 w-4" />
                {buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={showSwitchTabConfirm} onOpenChange={setShowSwitchTabConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Current Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching tabs will clear the items you've added. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSwitchTabConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTabSwitch}>Yes, Switch &amp; Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
