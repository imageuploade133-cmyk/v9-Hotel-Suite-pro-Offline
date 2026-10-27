

'use client';

import * as React from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { BillToRoomMergeDialog } from '@/components/pos/BillToRoomMergeDialog';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import type { Customer, StockSale, HeldSale, Booking, UnifiedItem } from '@/lib/types';
import { usePOS } from '@/hooks/usePOS';
import { CustomerPanel } from '../pos/CustomerPanel';
import { StockSaleReceiptDialog } from '../stock/stock-sale-receipt-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { writeBatch, doc, collection, serverTimestamp, query, where, getDocs, onSnapshot, runTransaction, getDoc } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeldSalesSection } from '../pos/HeldSalesSection';
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
import { Badge } from '../ui/badge';
import { List, ShoppingCart, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { useSettings } from '@/contexts/settings-context';
import { formatCurrency } from '@/lib/utils';

interface HotelPosProps {
    onSaleAction: () => void;
}


export function HotelPos({ onSaleAction }: HotelPosProps) {
  const { toast } = useToast();
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const { settings } = useSettings();

  const activeBookingsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in']));
  }, [firestore]);
  const { data: activeBookings } = useCollection<Booking>(activeBookingsQuery);

  const pos = usePOS({ userProfile, toast });
  const { cart, activeRunningItems, customer, setCustomer, addToCart, removeFromCart, updateQuantity, clearCart, processSale, restoreHeldSale, restoredSaleId, deleteHeldSale, stageItems, removeFromActiveRunningItems } = pos;

  const [activeTab, setActiveTab] = React.useState('new-sale');
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [selectedBookingId, setSelectedBookingId] = React.useState<string | undefined>();
  const [reloadProducts, setReloadProducts] = React.useState(0);
  const [showTabSwitchConfirm, setShowTabSwitchConfirm] = React.useState(false);
  const [nextTab, setNextTab] = React.useState('');
  const [isGuestSelectorOpen, setIsGuestSelectorOpen] = React.useState(false);
  const [heldSalesCount, setHeldSalesCount] = React.useState(0);

  // Bill to Room Merge Dialog state
  const [showMergeDialog, setShowMergeDialog] = React.useState(false);
  const [existingBillToRoomTable, setExistingBillToRoomTable] = React.useState<HeldSale | null>(null);
  const [pendingBillToRoomData, setPendingBillToRoomData] = React.useState<{
    bookingId: string;
    total: number;
    booking: Booking | null;
    combinedItems: UnifiedItem[];
  } | null>(null);

  // Fetch all held sales to check for existing bill-to-room tables
  const allHeldSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'heldSales'));
  }, [firestore]);
  const { data: allHeldSales } = useCollection<HeldSale>(allHeldSalesQuery);

  React.useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'heldSales'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHeldSalesCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [firestore]);

  React.useEffect(() => {
    if (selectedBookingId && selectedBookingId !== 'none') {
        const booking = activeBookings?.find(b => b.id === selectedBookingId);
        if (booking) {
            setCustomer({
                id: booking.id,
                name: booking.guestName,
                email: booking.guestEmail,
            });
        }
    } else if (selectedBookingId === 'none') {
        setCustomer(null);
    }
  }, [selectedBookingId, activeBookings, setCustomer]);

  // Helper function to find existing bill-to-room table for a booking
  const findExistingBillToRoomTable = (bookingId: string): HeldSale | null => {
    if (!allHeldSales) return null;
    return allHeldSales.find(
      sale => sale.customer?.id === bookingId && sale.linkedBillId
    ) || null;
  };

  // Handle merge with existing table
  const handleMergeWithExistingTable = async () => {
    if (!pendingBillToRoomData || !existingBillToRoomTable || !firestore || !userProfile) {
      setIsProcessing(false);
      return;
    }

    try {
      const { bookingId, total, booking, combinedItems } = pendingBillToRoomData;

      await runTransaction(firestore, async (transaction) => {
        // Read existing bill and held sale
        const billRef = doc(firestore, `bookings/${bookingId}/bills`, existingBillToRoomTable.linkedBillId!);
        const billDoc = await transaction.get(billRef);
        const heldSaleRef = doc(firestore, 'heldSales', existingBillToRoomTable.id);
        const heldSaleDoc = await transaction.get(heldSaleRef);

        if (!billDoc.exists() || !heldSaleDoc.exists()) {
          throw new Error('Existing bill or running table not found');
        }

        // Get current data
        const currentBill = billDoc.data();
        const currentHeldSale = heldSaleDoc.data() as HeldSale;

        // Merge items - if same item exists, add quantities; if different, add as new
        const mergedCart = [...currentHeldSale.cart];
        const mergedBillItems = [...currentBill.items];

        for (const cartItem of combinedItems) {
          const existingCartIndex = mergedCart.findIndex(item => item.id === cartItem.id);
          const existingBillIndex = mergedBillItems.findIndex((item: any) => item.name === cartItem.name);

          if (existingCartIndex >= 0) {
            // Item exists in cart - add quantity
            mergedCart[existingCartIndex] = {
              ...mergedCart[existingCartIndex],
              sellQuantity: mergedCart[existingCartIndex].sellQuantity + cartItem.sellQuantity,
            };
          } else {
            // New item - add to cart
            mergedCart.push({
              ...cartItem,
              quantity: 0,
              printedQuantity: 0,
            } as UnifiedItem);
          }

          if (existingBillIndex >= 0) {
            // Item exists in bill - add quantity and preserve printedQuantity
            const existingPrintedQty = mergedBillItems[existingBillIndex].printedQuantity || 0;
            mergedBillItems[existingBillIndex] = {
              ...mergedBillItems[existingBillIndex],
              quantity: mergedBillItems[existingBillIndex].quantity + cartItem.sellQuantity,
              printedQuantity: existingPrintedQty, // Preserve existing printed quantity
            };
          } else {
            // New item - add to bill
            mergedBillItems.push({
              id: cartItem.isService ? `service-${cartItem.id}` : cartItem.id,
              name: cartItem.name,
              price: cartItem.price || cartItem.sellingPrice,
              quantity: cartItem.sellQuantity,
              printedQuantity: 0, // New items start with 0 printed
              paid: false,
              isService: cartItem.isService,
              billId: billRef.id,
            });
          }
        }

        // Recalculate total
        const mergedTotal = mergedBillItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

        // Update bill - preserve existing print status
        transaction.update(billRef, {
          items: mergedBillItems,
          total: mergedTotal,
          updatedAt: serverTimestamp(),
          updatedBy: userProfile.uid,
          updatedByName: userProfile.name,
        });

        // Update held sale
        transaction.update(heldSaleRef, {
          cart: mergedCart,
          heldAt: serverTimestamp(),
        });
      });

      toast({
        variant: 'success',
        title: 'Items Added to Room Bill',
        description: `Items have been merged with the existing running table for Room ${booking?.roomNumber}.`,
      });

      clearCart();
      setIsPaymentOpen(false);
      setShowMergeDialog(false);
      setExistingBillToRoomTable(null);
      setPendingBillToRoomData(null);
      onSaleAction();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Merging Items', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle creating new table (original behavior)
  const handleCreateNewBillToRoomTable = async () => {
    if (!pendingBillToRoomData || !firestore || !userProfile) {
      setIsProcessing(false);
      return;
    }

    try {
      const { bookingId, total, booking, combinedItems } = pendingBillToRoomData;
      const batch = writeBatch(firestore);
      const billRef = doc(collection(firestore, `bookings/${bookingId}/bills`));

      const billItems = combinedItems.map(item => ({
        id: item.isService ? `service-${item.id}` : item.id,
        name: item.name,
        price: item.price || item.sellingPrice,
        quantity: item.sellQuantity,
        paid: false,
        isService: item.isService,
        billId: billRef.id,
      }));

      batch.set(billRef, {
        items: billItems,
        total: total,
        bookingId: bookingId,
        createdAt: serverTimestamp(),
        createdBy: userProfile?.uid,
        createdByName: userProfile?.name,
        paid: false,
      });

      const holdSaleRef = doc(collection(firestore, 'heldSales'));
      const holdSaleData: Partial<HeldSale> = {
        id: holdSaleRef.id,
        name: `Billed to ${booking?.guestName} - Room ${booking?.roomNumber}`,
        heldAt: serverTimestamp() as any,
        cart: combinedItems.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price || i.sellingPrice,
          sellQuantity: i.sellQuantity,
          isService: i.isService,
          quantity: 0,
          category: i.category,
          sourceType: i.sourceType
        })),
        customer: { id: booking?.id || '', name: booking?.guestName || "Walk-in Customer" },
        heldByUid: userProfile?.uid,
        heldByName: userProfile?.name,
        linkedBillId: billRef.id,
        printStatus: 'pending',
      };
      batch.set(holdSaleRef, holdSaleData);

      await batch.commit();
      toast({ variant: 'success', title: 'Success', description: `The items have been added to the guest's room bill and a new running table has been created.` });

      clearCart();
      setIsPaymentOpen(false);
      setShowMergeDialog(false);
      setExistingBillToRoomTable(null);
      setPendingBillToRoomData(null);
      onSaleAction();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessSale = async (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit' | 'Unpaid', _initialPaymentAmount?: number, _initialPaymentMethod?: string, billToRoomBookingId?: string) => {
    const allItems = [...activeRunningItems, ...cart];

    // Combine items with the same ID by summing their sellQuantity
    const combinedItems = allItems.reduce((acc, item) => {
      const existingItem = acc.find((i) => i.id === item.id);
      if (existingItem) {
        existingItem.sellQuantity += item.sellQuantity;
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, [] as typeof allItems);

    if (paymentMethod === 'Bill to Room') {
        const bookingId = billToRoomBookingId || (selectedBookingId !== 'none' ? selectedBookingId : undefined);
        if (!bookingId) {
            toast({ variant: 'destructive', title: 'No Guest Selected', description: 'Please select an active guest to bill their room.'});
            return;
        }
        setIsProcessing(true);
        try {
            // Get booking details
            let booking = activeBookings?.find(b => b.id === bookingId);
            if (!booking) {
              const bookingDoc = await getDoc(doc(firestore, 'bookings', bookingId));
              if (bookingDoc.exists()) {
                booking = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;
              }
            }

            // Check if there's an existing bill-to-room table for this booking
            const existingTable = findExistingBillToRoomTable(bookingId);

            if (existingTable) {
              // Show merge dialog
              setExistingBillToRoomTable(existingTable);
              setPendingBillToRoomData({ bookingId, total, booking: booking || null, combinedItems });
              setShowMergeDialog(true);
              setIsProcessing(false);
              return;
            }

            // No existing table - create new one
            const batch = writeBatch(firestore);
            const billRef = doc(collection(firestore, `bookings/${bookingId}/bills`));

            const billItems = combinedItems.map(item => ({
                id: item.isService ? `service-${item.id}` : item.id,
                name: item.name,
                price: item.price || item.sellingPrice,
                quantity: item.sellQuantity,
                paid: false,
                isService: item.isService,
                billId: billRef.id,
            }));

            batch.set(billRef, {
                items: billItems,
                total: total,
                bookingId: bookingId,
                createdAt: serverTimestamp(),
                createdBy: userProfile?.uid,
                createdByName: userProfile?.name,
                paid: false,
            });

            // Also create a HeldSale
            const holdSaleRef = doc(collection(firestore, 'heldSales'));
            const holdSaleData: Partial<HeldSale> = {
              id: holdSaleRef.id,
              name: `Billed to ${booking?.guestName} - Room ${booking?.roomNumber}`,
              heldAt: serverTimestamp() as any,
              cart: combinedItems.map(i => ({
                  id: i.id,
                  name: i.name,
                  price: i.price || i.sellingPrice,
                  sellQuantity: i.sellQuantity,
                  isService: i.isService,
                  quantity: 0,
                  category: i.category,
                  sourceType: i.sourceType
              })),
              customer: { id: booking?.id || '', name: booking?.guestName || "Walk-in Customer" },
              heldByUid: userProfile?.uid,
              heldByName: userProfile?.name,
              linkedBillId: billRef.id, // Link the bill to the held sale
              printStatus: 'pending',
            };
            batch.set(holdSaleRef, holdSaleData);

            await batch.commit();
            toast({ variant: 'success', title: 'Success', description: `The items have been added to the guest's room bill and a corresponding on-hold sale has been created.` });
            clearCart();
            setIsPaymentOpen(false);
            onSaleAction();
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsProcessing(false);
        }

    } else {
        setIsProcessing(true);
        try {
          const newSale = await processSale(total, paymentMethod, paymentStatus);
          toast({
            variant: 'success',
            title: 'Sale Completed',
            description: `Sale has been successfully processed.`,
          });
          setIsPaymentOpen(false);
          setSaleToPrint(newSale);
          onSaleAction();
        } catch (error) {
          // Error toast is shown in the usePOS hook
        } finally {
          setIsProcessing(false);
        }
    }
  };

  const handleRestore = (sale: HeldSale) => {
    restoreHeldSale(sale);
    setActiveTab('new-sale');
  };

  const handleTabChange = (newTab: string) => {
    if (activeTab === 'new-sale' && pos.cart.length > 0 && newTab !== 'new-sale') {
      setNextTab(newTab);
      setShowTabSwitchConfirm(true);
    } else {
      setActiveTab(newTab);
    }
  };

  const confirmTabSwitch = () => {
    clearCart();
    setActiveTab(nextTab);
    setShowTabSwitchConfirm(false);
    setNextTab('');
  };

  const selectedGuestName = React.useMemo(() => {
    if (!selectedBookingId || selectedBookingId === 'none' || !activeBookings) {
      return "Select an active guest...";
    }
    const booking = activeBookings.find(b => b.id === selectedBookingId);
    return booking ? `Room ${booking.roomNumber} - ${booking.guestName}` : "Select an active guest...";
  }, [selectedBookingId, activeBookings]);

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
         <TabsList className="grid w-full grid-cols-2 bg-card p-1 rounded-lg border shadow-sm">
            <TabsTrigger value="new-sale">
              <ShoppingCart className="mr-2 h-4 w-4" /> New Sale
            </TabsTrigger>
            <TabsTrigger value="on-hold-sales" className="relative">
              <List className="mr-2 h-4 w-4" /> Running Tables
               {heldSalesCount > 0 && (
                <Badge variant="destructive" className="ml-2 absolute -top-2 -right-2 h-5 w-5 justify-center rounded-full p-0">
                  {heldSalesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="new-sale" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                <ProductGrid onAddToCart={addToCart} reloadTrigger={reloadProducts} />
                </div>
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="space-y-2">
                        <Label>Bill to an Active Guest</Label>
                        <Popover open={isGuestSelectorOpen} onOpenChange={setIsGuestSelectorOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isGuestSelectorOpen}
                                className="w-full justify-between"
                                >
                                {selectedGuestName}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command filter={(value, search) => {
                                    if (value.toLowerCase().includes(search.toLowerCase())) return 1
                                    return 0
                                }}>
                                <CommandInput placeholder="Search by room or guest..." />
                                <CommandList>
                                    <CommandEmpty>No active guests found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            value="none"
                                            onSelect={() => {
                                                setSelectedBookingId('none');
                                                setIsGuestSelectorOpen(false);
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", selectedBookingId === 'none' ? "opacity-100" : "opacity-0")} />
                                            None (Walk-in Sale)
                                        </CommandItem>
                                        {activeBookings?.map((booking) => (
                                            <CommandItem
                                            key={booking.id}
                                            value={`Room ${booking.roomNumber} - ${booking.guestName}`}
                                            onSelect={() => {
                                                setSelectedBookingId(booking.id);
                                                setIsGuestSelectorOpen(false);
                                            }}
                                            >
                                            <Check className={cn("mr-2 h-4 w-4", selectedBookingId === booking.id ? "opacity-100" : "opacity-0")} />
                                            Room {booking.roomNumber} - {booking.guestName}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                <Cart
                    cart={cart}
                    activeRunningItems={activeRunningItems}
                    onRemoveItem={removeFromCart}
                    onUpdateQuantity={updateQuantity}
                    onClearCart={clearCart}
                    onHold={() => {}} // Hold functionality is part of the main POS page
                    onPay={() => setIsPaymentOpen(true)}
                    isRestored={!!pos.restoredSaleId}
                    onApplyDiscount={pos.applyDiscount}
                    removeDiscount={pos.removeDiscount}
                    discount={pos.discount}
                    customer={customer}
                    onStageItems={stageItems}
                    onRemoveFromActiveRunningItems={removeFromActiveRunningItems}
                />
                </div>
            </div>
          </TabsContent>
           <TabsContent value="on-hold-sales" className="mt-6">
                <HeldSalesSection onRestore={handleRestore} onDelete={onSaleAction} />
            </TabsContent>
      </Tabs>
      <PaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        activeRunningItems={activeRunningItems}
        customer={customer}
        onConfirm={handleProcessSale}
        isProcessing={isProcessing}
        discount={pos.discount}
        allowBillToRoom
      />
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
      />
      <AlertDialog open={showTabSwitchConfirm} onOpenChange={setShowTabSwitchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to switch tabs?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current cart is not empty. Switching tabs will clear the current sale. Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTabSwitch}>Yes, Clear Cart & Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BillToRoomMergeDialog
        isOpen={showMergeDialog}
        onClose={() => {
          setShowMergeDialog(false);
          setIsProcessing(false);
        }}
        onCreateNew={handleCreateNewBillToRoomTable}
        onMerge={handleMergeWithExistingTable}
        existingTable={existingBillToRoomTable}
        newItems={pendingBillToRoomData?.combinedItems || []}
        roomNumber={pendingBillToRoomData?.booking?.roomNumber || ''}
        guestName={pendingBillToRoomData?.booking?.guestName || ''}
        isProcessing={isProcessing}
      />
    </>
  );
}
