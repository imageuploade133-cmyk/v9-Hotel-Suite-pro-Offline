
'use client';

import * as React from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { PaymentDialog } from './PaymentDialog';
import { HoldSaleDialog } from './HoldSaleDialog';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import type { Customer, StockSale, UserProfile } from '@/lib/types';
import { usePOS } from '@/hooks/usePOS';
import { CustomerPanel } from './CustomerPanel';
import { StockSaleReceiptDialog } from '../stock/stock-sale-receipt-dialog';
import { RecentTransactionsDialog } from './RecentTransactionsDialog';
import { History, List, ShoppingCart } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface NewSaleSectionProps {
  pos: ReturnType<typeof usePOS>;
  onSaleComplete: () => void;
  reloadProducts: number;
}

export function NewSaleSection({ pos, onSaleComplete, reloadProducts }: NewSaleSectionProps) {
  const { toast } = useToast();
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const { cart, activeRunningItems, customer, setCustomer, addToCart, removeFromCart, updateQuantity, clearCart, holdSale, processSale, restoredSaleId, holdName, discount, applyDiscount, removeDiscount, stageItems, removeFromActiveRunningItems } = pos;

  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [isHoldOpen, setIsHoldOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);

  // Pre-load users for receipt printing - ensures instant printing without loading delays
  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);


  const handleProcessSale = async (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit', initialPaymentAmount?: number, initialPaymentMethod?: string, _billToRoomBookingId?: string) => {
    setIsProcessing(true);
    try {
      const newSale = await processSale(total, paymentMethod, paymentStatus, initialPaymentAmount, initialPaymentMethod);
      toast({
        variant: 'success',
        title: 'Sale Completed',
        description: `Sale #${newSale.saleId} has been successfully processed.`,
      });
      setIsPaymentOpen(false);
      onSaleComplete();
      setSaleToPrint(newSale); // Open the receipt dialog
    } catch (error) {
      // Error toast is shown in the usePOS hook
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHoldSale = async (name: string, clearCartOnSuccess: boolean) => {
    setIsProcessing(true);
    try {
        await holdSale(name, clearCartOnSuccess);
        setIsHoldOpen(false);
    } catch (error) {
        // Error handling is inside usePOS
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <ProductGrid onAddToCart={addToCart} reloadTrigger={reloadProducts} />
        </div>
        <div className="lg:col-span-2 flex flex-col gap-6">
             <CustomerPanel
                selectedCustomer={customer}
                onSelectCustomer={setCustomer}
                isSaleRestored={!!restoredSaleId}
             />
          <Cart
            cart={cart}
            activeRunningItems={activeRunningItems}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onClearCart={clearCart}
            onHold={() => setIsHoldOpen(true)}
            onPay={() => setIsPaymentOpen(true)}
            isRestored={!!restoredSaleId}
            onApplyDiscount={applyDiscount}
            removeDiscount={removeDiscount}
            discount={discount}
            customer={customer}
            onStageItems={stageItems}
            onRemoveFromActiveRunningItems={removeFromActiveRunningItems}
          />
        </div>
      </div>
      <PaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        activeRunningItems={activeRunningItems}
        customer={customer}
        onConfirm={handleProcessSale}
        isProcessing={isProcessing}
        discount={discount}
      />
      <HoldSaleDialog
        isOpen={isHoldOpen}
        onClose={() => setIsHoldOpen(false)}
        onConfirm={handleHoldSale}
        isProcessing={isProcessing}
        customerName={customer?.name}
        isUpdate={!!restoredSaleId}
      />
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
        allUsers={allUsers}
        dataReady={!!allUsers}
      />
    </>
  );
}
