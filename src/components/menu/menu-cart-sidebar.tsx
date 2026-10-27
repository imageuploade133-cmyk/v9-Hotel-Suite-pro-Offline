'use client';

import * as React from 'react';
import { ShoppingCart, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import type { CartItem } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

interface MenuCartSidebarProps {
  cart: CartItem[];
  currency: string;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveFromCart: (item: CartItem) => void;
  onClearCart: () => void;
  onPlaceOrder: () => void;
  buttonColor?: string;
  cartIconColor?: string;
  isOrderingEnabled: boolean;
  menuId: string;
}

const CartContent = ({
  cart,
  currency,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  onPlaceOrder,
  buttonColor,
  isOrderingEnabled,
}: Omit<MenuCartSidebarProps, 'menuId' | 'cartIconColor' >) => {
  const totalPrice = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  const getButtonStyle = (color?: string) => {
    if (!color) return {};
    if (color.startsWith('linear-gradient')) {
      return { backgroundImage: color };
    }
    return { backgroundColor: color };
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 -mx-4 px-4">
        {cart.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState title="Cart is Empty" description="Add items from the menu to get started." icon={ShoppingCart} />
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(item.price)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                  <span className="font-bold w-5 text-center">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
                <p className="font-semibold w-20 text-right">{formatCurrency(item.price * item.quantity)}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemoveFromCart(item)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      {cart.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="flex justify-between items-center text-xl font-bold">
            <span>Total:</span>
            <span>{formatCurrency(totalPrice)}</span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              className="w-full"
              style={getButtonStyle(buttonColor)}
              onClick={onPlaceOrder}
              disabled={!isOrderingEnabled}
            >
              Place Order
            </Button>
            <Button variant="outline" className="w-full" onClick={onClearCart}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear Cart
            </Button>
          </div>
        </>
      )}
    </div>
  );
};


export function MenuCartSidebar(props: MenuCartSidebarProps) {
  const { cart, cartIconColor, isOrderingEnabled } = props;
  const isMobile = useIsMobile();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getIconStyle = (color?: string) => {
    if (!color) return {};
    if (color.startsWith('linear-gradient')) {
      return { backgroundImage: color, color: '#fff' };
    }
    return { backgroundColor: color, color: '#fff' };
  };

  if (isMobile) {
    if (cart.length === 0 || !isOrderingEnabled) {
      return null;
    }
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-4 right-4 z-40 h-16 w-16 rounded-full shadow-lg"
            style={getIconStyle(cartIconColor)}
          >
            <ShoppingCart className="h-6 w-6" />
            <Badge variant="destructive" className="absolute -top-1 -right-1 rounded-full">
              {totalItems}
            </Badge>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Your Order</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 p-4 overflow-hidden">
            <CartContent {...props} />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Your Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CartContent {...props} />
      </CardContent>
    </Card>
  );
}
