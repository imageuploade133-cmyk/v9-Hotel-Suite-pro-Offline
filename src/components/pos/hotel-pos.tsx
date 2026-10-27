

'use client';

import * as React from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { BillToRoomSection } from '@/components/pos/BillToRoomSection';
import { BillToRoomMergeDialog } from '@/components/pos/BillToRoomMergeDialog';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import type { Customer, StockSale, HeldSale, Booking, UnifiedItem, UserProfile } from '@/lib/types';
import { usePOS } from '@/hooks/usePOS';
import { CustomerPanel } from './CustomerPanel';
import { StockSaleReceiptDialog } from '../stock/stock-sale-receipt-dialog';
import { HeldSaleReceiptDialog } from './held-sale-receipt-dialog';
import { writeBatch, doc, collection, serverTimestamp, query, where, getDoc, onSnapshot, updateDoc, runTransaction, increment } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeldSalesSection } from './held-sales-section';
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
import { List, ShoppingCart, Check, ChevronsUpDown, Bell, BellRing, Search, Bed } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '../ui/button';
import { useSettings } from '@/contexts/settings-context';
import { formatCurrency } from '@/lib/utils';
import { HoldSaleDialog } from './HoldSaleDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useBranch } from '@/contexts/branch-context';

interface HotelPosProps {
    onSaleAction: () => void;
    context?: 'hotel' | 'pos';
    reloadProducts?: number;
}


