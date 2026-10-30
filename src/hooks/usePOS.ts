
'use client';

import * as React from 'react';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  addDoc,
  deleteDoc,
  writeBatch,
  increment,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { CartItem, Customer, StockItem, StockSale, HeldSale, UserProfile, Payment, UnifiedItem, Bill } from '@/lib/types';
import { useToast } from './use-toast';
import { useBranch } from '@/contexts/branch-context';
import { getNewDocumentData } from '@/lib/branch-helpers';

interface UsePOSProps {
  userProfile: UserProfile | null;
  toast: ReturnType<typeof useToast>['toast'];
}

export const usePOS = ({ userProfile, toast }: UsePOSProps) => {
  const [cart, setCart] = React.useState<UnifiedItem[]>([]);
  const [activeRunningItems, setActiveRunningItems] = React.useState<UnifiedItem[]>([]);
  const [customer, setCustomer] = React.useState<(Partial<Customer> & { outstandingBalance?: number }) | null>({ name: 'Walk-in Customer' });
  const [restoredSaleId, setRestoredSaleId] = React.useState<string | null>(null);
  const [restoredSaleData, setRestoredSaleData] = React.useState<HeldSale | null>(null);
  const [holdName, setHoldName] = React.useState<string | undefined>(undefined);
  const [discount, setDiscount] = React.useState<{ type: 'percentage' | 'amount'; value: number } | null>(null);

  const firestore = useFirestore();
  const branchContext = useBranch();
  const { getCollectionPath } = branchContext;

  const applyDiscount = (type: 'percentage' | 'amount', value: number) => {
    setDiscount({ type, value });
  };

  const removeDiscount = () => {
    setDiscount(null);
  };

  const removeFromActiveRunningItems = (itemId: string) => {
    setActiveRunningItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearActiveRunningItems = () => {
    setActiveRunningItems([]);
  };

  const addToCart = async (item: UnifiedItem) => {
    const hasFiniteStock = item.quantity !== Infinity;

    // Fetch current stock from Firestore to ensure accurate validation
    let currentStock = item.quantity;
    if (hasFiniteStock && firestore) {
      try {
        const stockDoc = await getDoc(doc(firestore, getCollectionPath('stock'), item.id));
        if (stockDoc.exists()) {
          currentStock = stockDoc.data().quantity;
        }
      } catch (e) {
        console.error('Error fetching current stock:', e);
      }
    }

    if (hasFiniteStock && currentStock <= 0) {
      toast({
        variant: 'destructive',
        title: 'Out of Stock',
        description: `"${item.name}" is currently out of stock.`,
      });
      return;
    }

    // Calculate total quantity across both cart and activeRunningItems
    const totalInCart = cart.find((cartItem) => cartItem.id === item.id)?.sellQuantity || 0;
    const totalInRunning = activeRunningItems.find((runningItem) => runningItem.id === item.id)?.sellQuantity || 0;

    // Calculate how many more can be added:
    // - Items in activeRunningItems have already been deducted from stock
    // - So we can add up to (currentStock + totalInRunning) total
    const maxAllowed = hasFiniteStock ? currentStock + totalInRunning : Infinity;
    const totalExisting = totalInCart + totalInRunning;

    // Always add to Current Sale (cart), not Active Running Table
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        // Check stock limit considering both cart and active running items
        if (hasFiniteStock && totalExisting >= maxAllowed) {
          toast({
            variant: 'warning',
            title: 'Stock Limit Reached',
            description: `No more units of "${item.name}" available in stock.`,
          });
          return prevCart;
        }
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, sellQuantity: cartItem.sellQuantity + 1 }
            : cartItem
        );
      }
      // For new item, check if already in active running items
      if (hasFiniteStock && totalInRunning >= maxAllowed) {
        toast({
          variant: 'warning',
          title: 'Stock Limit Reached',
          description: `No more units of "${item.name}" available in stock.`,
        });
        return prevCart;
      }
      return [...prevCart, { ...item, sellQuantity: 1, printedQuantity: 0 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    const itemInCart = cart.find(i => i.id === itemId);
    if (!itemInCart) return;

    if (restoredSaleId) {
      const printedQty = itemInCart.printedQuantity || 0;
      if (printedQty > 0) {
        toast({
          variant: 'destructive',
          title: 'Action Blocked',
          description: `Cannot remove "${itemInCart.name}" as a docket has already been printed for it.`,
        });
        return;
      }
    }
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    const itemInCart = cart.find((i) => i.id === itemId);
    if (!itemInCart) return;

    const printedQty = itemInCart.printedQuantity || 0;

    if (restoredSaleId && quantity < printedQty) {
      toast({
        variant: 'destructive',
        title: 'Action Blocked',
        description: `Cannot reduce quantity below the printed amount (${printedQty}) for "${itemInCart.name}".`,
      });
      setCart((prevCart) =>
        prevCart.map((i) =>
          i.id === itemId ? { ...i, sellQuantity: printedQty } : i
        )
      );
      return;
    }

    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    // Fetch current stock from Firestore to ensure accurate validation
    let currentStock = itemInCart.quantity;
    const hasFiniteStock = itemInCart.quantity !== Infinity;

    if (hasFiniteStock && firestore) {
      try {
        const stockDoc = await getDoc(doc(firestore, getCollectionPath('stock'), itemId));
        if (stockDoc.exists()) {
          currentStock = stockDoc.data().quantity;
        }
      } catch (e) {
        console.error('Error fetching current stock:', e);
      }
    }

    // Calculate how many can be in the cart:
    // - Items in activeRunningItems have already been deducted from stock
    // - So cart can have up to (currentStock + totalInRunning) total
    const totalInRunning = activeRunningItems.find((runningItem) => runningItem.id === itemId)?.sellQuantity || 0;
    const maxAllowed = hasFiniteStock ? currentStock + totalInRunning : Infinity;

    if (hasFiniteStock && quantity > maxAllowed) {
        toast({
            variant: 'warning',
            title: 'Stock Limit Reached',
            description: `Only ${maxAllowed} units of "${itemInCart.name}" are available.`,
        });
        setCart((prevCart) =>
            prevCart.map((i) => (i.id === itemId ? { ...i, sellQuantity: maxAllowed } : i))
        );
        return;
    }

    setCart((prevCart) =>
      prevCart.map((i) =>
        i.id === itemId ? { ...i, sellQuantity: quantity } : i
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setActiveRunningItems([]);
    setCustomer({ name: 'Walk-in Customer' });
    setRestoredSaleId(null);
    setRestoredSaleData(null);
    setHoldName(undefined);
    setDiscount(null);
  };

  const holdSale = async (name: string, clearCartOnSuccess: boolean) => {
    if (!firestore || !userProfile) throw new Error('System not ready.');

    const allItems = [...activeRunningItems, ...cart];
    if (allItems.length === 0) {
      toast({ variant: 'destructive', title: 'Cart is empty' });
      return;
    }

    // Combine items with the same ID by summing their sellQuantity
    // IMPORTANT: Preserve printedQuantity from existing items (from activeRunningItems)
    // Items from cart (new items) start with printedQuantity: 0
    const combinedItems = allItems.reduce((acc, item) => {
      const existingItem = acc.find((i) => i.id === item.id);
      if (existingItem) {
        // Sum the sellQuantity
        existingItem.sellQuantity += item.sellQuantity;
        // Preserve the existing printedQuantity (from the restored sale)
        // New items from cart have printedQuantity: 0, but we keep the existing value
        // which represents items that were already printed in previous dockets
      } else {
        // For new items in the accumulator, ensure printedQuantity is set
        // Items from activeRunningItems already have their printedQuantity set
        // Items from cart (new additions) have printedQuantity: 0
        acc.push({ ...item, printedQuantity: item.printedQuantity || 0 });
      }
      return acc;
    }, [] as UnifiedItem[]);

    try {
        // Declare saleId outside the transaction so it's available for the return statement
        let saleId = restoredSaleId || `HELD-${Date.now().toString().slice(-6)}`;
        await runTransaction(firestore, async (transaction) => {
            const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), saleId);

            // ===== PHASE 1: Perform ALL reads first =====
            let originalHeldSaleDoc = null;
            let billDoc = null;
            let stockDocs: Array<{ ref: any; data: any }> = [];

            if (restoredSaleId && restoredSaleData) {
                originalHeldSaleDoc = await transaction.get(heldSaleRef);
                if (!originalHeldSaleDoc.exists()) throw new Error("Original running table not found.");

                if (restoredSaleData.linkedBillId && restoredSaleData.customer?.id) {
                    const billRef = doc(firestore, `bookings/${restoredSaleData.customer.id}/bills`, restoredSaleData.linkedBillId);
                    billDoc = await transaction.get(billRef);
                }
            } else {
                // New running table - read all stock docs
                const stockItemsInCart = combinedItems.filter(item => !item.isService);
                for (const cartItem of stockItemsInCart) {
                    const stockDocRef = doc(firestore, getCollectionPath('stock'), cartItem.id);
                    const stockDoc = await transaction.get(stockDocRef);
                    if (!stockDoc.exists() || stockDoc.data().quantity < cartItem.sellQuantity) {
                        throw new Error(`Not enough stock for ${cartItem.name}. Available: ${stockDoc.data()?.quantity || 0}, In Cart: ${cartItem.sellQuantity}`);
                    }
                    stockDocs.push({ ref: stockDocRef, data: stockDoc.data() });
                }
            }

            // ===== PHASE 2: Perform ALL writes =====
            if (restoredSaleId && restoredSaleData) {
                if (restoredSaleData.linkedBillId && restoredSaleData.customer?.id && billDoc && billDoc.exists()) {
                    // Get existing bill items to preserve printedQuantity
                    const existingBill = billDoc.data() as any;
                    const existingBillItems = existingBill.items || [];

                    const newBillItems = combinedItems.map(item => {
                        // Find existing item in bill to preserve printedQuantity
                        const existingItem = existingBillItems.find((bi: any) => bi.name === item.name);
                        return {
                            id: item.isService ? `service-${saleId}-${item.id}` : `order-${restoredSaleData.name.split('-').pop()}-${item.id}`,
                            name: item.name,
                            price: item.price || item.sellingPrice,
                            quantity: item.sellQuantity,
                            printedQuantity: existingItem?.printedQuantity || 0, // Preserve printed quantity
                            paid: false,
                            isService: item.isService,
                            billId: billDoc.ref.id,
                        };
                    });
                    const newTotal = newBillItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    transaction.update(billDoc.ref, { items: newBillItems, total: newTotal });
                } else if (originalHeldSaleDoc) {
                    // It's a regular running table, so adjust stock
                    const originalCart = originalHeldSaleDoc.data().cart as CartItem[];
                    // Return old items to stock
                    for (const oldItem of originalCart.filter(i => !i.isService)) {
                        transaction.update(doc(firestore, getCollectionPath('stock'), oldItem.id), { quantity: increment(oldItem.sellQuantity) });
                    }
                    // Remove new items from stock
                    for (const newItem of combinedItems.filter(i => !i.isService)) {
                        transaction.update(doc(firestore, getCollectionPath('stock'), newItem.id), { quantity: increment(-newItem.sellQuantity) });
                    }
                }
            } else {
                // New running table - update stock
                for (const stockItem of stockDocs) {
                    transaction.update(stockItem.ref, { quantity: increment(-combinedItems.find(i => i.id === stockItem.ref.id)?.sellQuantity || 0) });
                }
            }

            const baseHeldSaleData: Partial<HeldSale> = {
                id: saleId,
                name: name,
                cart: combinedItems.map(i => ({...i})),
                customer: customer?.id ? { id: customer.id, name: customer.name || "Walk-in Customer" } : { name: name || "Walk-in Customer" },
                heldByUid: userProfile.uid,
                heldByName: userProfile.name,
                heldAt: serverTimestamp() as any,
                printStatus: 'pending',
            };

            if (restoredSaleData?.linkedBillId) {
                baseHeldSaleData.linkedBillId = restoredSaleData.linkedBillId;
            }

            const heldSaleData = getNewDocumentData(baseHeldSaleData, branchContext);
            transaction.set(heldSaleRef, heldSaleData, { merge: true });
        });

        toast({ variant: 'success', title: 'Table Added', description: `The table "${name}" has been ${restoredSaleId ? 'updated' : 'added to running tables.'}.` });

        if (clearCartOnSuccess) {
          clearCart();
        }

        return saleId;
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Failed to Add Table', description: e.message });
        throw e;
    }
  };

  const deleteHeldSale = async (saleToDelete: HeldSale): Promise<void> => {
    if (!firestore) throw new Error('Firestore is not initialized.');

    await runTransaction(firestore, async (transaction) => {
      const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), saleToDelete.id);

      // ===== PHASE 1: Perform ALL reads first =====
      const heldSaleDoc = await transaction.get(heldSaleRef);

      if (!heldSaleDoc.exists()) {
        throw new Error("Running table not found.");
      }

      const saleData = heldSaleDoc.data() as HeldSale;
      let billDoc = null;
      let stockItemDocs = [];

      // If it was billed to a room, read the bill
      if (saleData.linkedBillId && saleData.customer?.id) {
          const billRef = doc(firestore, `bookings/${saleData.customer.id}/bills`, saleData.linkedBillId);
          billDoc = await transaction.get(billRef);
      } else if (!saleData.isCreditSale) {
        // Only return stock to inventory for non-credit sales
        // For credit sales, stock was already deducted when the sale was processed
        const itemsToReturnToStock = saleData.cart.filter(item => !item.isService);
        if (itemsToReturnToStock.length > 0) {
            const stockItemRefs = itemsToReturnToStock.map(item => doc(firestore, getCollectionPath('stock'), item.id));
            stockItemDocs = await Promise.all(stockItemRefs.map(ref => transaction.get(ref)));
        }
      }

      // ===== PHASE 2: Perform ALL writes =====
      if (saleData.linkedBillId && saleData.customer?.id) {
          if (billDoc && billDoc.exists()) {
            transaction.delete(billDoc.ref);
          }
      } else if (!saleData.isCreditSale) {
        // Only return items to stock for non-credit sales
        // For credit sales, stock was already deducted when the sale was processed
        for (let i = 0; i < stockItemDocs.length; i++) {
            const stockDoc = stockItemDocs[i];
            const cartItem = saleData.cart.filter(item => !item.isService)[i];
            if (stockDoc.exists()) {
                transaction.update(stockDoc.ref, { quantity: increment(cartItem.sellQuantity) });
            }
        }
      }
      transaction.delete(heldSaleRef);
    });
  };

  const processSale = async (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit' | 'Unpaid', context: 'hotel' | 'pos' = 'pos', initialPaymentAmount?: number, initialPaymentMethod?: string): Promise<StockSale> => {
    if (!firestore || !userProfile) throw new Error('System not ready.');

    const allItems = [...activeRunningItems, ...cart];

    try {
        let createdSale: StockSale | null = null;

        const executeSaleWrites = async () => {
          const newSaleRef = doc(collection(firestore, getCollectionPath('stockSales')));
          const newSaleId = `SALE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

          const baseSaleData: StockSale = {
              id: newSaleRef.id,
              saleId: newSaleId,
              items: allItems.map(item => ({
                  itemId: item.id,
                  itemName: item.name,
                  quantity: item.sellQuantity,
                  sellingPrice: item.price || item.sellingPrice,
                  costPrice: item.costPrice || 0,
                  isService: item.isService || false,
              })),
              totalAmount: total,
              paymentMethod: paymentMethod as any,
              paymentStatus,
              soldAt: new Date() as any,
              soldByUid: userProfile.uid,
              soldByName: userProfile.name,
              customerId: customer?.id || null,
              customerName: customer?.name || 'Walk-in Customer',
              customerEmail: customer?.email || null,
              initialPaymentAmount: initialPaymentAmount || null,
              discountType: discount?.type || null,
              discountValue: discount?.value || null,
              context: context,
              printStatus: 'pending',
          };

          const saleData = getNewDocumentData(baseSaleData, branchContext);
          await setDoc(newSaleRef, saleData);

          // Save sale mutation in Local Master PC LAN Store for 100% offline multi-device sync
          try {
            await fetch('/api/lan-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                collectionName: getCollectionPath('stockSales'),
                docId: newSaleRef.id,
                action: 'set',
                data: saleData,
              }),
            });
          } catch {}

          const amountPaid = paymentStatus === 'Paid' ? total : initialPaymentAmount;
          if (amountPaid && amountPaid > 0) {
              const paymentRef = doc(collection(firestore, 'payments'));
              const paymentData: Omit<Payment, 'id'> = {
                  bookingId: newSaleRef.id,
                  guestName: saleData.customerName,
                  guestEmail: saleData.customerEmail || null,
                  amount: amountPaid,
                  paymentMethod: paymentMethod === 'Credit' ? (initialPaymentAmount && initialPaymentAmount > 0 ? (initialPaymentMethod || 'Cash') : 'Credit') : paymentMethod as any,
                  status: 'Paid',
                  transactionDate: new Date(),
                  type: 'POS',
                  createdByUid: userProfile.uid,
                  createdByName: userProfile.name,
                  items: saleData.items,
                  profit: saleData.items.reduce((acc, item) => acc + ((item.sellingPrice - (item.costPrice || 0)) * item.quantity), 0),
              };
              await setDoc(paymentRef, paymentData);

              try {
                await fetch('/api/lan-sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    collectionName: 'payments',
                    docId: paymentRef.id,
                    action: 'set',
                    data: paymentData,
                  }),
                });
              } catch {}
          }

          if (restoredSaleId) {
              const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), restoredSaleId);
              await deleteDoc(heldSaleRef);
              try {
                await fetch('/api/lan-sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    collectionName: getCollectionPath('heldSales'),
                    docId: restoredSaleId,
                    action: 'delete',
                  }),
                });
              } catch {}
          }

          return { ...saleData, soldAt: new Date() };
        };

        try {
          if (navigator.onLine) {
            await runTransaction(firestore, async (transaction) => {
                const newSaleRef = doc(collection(firestore, getCollectionPath('stockSales')));
                const newSaleId = `SALE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

                const baseSaleData: StockSale = {
                    id: newSaleRef.id,
                    saleId: newSaleId,
                    items: allItems.map(item => ({
                        itemId: item.id,
                        itemName: item.name,
                        quantity: item.sellQuantity,
                        sellingPrice: item.price || item.sellingPrice,
                        costPrice: item.costPrice || 0,
                        isService: item.isService || false,
                    })),
                    totalAmount: total,
                    paymentMethod: paymentMethod as any,
                    paymentStatus,
                    soldAt: serverTimestamp() as any,
                    soldByUid: userProfile.uid,
                    soldByName: userProfile.name,
                    customerId: customer?.id || null,
                    customerName: customer?.name || 'Walk-in Customer',
                    customerEmail: customer?.email || null,
                    initialPaymentAmount: initialPaymentAmount || null,
                    discountType: discount?.type || null,
                    discountValue: discount?.value || null,
                    context: context,
                    printStatus: 'pending',
                };

                const saleData = getNewDocumentData(baseSaleData, branchContext);
                transaction.set(newSaleRef, saleData);

                if (restoredSaleId) {
                    const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), restoredSaleId);
                    transaction.delete(heldSaleRef);
                }

                createdSale = { ...saleData, soldAt: new Date() };
            });
          } else {
            createdSale = await executeSaleWrites();
          }
        } catch (trxErr) {
          console.warn('[POS Offline Mode] Transaction failed/offline. Executing direct local sale writes:', trxErr);
          createdSale = await executeSaleWrites();
        }

        clearCart();
        if (!createdSale) {
            throw new Error("Sale creation failed within the transaction.");
        }
        return createdSale;

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Sale Failed', description: e.message });
        throw e;
    }
  }

  const restoreHeldSale = (heldSale: HeldSale) => {
    setActiveRunningItems(heldSale.cart);
    setCart([]);
    setCustomer(heldSale.customer || { name: 'Walk-in Customer' });
    setRestoredSaleId(heldSale.id);
    setRestoredSaleData(heldSale);
    setHoldName(heldSale.name);
    toast({
        title: "Table Loaded",
        description: `Table "${heldSale.name}" is now active. Add new items to update it.`
    });
  }

  const getCustomerFinancials = React.useCallback(async () => {
    if (!firestore) {
      console.error("Firestore is not initialized.");
      return [];
    }

    try {
      const customersRef = collection(firestore, getCollectionPath('posCustomers'));
      const customerSnapshot = await getDocs(customersRef);
      const customers = customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];

      // Stock sales are branch-isolated, use the branch path
      const salesRef = collection(firestore, getCollectionPath('stockSales'));
      const salesSnapshot = await getDocs(salesRef);
      const allSales = salesSnapshot.docs.map(doc => doc.data() as StockSale);

      // Payments are stored at root level (not branch-isolated)
      const paymentsRef = collection(firestore, 'payments');
      const paymentsSnapshot = await getDocs(paymentsRef);
      const allPayments = paymentsSnapshot.docs
        .map(doc => doc.data() as Payment)
        // Filter for POS payments and credit repayments that match this branch
        // Also check for sales within this branch context
        .filter(p => {
          // Only POS and Credit Repayment payment types
          if (p.type !== 'POS' && p.type !== 'Credit Repayment') return false;

          // Get the bookingId which should be the stockSale ID
          if (!p.bookingId) return false;

          // Check if this payment is related to a sale in our current branch
          // by looking at the sales we fetched
          const relatedSale = allSales.find(s => s.id === p.bookingId);
          return !!relatedSale;
        });

      const customerData = customers.map(customer => {
        // Filter sales for this customer - match by customerId or customerEmail
        const customerSales = allSales.filter(sale =>
          sale.customerId === customer.id ||
          (sale.customerEmail && sale.customerEmail === customer.email)
        );

        const totalPurchases = customerSales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0);

        // For payments, match by bookingId being one of the customer's sales
        const customerPaymentIds = new Set(customerSales.map(s => s.id));
        const customerPayments = allPayments.filter(p => customerPaymentIds.has(p.bookingId!));

        const totalPayments = customerPayments.reduce((acc, payment) => acc + (payment.amount || 0), 0);

        const outstandingBalance = totalPurchases - totalPayments;

        return {
          ...customer,
          totalSpent: totalPurchases,
          totalPaid: totalPayments,
          outstandingBalance,
        };
      });

      return customerData;

    } catch (error) {
      console.error("Error fetching customer financials: ", error);
      // Return basic customer data without financials on error
      const customersRef = collection(firestore, getCollectionPath('posCustomers'));
      const customerSnapshot = await getDocs(customersRef);
      return customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
    }
  }, [firestore, getCollectionPath]);

  return {
    cart,
    activeRunningItems,
    customer,
    setCustomer,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    holdSale,
    deleteHeldSale,
    processSale,
    restoreHeldSale,
    restoredSaleId,
    holdName,
    discount,
    applyDiscount,
    removeDiscount,
    getCustomerFinancials,
    removeFromActiveRunningItems,
    clearActiveRunningItems,
  };
};
