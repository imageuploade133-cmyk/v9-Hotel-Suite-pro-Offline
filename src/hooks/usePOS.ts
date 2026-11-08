
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
  getDocsFromCache,
  query,
  where,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { CartItem, Customer, StockItem, StockSale, HeldSale, UserProfile, Payment, UnifiedItem, Bill } from '@/lib/types';
import { useToast } from './use-toast';
import { useBranch } from '@/contexts/branch-context';
import { getNewDocumentData } from '@/lib/branch-helpers';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';

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
  const { data: globalStockSales, isLoading: isLoadingGlobalStockSales } = useGlobalCollectionData<StockSale>('stockSales');
  const { data: globalPosCustomers, isLoading: isLoadingGlobalPosCustomers } = useGlobalCollectionData<Customer>('posCustomers');

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

    // Fetch current stock from Firestore/LAN to ensure accurate validation
    let currentStock = item.quantity;
    if (hasFiniteStock) {
      if (firestore && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const fetchPromise = getDoc(doc(firestore, getCollectionPath('stock'), item.id));
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800));
          const stockDoc = await Promise.race([fetchPromise, timeoutPromise]);
          if (stockDoc && stockDoc.exists()) {
            currentStock = stockDoc.data().quantity;
          }
        } catch (e) {
          console.warn('Error fetching current stock from firestore:', e);
        }
      } else {
        // Query LAN store if offline
        try {
          const lanRes = await fetch(`/api/lan-sync/?collection=${encodeURIComponent(getCollectionPath('stock'))}`);
          if (lanRes.ok) {
            const json = await lanRes.json();
            if (json.data && json.data[item.id]) {
              currentStock = json.data[item.id].quantity ?? json.data[item.id].stockCount ?? currentStock;
            }
          }
        } catch {}
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

    // Fetch current stock from Firestore/LAN to ensure accurate validation
    let currentStock = itemInCart.quantity;
    const hasFiniteStock = itemInCart.quantity !== Infinity;

    if (hasFiniteStock) {
      if (firestore && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const fetchPromise = getDoc(doc(firestore, getCollectionPath('stock'), itemId));
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800));
          const stockDoc = await Promise.race([fetchPromise, timeoutPromise]);
          if (stockDoc && stockDoc.exists()) {
            currentStock = stockDoc.data().quantity;
          }
        } catch (e) {
          console.warn('Error fetching current stock from firestore:', e);
        }
      } else {
        // Query LAN store if offline
        try {
          const lanRes = await fetch(`/api/lan-sync/?collection=${encodeURIComponent(getCollectionPath('stock'))}`);
          if (lanRes.ok) {
            const json = await lanRes.json();
            if (json.data && json.data[itemId]) {
              currentStock = json.data[itemId].quantity ?? json.data[itemId].stockCount ?? currentStock;
            }
          }
        } catch {}
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

    try {

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

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const currentUid = userProfile.uid || (userProfile as any).id;
    let saleId = restoredSaleId || `HELD-${Date.now().toString().slice(-6)}`;

    const executeOfflineHoldWrites = async () => {
        if (restoredSaleData?.linkedBillId) {
          throw new Error('This running table is linked to a room bill. Offline room-bill updates are not yet enabled, so no changes were saved.');
        }
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), saleId);
        const baseHeldSaleData: Partial<HeldSale> = {
            id: saleId,
            name,
            cart: combinedItems.map(item => ({ ...item })),
            customer: customer?.id
              ? { id: customer.id, name: customer.name || 'Walk-in Customer' }
              : { name: name || 'Walk-in Customer' },
            heldByUid: currentUid,
            heldByName: userProfile.name,
            heldAt: new Date() as any,
            printStatus: 'pending',
        };
        if (restoredSaleData?.linkedBillId) baseHeldSaleData.linkedBillId = restoredSaleData.linkedBillId;
        const heldSaleData = getNewDocumentData(baseHeldSaleData, branchContext);

        const stockAdjustments: { collectionName: string; itemId: string; quantityDelta: number }[] = [];
        if (!restoredSaleData?.linkedBillId) {
          if (restoredSaleId && restoredSaleData) {
            restoredSaleData.cart.filter(item => !item.isService).forEach(item => {
              stockAdjustments.push({
                collectionName: getCollectionPath('stock'),
                itemId: item.id,
                quantityDelta: Number(item.sellQuantity || 0),
              });
            });
          }
          combinedItems.filter(item => !item.isService).forEach(item => {
            stockAdjustments.push({
              collectionName: getCollectionPath('stock'),
              itemId: item.id,
              quantityDelta: -Number(item.sellQuantity || 0),
            });
          });
        }

        const response = await fetch('/api/lan-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionKey: `held-table-${saleId}-${Date.now()}`,
            mutations: [{
              collectionName: getCollectionPath('heldSales'),
              docId: heldSaleRef.id,
              action: 'set',
              data: heldSaleData,
            }],
            stockAdjustments,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.success !== true || result?.durable !== true) {
          throw new Error(result?.error || 'The Local Master PC did not confirm that the running table was saved.');
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetch('/api/lan-sync/cloud-sync', { method: 'POST' }).catch(() => {});
        }
    };
        let localMasterAvailable = false;
        if (!isOffline) {
          try {
            const masterStatus = await fetch('/api/lan-sync', { cache: 'no-store' });
            if (masterStatus.ok) {
              const statusPayload = await masterStatus.json();
              localMasterAvailable = statusPayload?.success === true && statusPayload?.mode === 'LAN_MASTER_SERVER';
            }
          } catch {
            localMasterAvailable = false;
          }
        }

        // Regular running tables are saved to the Master PC first when
        // connected to the hotel LAN. Room-bill tables keep their existing
        // Firestore transaction until the linked bill is migrated atomically.
        if (isOffline || (localMasterAvailable && !restoredSaleData?.linkedBillId)) {
            await executeOfflineHoldWrites();
        } else {
            try {
                const txPromise = runTransaction(firestore, async (transaction) => {
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
                heldByUid: currentUid,
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

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Transaction network timeout')), 1500)
                );

                await Promise.race([txPromise, timeoutPromise]);
            } catch (txErr) {
                console.warn('[HoldSale] Online transaction failed/timed out, falling back to offline LAN writes:', txErr);
                await executeOfflineHoldWrites();
            }
        }

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

  const processSale = async (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit' | 'Unpaid', context: 'hotel' | 'pos' = 'pos', initialPaymentAmount?: number, initialPaymentMethod?: string, applyExcessToOutstanding = false, totalTenderedAmount?: number): Promise<StockSale> => {
    if (!firestore || !userProfile) throw new Error('System not ready.');
    const isAdminIdentity = userProfile.isFirebaseOnlyAdmin === true
      || userProfile.isSuperAdmin === true
      || userProfile.role === 'Admin'
      || userProfile.role === 'Super Admin';
    if (paymentMethod === 'Credit' && !customer?.id) {
      toast({ variant: 'destructive', title: 'Customer Required', description: 'Select an existing registered customer before completing a credit sale.' });
      throw new Error('A registered customer is required for credit sales.');
    }
    if (paymentMethod === 'Credit' && !isAdminIdentity
      && !userProfile.permissions?.includes('create:credit_sales')) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to create credit sales.' });
      throw new Error('You do not have permission to create credit sales.');
    }

    const allItems = [...activeRunningItems, ...cart];

    const loadCreditSettlement = async () => {
      if (paymentMethod !== 'Credit' || !customer?.id) return null;
      const salesCollection = collection(firestore, getCollectionPath('stockSales'));
      const paymentCollection = collection(firestore, 'payments');
      const branchPaymentCollection = collection(firestore, getCollectionPath('payments'));
      const salesQueries = [
        query(salesCollection, where('customerId', '==', customer.id)),
        ...(customer.email ? [query(salesCollection, where('customerEmail', '==', customer.email))] : []),
      ];
      const paymentCollections = paymentCollection.path === branchPaymentCollection.path
        ? [paymentCollection]
        : [paymentCollection, branchPaymentCollection];
      const paymentQueries = paymentCollections.flatMap(source => [
        query(source, where('customerId', '==', customer.id)),
        ...(customer.email ? [query(source, where('guestEmail', '==', customer.email))] : []),
      ]);
      const readWithCacheFallback = async (target: any): Promise<{ docs: any[]; verified: boolean }> => {
        try {
          const snapshot = await getDocs(target);
          return { docs: snapshot.docs, verified: true };
        } catch {
          try {
            const snapshot = await getDocsFromCache(target);
            return { docs: snapshot.docs, verified: true };
          } catch {
            // Do not treat an unavailable collection as a verified empty ledger.
            return { docs: [], verified: false };
          }
        }
      };
      const readLanCollection = async (collectionName: string): Promise<{ documents: { id: string; data: Record<string, any> }[]; verified: boolean }> => {
        try {
          const response = await fetch(`/api/lan-sync?collection=${encodeURIComponent(collectionName)}`, { cache: 'no-store' });
          if (!response.ok) return { documents: [], verified: false };
          const payload = await response.json();
          if (!payload?.success || !payload?.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
            return { documents: [], verified: false };
          }
          return {
            documents: Object.entries(payload.data).map(([id, data]) => ({ id, data: data as Record<string, any> })),
            verified: true,
          };
        } catch {
          return { documents: [], verified: false };
        }
      };
      const [salesSnapshots, paymentSnapshots, lanSales, ...lanPaymentGroups] = await Promise.all([
        Promise.all(salesQueries.map(readWithCacheFallback)),
        Promise.all(paymentQueries.map(readWithCacheFallback)),
        readLanCollection(getCollectionPath('stockSales')),
        ...paymentCollections.map(readLanCollection),
      ]);
      const salesLedgerVerified = salesSnapshots.some(snapshot => snapshot.verified)
        || lanSales.verified
        || (branchContext.isGlobalMode && !isLoadingGlobalStockSales);
      const paymentLedgerVerified = paymentSnapshots.some(snapshot => snapshot.verified)
        || lanPaymentGroups.some(group => group.verified);
      if (!salesLedgerVerified || !paymentLedgerVerified) {
        throw new Error('The customer credit ledger is unavailable from Firestore, cache, and the Local Master. Please reconnect and retry; no sale has been recorded.');
      }
      const salesById = new Map<string, StockSale>();
      if (branchContext.isGlobalMode) {
        if (isLoadingGlobalStockSales) {
          throw new Error('Customer credit history is still loading. Please wait a moment and retry.');
        }
        globalStockSales.forEach(sale => {
          if (sale.paymentMethod === 'Credit' && (sale.customerId === customer.id || (!!customer.email && sale.customerEmail === customer.email))) {
            salesById.set(sale.id, sale);
          }
        });
      }
      salesSnapshots.forEach(snapshot => snapshot.docs.forEach(saleDoc => {
        const sale = { ...saleDoc.data(), id: saleDoc.id } as StockSale;
        if (sale.paymentMethod === 'Credit' && (sale.customerId === customer.id || (!!customer.email && sale.customerEmail === customer.email))) {
          salesById.set(sale.id, sale);
        }
      }));
      lanSales.documents.forEach(({ id, data }) => {
        const sale = { ...data, id } as StockSale;
        if (sale.paymentMethod === 'Credit' && (sale.customerId === customer.id || (!!customer.email && sale.customerEmail === customer.email))) {
          salesById.set(id, sale);
        }
      });
      const paymentsById = new Map<string, Payment>();
      paymentSnapshots.forEach(snapshot => snapshot.docs.forEach(paymentDoc => {
        const payment = { ...paymentDoc.data(), id: paymentDoc.id } as Payment;
        if (payment.type === 'Credit Repayment' && (payment.customerId === customer.id || (!!customer.email && payment.guestEmail === customer.email))) {
          paymentsById.set(payment.id, payment);
        }
      }));
      lanPaymentGroups.flatMap(group => group.documents).forEach(({ id, data }) => {
        const payment = { ...data, id } as Payment;
        if (payment.type === 'Credit Repayment' && (payment.customerId === customer.id || (!!customer.email && payment.guestEmail === customer.email))) {
          paymentsById.set(id, payment);
        }
      });
      const repayments = [...paymentsById.values()];
      const advancePayments = repayments.filter(payment => payment.allocationSource === 'POS_ADVANCE');
      const advanceApplications = repayments.filter(payment => !!payment.sourceAdvancePaymentId);
      const advanceAppliedById = new Map<string, number>();
      advanceApplications.forEach(payment => {
        const sourceId = payment.sourceAdvancePaymentId!;
        advanceAppliedById.set(sourceId, (advanceAppliedById.get(sourceId) || 0) + (Number(payment.amount) || 0));
      });
      const remainingAdvances = advancePayments
        .map(payment => ({
          paymentId: payment.id,
          paymentMethod: payment.paymentMethod || initialPaymentMethod || 'Cash',
          remaining: Math.max(0, (Number(payment.amount) || 0) - (advanceAppliedById.get(payment.id) || 0)),
        }))
        .filter(advance => advance.remaining > 0.01);
      const paidBySale = new Map<string, number>();
      const knownCreditSaleIds = new Set(salesById.keys());
      let unallocatedRepayments = 0;
      repayments.filter(payment => payment.allocationSource !== 'POS_ADVANCE').forEach(payment => {
        const amount = Number(payment.amount) || 0;
        if (payment.bookingId && knownCreditSaleIds.has(payment.bookingId)) {
          paidBySale.set(payment.bookingId, (paidBySale.get(payment.bookingId) || 0) + amount);
        } else if (!payment.sourceAdvancePaymentId) {
          // Legacy repayments may not point to a sale that is present in this branch/cache.
          // Allocate those to the oldest open credit sale instead of silently losing them.
          unallocatedRepayments += amount;
        }
      });
      const orderedBalances = [...salesById.values()]
        .sort((a, b) => {
          const toMillis = (value: any) => value?.toDate ? value.toDate().getTime() : value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
          return toMillis(a.soldAt) - toMillis(b.soldAt);
        })
        .map(sale => ({
          sale,
          outstanding: Math.max(0, Number(sale.totalAmount || 0) - Number(sale.initialPaymentAmount || 0) - (paidBySale.get(sale.id) || 0)),
        }));
      // Older repayments without a sale reference still reduce the customer's total;
      // apply them to the oldest open sale first so they are not counted twice.
      for (const balance of orderedBalances) {
        if (unallocatedRepayments <= 0) break;
        const used = Math.min(balance.outstanding, unallocatedRepayments);
        balance.outstanding -= used;
        unallocatedRepayments -= used;
      }
      const outstandingBefore = orderedBalances.reduce((sum, entry) => sum + entry.outstanding, 0);
      if (Number(customer.outstandingBalance) > 0.01 && outstandingBefore + 0.01 < Number(customer.outstandingBalance)) {
        throw new Error('The customer credit ledger could not be fully verified from the current connection or offline cache. Please reconnect and retry; no sale has been recorded.');
      }
      const advanceAllocations: { saleDocumentId: string; saleId: string; amount: number; sourceAdvancePaymentId: string; paymentMethod: string }[] = [];
      const availableAdvance = remainingAdvances.reduce((sum, advance) => sum + advance.remaining, 0);
      for (const advance of remainingAdvances) {
        for (const entry of orderedBalances) {
          if (advance.remaining <= 0.01) break;
          if (entry.outstanding <= 0) continue;
          const amount = Math.min(entry.outstanding, advance.remaining);
          advanceAllocations.push({ saleDocumentId: entry.sale.id, saleId: entry.sale.saleId, amount, sourceAdvancePaymentId: advance.paymentId, paymentMethod: advance.paymentMethod });
          entry.outstanding -= amount;
          advance.remaining -= amount;
        }
      }
      const advanceAppliedToPrevious = advanceAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      const outstandingAfterAdvance = orderedBalances.reduce((sum, entry) => sum + entry.outstanding, 0);
      const tendered = Math.max(0, Number(totalTenderedAmount ?? initialPaymentAmount) || 0);
      const salePayment = Math.min(total, tendered);
      let remainingToAllocate = applyExcessToOutstanding ? Math.min(Math.max(0, tendered - total), outstandingAfterAdvance) : 0;
      const allocations: { saleDocumentId: string; saleId: string; amount: number }[] = [];
      for (const entry of orderedBalances) {
        if (remainingToAllocate <= 0) break;
        if (entry.outstanding <= 0) continue;
        const amount = Math.min(entry.outstanding, remainingToAllocate);
        allocations.push({ saleDocumentId: entry.sale.id, saleId: entry.sale.saleId, amount });
        remainingToAllocate -= amount;
      }
      const appliedToOutstanding = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      const advanceSourcesForNewSale = remainingAdvances.filter(advance => advance.remaining > 0.01).map(advance => ({ ...advance }));
      const advanceRemainingAfterPrevious = advanceSourcesForNewSale.reduce((sum, advance) => sum + advance.remaining, 0);
      const advanceToNewSale = Math.min(advanceRemainingAfterPrevious, Math.max(0, total - salePayment));
      const newSaleOutstanding = Math.max(0, total - salePayment - advanceToNewSale);
      const advanceCreated = applyExcessToOutstanding && Number(customer.outstandingBalance || 0) <= 0.01
        ? Math.max(0, tendered - total - appliedToOutstanding)
        : 0;
      return {
        tendered, salePayment, outstandingBefore, allocations, advanceAllocations, advanceToNewSale,
        advanceSourcesForNewSale, advanceCreated, appliedToOutstanding,
        changeGiven: Math.max(0, tendered - total - appliedToOutstanding - advanceCreated),
        outstandingAfter: Math.max(0, outstandingBefore - advanceAppliedToPrevious - appliedToOutstanding) + newSaleOutstanding,
      };
    };

    try {
        let createdSale: StockSale | null = null;

        const executeSaleWrites = async () => {
          // Resolve the customer's live credit ledger before writing any part of this sale.
          const settlement = await loadCreditSettlement();
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
              paymentStatus: (paymentMethod === 'Credit' && settlement && settlement.salePayment + settlement.advanceToNewSale >= total ? 'Paid' : paymentStatus) as StockSale['paymentStatus'],
              soldAt: new Date() as any,
              soldByUid: userProfile.uid,
              soldByName: userProfile.name,
              customerId: customer?.id || null,
              customerName: customer?.name || 'Walk-in Customer',
              customerEmail: customer?.email || null,
              initialPaymentAmount: paymentMethod === 'Credit' ? (settlement?.salePayment || null) : (initialPaymentAmount || null),
              ...(settlement ? {
                totalTenderedAmount: settlement.tendered,
                changeGiven: settlement.changeGiven,
                excessAppliedToOutstanding: settlement.appliedToOutstanding,
                customerOutstandingBalanceBefore: settlement.outstandingBefore,
                customerOutstandingBalanceAfter: settlement.outstandingAfter,
                appliedToPreviousSales: settlement.allocations,
              } : {}),
              discountType: discount?.type || null,
              discountValue: discount?.value || null,
              context: context,
              printStatus: 'pending',
          };

          const saleData = getNewDocumentData(baseSaleData, branchContext);
          const ledgerBatch = writeBatch(firestore);
          const ledgerMutations: { collectionName: string; docId: string; data: Record<string, any> }[] = [];

          // Commit the sale and every payment allocation together. A failed Firestore
          // batch cannot leave a sale without its matching initial-payment/repayment ledger.
          ledgerBatch.set(newSaleRef, saleData);
          ledgerMutations.push({
            collectionName: getCollectionPath('stockSales'),
            docId: newSaleRef.id,
            data: saleData,
          });

          const amountPaid = paymentMethod === 'Credit'
            ? (settlement?.salePayment || 0)
            : (paymentStatus === 'Paid' ? total : initialPaymentAmount);
          if (amountPaid && amountPaid > 0) {
            const paymentRef = doc(collection(firestore, 'payments'));
            const paymentData: Omit<Payment, 'id'> = {
              bookingId: newSaleRef.id,
              guestName: saleData.customerName,
              guestEmail: saleData.customerEmail || null,
              amount: amountPaid,
              paymentMethod: (paymentMethod === 'Credit' ? (initialPaymentMethod || 'Cash') : paymentMethod) as any,
              status: 'Paid',
              transactionDate: new Date(),
              type: 'POS',
              customerId: customer?.id || undefined,
              createdByUid: userProfile.uid,
              createdByName: userProfile.name,
              items: saleData.items,
              profit: saleData.items.reduce((acc, item) => acc + ((item.sellingPrice - (item.costPrice || 0)) * item.quantity), 0),
            };
            ledgerBatch.set(paymentRef, paymentData);
            ledgerMutations.push({
              collectionName: 'payments',
              docId: paymentRef.id,
              data: paymentData,
            });
          }

          if (settlement && settlement.advanceCreated > 0.01) {
            const advanceAmount = settlement.advanceCreated;
            if (advanceAmount > 0.01) {
              const advanceRef = doc(collection(firestore, 'payments'));
              const advanceData: Omit<Payment, 'id'> = {
                guestName: saleData.customerName, guestEmail: saleData.customerEmail || null, customerId: customer?.id,
                amount: advanceAmount, paymentMethod: (initialPaymentMethod || 'Cash') as any, status: 'Paid',
                transactionDate: new Date(), type: 'Credit Repayment', createdByUid: userProfile.uid,
                createdByName: userProfile.name, sourceSaleId: newSaleRef.id, allocationSource: 'POS_ADVANCE',
                notes: `Customer chose to save excess from POS sale ${saleData.saleId} as advance credit.`,
              };
              ledgerBatch.set(advanceRef, advanceData);
              ledgerMutations.push({ collectionName: 'payments', docId: advanceRef.id, data: advanceData });
            }
          }
          if (settlement?.advanceAllocations.length) {
            for (const allocation of settlement.advanceAllocations) {
              const repaymentRef = doc(collection(firestore, 'payments'));
              const repaymentData: Omit<Payment, 'id'> = {
                bookingId: allocation.saleDocumentId, guestName: saleData.customerName, guestEmail: saleData.customerEmail || null,
                customerId: customer?.id, amount: allocation.amount, paymentMethod: allocation.paymentMethod as any,
                status: 'Paid', transactionDate: new Date(), type: 'Credit Repayment', createdByUid: userProfile.uid,
                createdByName: userProfile.name, sourceSaleId: newSaleRef.id,
                sourceAdvancePaymentId: allocation.sourceAdvancePaymentId, allocationSource: 'POS_ADVANCE_APPLIED',
                notes: `Applied customer advance credit to previous credit sale ${allocation.saleId}.`,
              };
              ledgerBatch.set(repaymentRef, repaymentData);
              ledgerMutations.push({ collectionName: 'payments', docId: repaymentRef.id, data: repaymentData });
            }
          }
          if (settlement && settlement.advanceToNewSale > 0.01) {
            let amountToApply = settlement.advanceToNewSale;
            for (const source of settlement.advanceSourcesForNewSale) {
              if (amountToApply <= 0.01) break;
              const applied = Math.min(amountToApply, source.remaining);
              if (applied <= 0) continue;
              const repaymentRef = doc(collection(firestore, 'payments'));
              const repaymentData: Omit<Payment, 'id'> = {
                bookingId: newSaleRef.id, guestName: saleData.customerName, guestEmail: saleData.customerEmail || null,
                customerId: customer?.id, amount: applied, paymentMethod: source.paymentMethod as any,
                status: 'Paid', transactionDate: new Date(), type: 'Credit Repayment', createdByUid: userProfile.uid,
                createdByName: userProfile.name, sourceSaleId: newSaleRef.id,
                sourceAdvancePaymentId: source.paymentId, allocationSource: 'POS_ADVANCE_APPLIED',
                notes: `Applied customer advance credit to new credit sale ${saleData.saleId}.`,
              };
              ledgerBatch.set(repaymentRef, repaymentData);
              ledgerMutations.push({ collectionName: 'payments', docId: repaymentRef.id, data: repaymentData });
              amountToApply -= applied;
            }
          }
          if (settlement?.allocations.length) {
            for (const allocation of settlement.allocations) {
              const repaymentRef = doc(collection(firestore, 'payments'));
              const repaymentData: Omit<Payment, 'id'> = {
                bookingId: allocation.saleDocumentId,
                guestName: saleData.customerName,
                guestEmail: saleData.customerEmail || null,
                customerId: customer?.id,
                amount: allocation.amount,
                paymentMethod: (initialPaymentMethod || 'Cash') as any,
                status: 'Paid',
                transactionDate: new Date(),
                type: 'Credit Repayment',
                createdByUid: userProfile.uid,
                createdByName: userProfile.name,
                sourceSaleId: newSaleRef.id,
                allocationSource: 'POS_CHANGE',
                notes: `Applied from excess received on POS sale ${saleData.saleId} to previous credit sale ${allocation.saleId}.`,
              };
              ledgerBatch.set(repaymentRef, repaymentData);
              ledgerMutations.push({
                collectionName: 'payments',
                docId: repaymentRef.id,
                data: repaymentData,
              });
            }
          }

          // If this browser is connected to the Local Master PC, the Master
          // database is the source of truth. Persist sale, payments, held-table
          // removal and stock movements together before reporting success.
          let savedOnLocalMaster = false;
          try {
            const masterStatus = await fetch('/api/lan-sync', { cache: 'no-store' });
            if (masterStatus.ok) {
              const statusPayload = await masterStatus.json();
              if (statusPayload?.success && statusPayload?.mode === 'LAN_MASTER_SERVER') {
                const transactionMutations: { collectionName: string; docId: string; action: 'set' | 'update' | 'delete'; data?: Record<string, any> }[] = ledgerMutations.map(mutation => ({
                  collectionName: mutation.collectionName,
                  docId: mutation.docId,
                  action: 'set' as const,
                  data: mutation.data,
                }));
                if (restoredSaleId) {
                  transactionMutations.push({
                    collectionName: getCollectionPath('heldSales'),
                    docId: restoredSaleId,
                    action: 'delete' as const,
                    data: undefined as any,
                  });
                }
                const physicalItems = allItems.filter(item => !item.isService);
                const stockAdjustments = physicalItems.map(item => ({
                  collectionName: getCollectionPath('stock'),
                  itemId: item.id,
                  quantityDelta: -Number(item.sellQuantity || 0),
                })).filter(item => item.quantityDelta !== 0);
                const transactionKey = `pos-sale-${newSaleRef.id}`;
                const localResponse = await fetch('/api/lan-sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transactionKey, mutations: transactionMutations, stockAdjustments }),
                });
                const localResult = await localResponse.json().catch(() => ({}));
                if (!localResponse.ok || localResult?.success !== true || localResult?.durable !== true) {
                  throw new Error(localResult?.error || 'The Local Master PC could not confirm a durable sale save.');
                }
                savedOnLocalMaster = true;

                // The Master PC owns the durable offline queue. Ask it to sync
                // immediately when the network is available; failures leave the
                // transaction pending locally for the next retry.
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                  fetch('/api/lan-sync/cloud-sync', { method: 'POST' }).catch(() => {});
                }
              }
            }
          } catch (localSaveError) {
            throw new Error(localSaveError instanceof Error
              ? localSaveError.message
              : 'Unable to save this sale to the Local Master PC.');
          }

          if (!savedOnLocalMaster) {
            // Cloud-only mode writes the sale ledger and stock movement in one
            // Firestore batch, matching the Local Master transaction.
            allItems.filter(item => !item.isService).forEach(item => {
              ledgerBatch.update(
                doc(firestore, getCollectionPath('stock'), item.id),
                { quantity: increment(-Number(item.sellQuantity || 0)) }
              );
            });
            if (restoredSaleId) {
              ledgerBatch.delete(doc(firestore, getCollectionPath('heldSales'), restoredSaleId));
            }
            await ledgerBatch.commit();
          }

          return { ...saleData, soldAt: new Date() };
        };

        try {
          // Use one transaction implementation in both environments. It
          // writes to the Local Master first when available, otherwise it
          // commits the equivalent complete batch to Firestore.
          createdSale = await executeSaleWrites();
        } catch (trxErr) {
          throw trxErr;
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

    const readCollection = async (collectionName: string) => {
      const documents = new Map<string, Record<string, any>>();
      const source = collection(firestore, collectionName);
      try {
        const snapshot = await getDocs(source);
        snapshot.docs.forEach(document => documents.set(document.id, { ...document.data(), id: document.id }));
      } catch {
        try {
          const snapshot = await getDocsFromCache(source);
          snapshot.docs.forEach(document => documents.set(document.id, { ...document.data(), id: document.id }));
        } catch {
          // Continue to the Local Master store below.
        }
      }
      try {
        const response = await fetch(`/api/lan-sync?collection=${encodeURIComponent(collectionName)}`, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          if (payload?.success && payload?.data && typeof payload.data === 'object') {
            Object.entries(payload.data).forEach(([id, data]) => documents.set(id, { ...(data as Record<string, any>), id }));
          }
        }
      } catch {
        // Firestore/cache data remains usable when this device is not connected to a Local Master.
      }
      return [...documents.values()];
    };

    try {
      const [customers, allSales, ...paymentGroups] = await Promise.all([
        readCollection(getCollectionPath('posCustomers')),
        readCollection(getCollectionPath('stockSales')),
        ...Array.from(new Set(['payments', getCollectionPath('payments')])).map(readCollection),
      ]);
      const customerMap = new Map<string, Customer>((customers as Customer[]).map(customer => [customer.id, customer]));
      if (branchContext.isGlobalMode) {
        if (isLoadingGlobalPosCustomers) {
          throw new Error('Customer directory is still loading. Please retry in a moment.');
        }
        globalPosCustomers.forEach(customer => customerMap.set(customer.id, customer));
      }
      const allPayments = [...new Map(paymentGroups.flat().map(payment => [payment.id, payment])).values()] as Payment[];
      const salesMap = new Map<string, StockSale>((allSales as StockSale[]).map(sale => [sale.id, sale]));
      if (branchContext.isGlobalMode) {
        if (isLoadingGlobalStockSales) {
          throw new Error('Customer credit history is still loading. Please retry in a moment.');
        }
        globalStockSales.forEach(sale => salesMap.set(sale.id, sale));
      }
      const sales = [...salesMap.values()];

      return [...customerMap.values()].map(customer => {
        const customerSales = sales.filter(sale =>
          sale.customerId === customer.id ||
          (!!customer.email && !!sale.customerEmail && sale.customerEmail === customer.email)
        );
        const customerCreditSales = customerSales.filter(sale => sale.paymentMethod === 'Credit');
        const creditSaleIds = new Set(customerCreditSales.map(sale => sale.id));
        const repayments = allPayments.filter(payment =>
          payment.type === 'Credit Repayment' &&
          (payment.customerId === customer.id ||
            (!!customer.email && payment.guestEmail === customer.email) ||
            (!!payment.bookingId && creditSaleIds.has(payment.bookingId)))
        );
        const totalSpent = customerSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
        const initialCreditPayments = customerCreditSales.reduce((sum, sale) => sum + (Number(sale.initialPaymentAmount) || 0), 0);
        const totalRepayments = repayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
        const totalPaid = customerSales
          .filter(sale => sale.paymentMethod !== 'Credit')
          .reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0) + initialCreditPayments + totalRepayments;
        const totalCredit = customerCreditSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
        const outstandingBalance = Math.max(0, totalCredit - initialCreditPayments - totalRepayments);

        return {
          ...customer,
          totalSpent,
          totalPaid,
          outstandingBalance,
        };
      });
    } catch (error) {
      console.error("Error fetching customer financials: ", error);
      return [];
    }
  }, [firestore, getCollectionPath, branchContext.isGlobalMode, globalStockSales, isLoadingGlobalStockSales, globalPosCustomers, isLoadingGlobalPosCustomers]);

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