export function HotelPos({ onSaleAction, context = 'pos', reloadProducts: externalReloadProducts }: HotelPosProps) {
  const { toast } = useToast();
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath } = useBranch();

  // Always load active bookings for Bill to Room feature
  const activeBookingsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in']));
  }, [firestore]);
  const { data: activeBookings } = useCollection<Booking>(activeBookingsQuery);

  // Pre-load users for receipt printing - ensures instant printing without loading delays
  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const pos = usePOS({ userProfile, toast });
  const { cart, activeRunningItems, customer, setCustomer, addToCart, removeFromCart, updateQuantity, clearCart, holdSale, processSale, restoreHeldSale, restoredSaleId, discount, applyDiscount, removeDiscount, removeFromActiveRunningItems } = pos;

  const [activeTab, setActiveTab] = React.useState('new-sale');
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isHoldOpen, setIsHoldOpen] = React.useState(false);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [internalReloadProducts, setInternalReloadProducts] = React.useState(0);
  const [showTabSwitchConfirm, setShowTabSwitchConfirm] = React.useState(false);
  const [nextTab, setNextTab] = React.useState('');
  const [isGuestSelectorOpen, setIsGuestSelectorOpen] = React.useState(false);
  const [guestSearchTerm, setGuestSearchTerm] = React.useState('');
  const [heldSalesCount, setHeldSalesCount] = React.useState(0);
  const [heldSaleToPrint, setHeldSaleToPrint] = React.useState<HeldSale | null>(null);
  const [newItemsToPrint, setNewItemsToPrint] = React.useState<UnifiedItem[]>([]);

  // Bill to Room state
  const [selectedBillToRoom, setSelectedBillToRoom] = React.useState<Booking | null>(null);
  const [activeBookingsCount, setActiveBookingsCount] = React.useState(0);

  // Bill to Room Merge Dialog state
  const [showMergeDialog, setShowMergeDialog] = React.useState(false);
  const [existingBillToRoomTable, setExistingBillToRoomTable] = React.useState<HeldSale | null>(null);
  const [pendingBillToRoomData, setPendingBillToRoomData] = React.useState<{
    bookingId: string;
    total: number;
    booking: Booking | null;
  } | null>(null);

  // Fetch all held sales to check for existing bill-to-room tables
  const allHeldSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('heldSales')));
  }, [firestore, getCollectionPath]);
  const { data: allHeldSales } = useCollection<HeldSale>(allHeldSalesQuery);

  const reloadProducts = (externalReloadProducts || 0) + internalReloadProducts;


  React.useEffect(() => {
    if (!firestore || !userProfile?.uid) return;
    const q = query(collection(firestore, getCollectionPath("heldSales")), where("heldByUid", "==", userProfile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHeldSalesCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [firestore, userProfile?.uid, getCollectionPath]);

  // Track active bookings count
  React.useEffect(() => {
    if (activeBookings) {
      setActiveBookingsCount(activeBookings.length);
    }
  }, [activeBookings]);

  // Handler for billing to room from the BillToRoomSection
  const handleBillToRoomSelect = (booking: Booking) => {
    setSelectedBillToRoom(booking);
    setCustomer({ id: booking.id, name: booking.guestName, email: booking.guestEmail });
    setActiveTab('new-sale');
    toast({
      title: 'Room Selected',
      description: `Now adding items to Room ${booking.roomNumber} - ${booking.guestName}. Add items to cart and process payment with "Bill to Room".`
    });
  };

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
      return;
    }
    setIsProcessing(true);

    try {
      const { bookingId, total, booking } = pendingBillToRoomData;

      await runTransaction(firestore, async (transaction) => {
        // Read existing bill and held sale
        const billRef = doc(firestore, `bookings/${bookingId}/bills`, existingBillToRoomTable.linkedBillId!);
        const billDoc = await transaction.get(billRef);
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), existingBillToRoomTable.id);
        const heldSaleDoc = await transaction.get(heldSaleRef);

        if (!billDoc.exists() || !heldSaleDoc.exists()) {
          throw new Error('Existing bill or running table not found');
        }

        // Get current data
        const currentBill = billDoc.data();
        const currentHeldSale = heldSaleDoc.data() as HeldSale;

        // Deduct stock for NEW non-service items being added (not already in existing cart)
        const newStockItems = cart.filter(item =>
          !item.isService &&
          item.sourceType !== 'Service' &&
          !currentHeldSale.cart.some(existingItem => existingItem.id === item.id)
        );
        if (newStockItems.length > 0) {
          const stockItemReads = newStockItems.map(item => transaction.get(doc(firestore, getCollectionPath('stock'), item.id)));
          const stockItemDocs = await Promise.all(stockItemReads);

          for (let i = 0; i < stockItemDocs.length; i++) {
            const stockDoc = stockItemDocs[i];
            const itemInCart = newStockItems[i];
            if (!stockDoc.exists() || stockDoc.data().quantity < itemInCart.sellQuantity) {
              throw new Error(`Not enough stock for ${itemInCart.name}. Available: ${stockDoc.data()?.quantity || 0}, In Cart: ${itemInCart.sellQuantity}`);
            }
          }
          // Deduct stock for NEW items only
          for (let i = 0; i < stockItemDocs.length; i++) {
            const stockDocRef = stockItemDocs[i].ref;
            const itemInCart = newStockItems[i];
            transaction.update(stockDocRef, { quantity: increment(-itemInCart.sellQuantity) });
          }
        }

        // Also deduct stock for items that already exist but are being added more quantity
        const existingStockItemsWithNewQuantity = cart.filter(item =>
          !item.isService &&
          item.sourceType !== 'Service' &&
          currentHeldSale.cart.some(existingItem => existingItem.id === item.id)
        );
        if (existingStockItemsWithNewQuantity.length > 0) {
          for (const cartItem of existingStockItemsWithNewQuantity) {
            const stockDocRef = doc(firestore, getCollectionPath('stock'), cartItem.id);
            transaction.update(stockDocRef, { quantity: increment(-cartItem.sellQuantity) });
          }
        }

        // Merge items - if same item exists, add quantities; if different, add as new
        const mergedCart = [...currentHeldSale.cart];
        const mergedBillItems = [...currentBill.items];
        let mergedTotal = currentBill.total;

        for (const cartItem of cart) {
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
            // Item exists in bill - add quantity and update total
            mergedBillItems[existingBillIndex] = {
              ...mergedBillItems[existingBillIndex],
              quantity: mergedBillItems[existingBillIndex].quantity + cartItem.sellQuantity,
            };
          } else {
            // New item - add to bill
            mergedBillItems.push({
              id: cartItem.isService ? `service-${cartItem.id}` : cartItem.id,
              name: cartItem.name,
              price: cartItem.price || cartItem.sellingPrice,
              quantity: cartItem.sellQuantity,
              paid: false,
              isService: cartItem.isService,
              billId: billRef.id,
            });
          }
        }

        // Recalculate total
        mergedTotal = mergedBillItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

        // Update bill
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
      setSelectedBillToRoom(null);
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
      return;
    }
    setIsProcessing(true);

    try {
      const { bookingId, total, booking } = pendingBillToRoomData;

      await runTransaction(firestore, async (transaction) => {
        const billRef = doc(collection(firestore, `bookings/${bookingId}/bills`));
        const holdSaleRef = doc(collection(firestore, getCollectionPath('heldSales')));

        // Deduct stock for non-service items
        const stockItemsInCart = cart.filter(item => !item.isService && item.sourceType !== 'Service');
        if (stockItemsInCart.length > 0) {
          const stockItemReads = stockItemsInCart.map(item => transaction.get(doc(firestore, getCollectionPath('stock'), item.id)));
          const stockItemDocs = await Promise.all(stockItemReads);

          for (let i = 0; i < stockItemDocs.length; i++) {
            const stockDoc = stockItemDocs[i];
            const itemInCart = stockItemsInCart[i];
            if (!stockDoc.exists() || stockDoc.data().quantity < itemInCart.sellQuantity) {
              throw new Error(`Not enough stock for ${itemInCart.name}. Available: ${stockDoc.data()?.quantity || 0}, In Cart: ${itemInCart.sellQuantity}`);
            }
          }
          // Deduct stock
          for (let i = 0; i < stockItemDocs.length; i++) {
            const stockDocRef = stockItemDocs[i].ref;
            const itemInCart = stockItemsInCart[i];
            transaction.update(stockDocRef, { quantity: increment(-itemInCart.sellQuantity) });
          }
        }

        const billItems = cart.map(item => ({
          id: item.isService ? `service-${item.id}` : item.id,
          name: item.name,
          price: item.price || item.sellingPrice,
          quantity: item.sellQuantity,
          paid: false,
          isService: item.isService,
          billId: billRef.id,
        }));

        transaction.set(billRef, {
          items: billItems,
          total: total,
          bookingId: bookingId,
          createdAt: serverTimestamp(),
          createdBy: userProfile?.uid,
          createdByName: userProfile?.name,
          paid: false,
        });

        const holdSaleData: Partial<HeldSale> = {
          id: holdSaleRef.id,
          name: `Billed to ${booking?.guestName || 'Guest'} - Room ${booking?.roomNumber || 'N/A'}`,
          heldAt: serverTimestamp() as any,
          cart: cart.map(i => ({
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
        };
        transaction.set(holdSaleRef, holdSaleData);
      });

      toast({ variant: 'success', title: 'Success', description: `The items have been added to the guest's room bill and a new running table has been created.` });

      clearCart();
      setIsPaymentOpen(false);
      setShowMergeDialog(false);
      setExistingBillToRoomTable(null);
      setPendingBillToRoomData(null);
      setSelectedBillToRoom(null);
      onSaleAction();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessSale = async (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit' | 'Unpaid', initialPaymentAmount?: number, initialPaymentMethod?: string, billToRoomBookingId?: string) => {
    if (paymentMethod === 'Bill to Room') {
        const bookingId = billToRoomBookingId || customer?.id;
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
              setPendingBillToRoomData({ bookingId, total, booking: booking || null });
              setShowMergeDialog(true);
              setIsProcessing(false);
              return;
            }

            // No existing table - create new one
            await runTransaction(firestore, async (transaction) => {
              const billRef = doc(collection(firestore, `bookings/${bookingId}/bills`));
              const holdSaleRef = doc(collection(firestore, getCollectionPath('heldSales')));

              // Deduct stock for non-service items
              const stockItemsInCart = cart.filter(item => !item.isService && item.sourceType !== 'Service');
              if (stockItemsInCart.length > 0) {
                const stockItemReads = stockItemsInCart.map(item => transaction.get(doc(firestore, getCollectionPath('stock'), item.id)));
                const stockItemDocs = await Promise.all(stockItemReads);

                for (let i = 0; i < stockItemDocs.length; i++) {
                  const stockDoc = stockItemDocs[i];
                  const itemInCart = stockItemsInCart[i];
                  if (!stockDoc.exists() || stockDoc.data().quantity < itemInCart.sellQuantity) {
                    throw new Error(`Not enough stock for ${itemInCart.name}. Available: ${stockDoc.data()?.quantity || 0}, In Cart: ${itemInCart.sellQuantity}`);
                  }
                }
                // Deduct stock
                for (let i = 0; i < stockItemDocs.length; i++) {
                  const stockDocRef = stockItemDocs[i].ref;
                  const itemInCart = stockItemsInCart[i];
                  transaction.update(stockDocRef, { quantity: increment(-itemInCart.sellQuantity) });
                }
              }

              const billItems = cart.map(item => ({
                  id: item.isService ? `service-${item.id}` : item.id,
                  name: item.name,
                  price: item.price || item.sellingPrice,
                  quantity: item.sellQuantity,
                  paid: false,
                  isService: item.isService,
                  billId: billRef.id,
              }));

              transaction.set(billRef, {
                  items: billItems,
                  total: total,
                  bookingId: bookingId,
                  createdAt: serverTimestamp(),
                  createdBy: userProfile?.uid,
                  createdByName: userProfile?.name,
                  paid: false,
              });

              const holdSaleData: Partial<HeldSale> = {
                id: holdSaleRef.id,
                name: `Billed to ${booking?.guestName || 'Guest'} - Room ${booking?.roomNumber || 'N/A'}`,
                heldAt: serverTimestamp() as any,
                cart: cart.map(i => ({
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
              };
              transaction.set(holdSaleRef, holdSaleData);
            });
            toast({ variant: 'success', title: 'Success', description: `The items have been added to the guest's room bill and a corresponding running table has been created.` });
            clearCart();
            setIsPaymentOpen(false);
            setSelectedBillToRoom(null);
            onSaleAction();
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsProcessing(false);
        }

    } else {
        setIsProcessing(true);
        try {
          const newSale = await processSale(total, paymentMethod, paymentStatus, context, initialPaymentAmount, initialPaymentMethod);
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

  const handleHoldSale = async (name: string, clearCartOnSuccess: boolean) => {
    setIsProcessing(true);
    const isUpdate = !!restoredSaleId;

    // Capture the cart items BEFORE the hold operation
    // These are the items we want to print in the docket
    const cartItemsBeforeHold = [...cart];

    try {
        // holdSale now returns the saleId
        const createdSaleId = await holdSale(name, clearCartOnSuccess);
        setIsHoldOpen(false);

        if (clearCartOnSuccess) {
            setActiveTab('new-sale');

            // Check if auto-generate receipt setting is enabled (default to true if not set)
            const autoGenerateReceipt = settings?.posAutoGenerateReceiptOnRunningTable !== false;

            // If auto-generate is enabled, automatically show the receipt
            if (autoGenerateReceipt && firestore && createdSaleId) {
                try {
                    const heldSaleDoc = await getDoc(doc(firestore, getCollectionPath('heldSales'), createdSaleId));
                    if (heldSaleDoc.exists()) {
                        const heldSaleData = { id: heldSaleDoc.id, ...heldSaleDoc.data() } as HeldSale;
                        setHeldSaleToPrint(heldSaleData);

                        // For new tables, pass all cart items as "new items" to print
                        // For updates, we show only the items that were in the cart before the hold (new additions)
                        const itemsToPrint = isUpdate ? cartItemsBeforeHold : cartItemsBeforeHold;
                        setNewItemsToPrint(itemsToPrint);

                        // Show toast notification about auto-generated receipt
                        toast({
                            variant: 'default',
                            title: 'Receipt Generated',
                            description: isUpdate
                                ? `A receipt has been generated for the new items added to "${heldSaleData.name}".`
                                : `A receipt has been generated for "${heldSaleData.name}".`,
                        });
                    }
                } catch (e) {
                    console.error('Error fetching held sale for receipt:', e);
                }
            }
        }
    } catch (error) {
        // Error handling is inside usePOS
    } finally {
        setIsProcessing(false);
    }
  };

  // Handler to mark new items as printed after printing the auto-generated receipt
  const handleMarkNewItemsPrinted = async (itemIds: string[]) => {
    if (!firestore || !heldSaleToPrint || itemIds.length === 0) return;

    try {
      const saleRef = doc(firestore, getCollectionPath('heldSales'), heldSaleToPrint.id);

      // CRITICAL FIX: Fetch the LATEST document from Firestore to avoid using stale local state
      const saleDoc = await getDoc(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Running table not found');
      }

      const currentCart = saleDoc.data()?.cart || [];

      // CRITICAL: Use the actual new items that were added (from newItemsToPrint state)
      // These items represent what was in the cart BEFORE the update
      // We need to find matching items in the current cart and add their quantities to printedQuantity
      const updatedCart = currentCart.map(item => {
        if (itemIds.includes(item.id)) {
          // This item was newly added/updated
          // Find the corresponding new item to get the actual quantity added
          const newItem = newItemsToPrint.find(n => n.id === item.id);
          if (newItem) {
            // Add the NEW item's quantity to the existing printedQuantity
            // The NEW item's printedQuantity is what should be added (it was 0 when added to cart)
            const existingPrinted = item.printedQuantity || 0;
            const newlyAddedQuantity = newItem.sellQuantity;
            const newPrinted = existingPrinted + newlyAddedQuantity;
            return {
              ...item,
              printedQuantity: newPrinted
            };
          }
        }
        return item;
      });

      await updateDoc(saleRef, { cart: updatedCart });

      // Update local state to reflect the change
      setHeldSaleToPrint(prev => prev ? { ...prev, cart: updatedCart } : null);

      toast({ variant: 'success', title: 'Print Status Updated', description: 'Items marked as printed.' });
    } catch (e) {
      console.error('Failed to update print status:', e);
      toast({ variant: 'destructive', title: 'Failed to update print status' });
    }
  };

  const selectedGuestName = React.useMemo(() => {
    if (!customer?.id || !activeBookings) {
      return "Select an active guest...";
    }
    const booking = activeBookings.find(b => b.id === customer.id);
    return booking ? `Room ${booking.roomNumber} - ${booking.guestName}` : "Select an active guest...";
  }, [customer, activeBookings]);

  const filteredBookings = React.useMemo(() => {
    if (!activeBookings) return [];
    if (!guestSearchTerm) return activeBookings;
    const lowerCaseSearch = guestSearchTerm.toLowerCase();
    return activeBookings.filter(booking =>
      booking.guestName?.toLowerCase().includes(lowerCaseSearch) ||
      booking.roomNumber?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [activeBookings, guestSearchTerm]);

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
         <TabsList className="grid w-full grid-cols-3 bg-card p-1 rounded-lg border shadow-sm">
            <TabsTrigger value="new-sale" className="relative">
              <ShoppingCart className="mr-2 h-4 w-4" /> New Sale
              {cart.length > 0 && activeRunningItems.length > 0 && (
                <AnimatePresence>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="ml-2"
                  >
                    <Badge variant="default" className="h-5 w-5 justify-center rounded-full p-0 bg-blue-500 text-xs">
                      {cart.length}
                    </Badge>
                  </motion.div>
                </AnimatePresence>
              )}
            </TabsTrigger>
            <TabsTrigger value="bill-to-room" className="relative">
              <Bed className="mr-2 h-4 w-4" /> Bill to Room
              {activeBookingsCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 justify-center rounded-full px-1.5 text-xs">
                  {activeBookingsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="on-hold-sales" className="relative">
              <div className="flex items-center">
                <List className="mr-2 h-4 w-4" /> Running Tables
               {heldSalesCount > 0 && (
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: ['0 0 0 0 rgba(239, 68, 68, 0.5)', '0 0 0 4px rgba(239, 68, 68, 0)', '0 0 0 0 rgba(239, 68, 68, 0)'],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="ml-2"
                >
                  <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs font-bold shadow-md">
                    <Bell className="h-3 w-3 mr-0.5 animate-[bellRing_0.5s_ease-in-out]" />
                    {heldSalesCount}
                  </Badge>
                </motion.div>
              )}
              {restoredSaleId && cart.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1"
                >
                  <Badge variant="default" className="h-5 px-2 text-[10px] bg-amber-500 animate-pulse shadow-md">
                    <BellRing className="h-3 w-3 mr-0.5" />
                    Update
                  </Badge>
                </motion.div>
              )}
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="new-sale" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                <ProductGrid onAddToCart={addToCart} reloadTrigger={reloadProducts} />
                </div>
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {context === 'hotel' ? (
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
                                    <div className="p-2 border-b">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by room or guest..."
                                                value={guestSearchTerm}
                                                onChange={(e) => setGuestSearchTerm(e.target.value)}
                                                className="pl-8 h-9"
                                            />
                                        </div>
                                    </div>
                                    <ScrollArea className="h-[200px]">
                                        {filteredBookings.length === 0 && !guestSearchTerm ? (
                                            <div className="py-6 text-center text-sm text-muted-foreground">No active guests found.</div>
                                        ) : filteredBookings.length === 0 ? (
                                            <div className="py-6 text-center text-sm text-muted-foreground">No matching guests found.</div>
                                        ) : (
                                            <div className="p-1">
                                                <div
                                                    className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors active:bg-accent/80"
                                                    onClick={() => {
                                                        setCustomer(null);
                                                        setIsGuestSelectorOpen(false);
                                                        setGuestSearchTerm('');
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        e.preventDefault();
                                                        setCustomer(null);
                                                        setIsGuestSelectorOpen(false);
                                                        setGuestSearchTerm('');
                                                    }}
                                                >
                                                    <Check className={cn("h-4 w-4", !customer?.id ? "opacity-100" : "opacity-0")} />
                                                    <span className="text-sm">None (Walk-in Sale)</span>
                                                </div>
                                                {filteredBookings.map((booking) => (
                                                    <div
                                                        key={booking.id}
                                                        className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors active:bg-accent/80"
                                                        onClick={() => {
                                                            setCustomer({ id: booking.id, name: booking.guestName, email: booking.guestEmail });
                                                            setIsGuestSelectorOpen(false);
                                                            setGuestSearchTerm('');
                                                        }}
                                                        onTouchEnd={(e) => {
                                                            e.preventDefault();
                                                            setCustomer({ id: booking.id, name: booking.guestName, email: booking.guestEmail });
                                                            setIsGuestSelectorOpen(false);
                                                            setGuestSearchTerm('');
                                                        }}
                                                    >
                                                        <Check className={cn("h-4 w-4", customer?.id === booking.id ? "opacity-100" : "opacity-0")} />
                                                        <span className="text-sm">Room {booking.roomNumber} - {booking.guestName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                        </div>
                    ) : (
                        <CustomerPanel
                            selectedCustomer={customer}
                            onSelectCustomer={setCustomer}
                            isSaleRestored={!!restoredSaleId}
                            onCustomerAdded={() => setInternalReloadProducts(c => c + 1)}
                        />
                    )}
                <Cart
                    cart={cart}
                    activeRunningItems={activeRunningItems}
                    onRemoveItem={removeFromCart}
                    onUpdateQuantity={updateQuantity}
                    onClearCart={clearCart}
                    onHold={() => setIsHoldOpen(true)}
                    onPay={() => setIsPaymentOpen(true)}
                    isRestored={!!pos.restoredSaleId}
                    onApplyDiscount={pos.applyDiscount}
                    removeDiscount={pos.removeDiscount}
                    discount={pos.discount}
                    customer={customer}
                    onRemoveFromActiveRunningItems={removeFromActiveRunningItems}
                />
                </div>
            </div>
          </TabsContent>
          <TabsContent value="bill-to-room" className="mt-6">
            <BillToRoomSection
              selectedRoomId={selectedBillToRoom?.id || null}
              onSelectRoom={(booking) => setSelectedBillToRoom(booking)}
              onBillToRoom={handleBillToRoomSelect}
            />
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
        allowBillToRoom={true}
      />
      <HoldSaleDialog
        isOpen={isHoldOpen}
        onClose={() => setIsHoldOpen(false)}
        onConfirm={handleHoldSale}
        isProcessing={isProcessing}
        customer={customer}
        isUpdate={!!restoredSaleId}
      />
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
        customerBalance={customer?.outstandingBalance}
        allUsers={allUsers}
        dataReady={!!allUsers}
      />
      <HeldSaleReceiptDialog
        isOpen={!!heldSaleToPrint}
        onClose={() => {
          setHeldSaleToPrint(null);
          setNewItemsToPrint([]);
        }}
        heldSale={heldSaleToPrint}
        newItemsOnly={newItemsToPrint.length > 0 ? newItemsToPrint : undefined}
        onMarkPrinted={handleMarkNewItemsPrinted}
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
        newItems={cart}
        roomNumber={pendingBillToRoomData?.booking?.roomNumber || ''}
        guestName={pendingBillToRoomData?.booking?.guestName || ''}
        isProcessing={isProcessing}
      />
    </>
  );
}
