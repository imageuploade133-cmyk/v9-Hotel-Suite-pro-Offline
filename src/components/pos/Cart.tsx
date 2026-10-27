'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/contexts/settings-context';
import type { UnifiedItem, Customer } from '@/lib/types';
import { Trash2, Plus, Minus, DollarSign, Percent, XCircle, List, Bell, BellRing } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ShoppingCart } from 'lucide-react';
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
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { DiscountDialog } from './DiscountDialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CartProps {
  cart: UnifiedItem[];
  activeRunningItems: UnifiedItem[];
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onClearCart: () => void;
  onHold: () => void;
  onPay: () => void;
  isRestored: boolean;
  onApplyDiscount: (type: 'percentage' | 'amount', value: number) => void;
  removeDiscount: () => void;
  discount: { type: 'percentage' | 'amount'; value: number } | null;
  customer: (Partial<Customer> & { outstandingBalance?: number }) | null;
  onRemoveFromActiveRunningItems: (itemId: string) => void;
}

// Blinking animation styles - Red color for Active Running Table
const blinkAnimation = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes pulse-border-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); border-color: rgb(239, 68, 68); }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3); border-color: rgb(252, 129, 129); }
  }
  @keyframes notification-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
`;

export function Cart({
  cart,
  activeRunningItems,
  onRemoveItem,
  onUpdateQuantity,
  onClearCart,
  onHold,
  onPay,
  isRestored,
  onApplyDiscount,
  removeDiscount,
  discount,
  customer,
  onRemoveFromActiveRunningItems,
}: CartProps) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const { hasPermission } = usePermissions();
  const canApplyDiscount = hasPermission(PagePermission.APPLY_DISCOUNTS);
  const [isDiscountOpen, setIsDiscountOpen] = React.useState(false);

  // Animation state for Active Running Table
  const [showUpdateNotification, setShowUpdateNotification] = React.useState(false);
  const [isBlinking, setIsBlinking] = React.useState(false);
  const [prevActiveRunningCount, setPrevActiveRunningCount] = React.useState(0);
  const [hasNewChanges, setHasNewChanges] = React.useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.sellQuantity), 0);
  const activeRunningSubtotal = activeRunningItems.reduce((sum, item) => sum + (item.price * item.sellQuantity), 0);
  const subtotal = cartSubtotal + activeRunningSubtotal;

  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = (subtotal * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }
  }

  const total = subtotal - discountAmount;

  const isHoldDisabled = (cart.length === 0 && activeRunningItems.length === 0) || (!customer?.name || customer.name === 'Walk-in Customer');
  const hasAnyItems = cart.length > 0 || activeRunningItems.length > 0;

  // Trigger blinking animation when activeRunningItems changes
  React.useEffect(() => {
    if (activeRunningItems.length > 0 && activeRunningItems.length !== prevActiveRunningCount) {
      if (prevActiveRunningCount > 0) {
        // Items were updated
        setIsBlinking(true);
        setShowUpdateNotification(true);
        setHasNewChanges(true);

        // Auto-dismiss notification after 3 seconds
        const notificationTimer = setTimeout(() => {
          setShowUpdateNotification(false);
        }, 3000);

        // Stop blinking after 2 seconds
        const blinkTimer = setTimeout(() => {
          setIsBlinking(false);
        }, 2000);

        return () => {
          clearTimeout(notificationTimer);
          clearTimeout(blinkTimer);
        };
      }
    }
    setPrevActiveRunningCount(activeRunningItems.length);
  }, [activeRunningItems.length, prevActiveRunningCount]);

  // Trigger notification when cart has items and there are active running items (new changes scenario)
  React.useEffect(() => {
    if (cart.length > 0 && activeRunningItems.length > 0) {
      setHasNewChanges(true);
      setIsBlinking(true);
      setShowUpdateNotification(true);

      const timer = setTimeout(() => {
        setIsBlinking(false);
        setShowUpdateNotification(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [cart.length]);

  return (
    <>
    <style>{blinkAnimation}</style>
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 p-3 overflow-hidden flex flex-col gap-4">
        {/* Active Running Table Section */}
        {activeRunningItems.length > 0 && (
          <div
            className={cn(
              "border-2 rounded-lg p-3 transition-all duration-300 relative overflow-hidden",
              isBlinking
                ? "border-red-600 bg-red-50/70 dark:bg-red-950/40 animate-[pulse-border-red_1s_ease-in-out_infinite]"
                : "border-red-400 bg-red-50/30 dark:bg-red-950/20"
            )}
          >
            {/* Update Notification */}
            {showUpdateNotification && (
              <div className="absolute top-2 right-2 z-10">
                <Badge
                  variant="destructive"
                  className="text-white animate-[notification-pulse_0.5s_ease-in-out_infinite] shadow-lg"
                >
                  <BellRing className="h-3 w-3 mr-1" />
                  Updated
                </Badge>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <List className={cn(
                "h-5 w-5",
                isBlinking ? "text-red-600 animate-[blink_0.5s_ease-in-out_infinite]" : "text-red-500"
              )} />
              <h3 className={cn(
                "font-bold text-sm tracking-wide",
                isBlinking ? "text-red-700 dark:text-red-300" : "text-red-600 dark:text-red-400"
              )}>Active Running Table</h3>
              {hasNewChanges && (
                <Badge variant="secondary" className="ml-auto text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">
                  <Bell className="h-3 w-3 mr-1 animate-pulse" />
                  Changes Pending
                </Badge>
              )}
              {!hasNewChanges && (
                <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded">Read-only</span>
              )}
            </div>
            <ScrollArea className="max-h-40">
              <div className="space-y-2">
                {activeRunningItems.map(item => (
                  <div key={item.id} className={cn(
                    "flex items-center gap-3 bg-background/60 rounded p-2 transition-all duration-200 border border-red-200 dark:border-red-800",
                    isBlinking && "ring-2 ring-red-300 dark:ring-red-700 bg-red-50/50 dark:bg-red-950/30"
                  )}>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-8 text-center">{item.sellQuantity}</span>
                    </div>
                    <p className="w-20 text-right font-semibold text-sm">{formatCurrency(item.price * item.sellQuantity)}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-red-200 dark:border-red-800">
              <span className="text-red-600 dark:text-red-400 font-medium">Subtotal</span>
              <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(activeRunningSubtotal)}</span>
            </div>
          </div>
        )}

        {/* Current Sale Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <CardHeader className="p-0 mb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Current Sale</CardTitle>
              {cart.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {cart.length} item{cart.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            {cart.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Cart is empty" description="Add products from the grid to start a sale." />
            ) : (
              <div className="space-y-3 p-1">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, item.sellQuantity - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={item.sellQuantity}
                        onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="h-8 w-12 text-center"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, item.sellQuantity + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="w-20 text-right font-semibold">{formatCurrency(item.price * item.sellQuantity)}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemoveItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {cart.length > 0 && (
            <div className="flex justify-between text-sm mt-2 pt-2 border-t">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(cartSubtotal)}</span>
            </div>
          )}
        </div>
      </CardContent>

      {hasAnyItems && (
        <CardFooter className="flex-col items-stretch gap-3 p-4 border-t">
          <div className="flex justify-between text-lg">
            <span className="font-semibold">Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
           {discount ? (
            <div className="flex justify-between items-center text-sm text-destructive">
                <span className="font-semibold flex items-center gap-2">
                    Discount ({discount.type === 'percentage' ? `${discount.value}%` : 'Fixed'})
                </span>
                <div className="flex items-center gap-2">
                  <span>-{formatCurrency(discountAmount)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={removeDiscount}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
            </div>
          ) : (
             canApplyDiscount && (
             <Button variant="outline" size="sm" onClick={() => setIsDiscountOpen(true)}>
                <Percent className="mr-2 h-4 w-4" />
                Apply Discount
            </Button>
          )
          )}
          <Separator />
          <div className="flex justify-between text-2xl font-bold">
            <span>Grand Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <div className="flex gap-2 mt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to remove all items from the current sale?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearCart}>
                        Yes, Clear Cart
                    </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setHasNewChanges(false);
                onHold();
              }}
              disabled={isHoldDisabled}
              title={isHoldDisabled ? "Please enter a customer name to add to a running table." : ""}
            >
                <List className="mr-2 h-4 w-4" /> {isRestored ? 'Update Table' : 'Save Table'}
            </Button>
          </div>
          <Button className="w-full" onClick={onPay}>
            <DollarSign className="mr-2 h-4 w-4" />
            Process Payment
          </Button>
        </CardFooter>
      )}
    </Card>
    <DiscountDialog
        isOpen={isDiscountOpen}
        onClose={() => setIsDiscountOpen(false)}
        onApplyDiscount={onApplyDiscount}
        subtotal={subtotal}
    />
    </>
  );
}
