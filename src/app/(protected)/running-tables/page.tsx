'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  increment,
  runTransaction,
  where,
  QueryConstraint,
  Timestamp,
  limit,
  startAfter,
  startBefore,
  endBefore,
  queryEqual,
  getDoc,
} from 'firebase/firestore';
import type { HeldSale, UserProfile, StockReturn, DocketHistory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { List, Trash2, Printer, Undo, MoreHorizontal, RefreshCw, Bell, Eye, User, Undo2, Calculator, History, CalendarClock, RotateCcw, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { TopHeader } from '@/components/ui/top-header';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { ColumnDef } from '@tanstack/react-table';
import { format, isToday, isYesterday, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { HeldSaleReceiptDialog } from '@/components/pos/held-sale-receipt-dialog';
import { UnprintedItemsReceiptDialog } from '@/components/pos/unprinted-items-receipt-dialog';
import { DraftDocketReceiptDialog } from '@/components/pos/draft-docket-receipt-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { ReturnItemDialog } from '@/components/running-tables/return-item-dialog';
import { ReturnReceiptDialog } from '@/components/running-tables/return-receipt-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { usePermissions } from '@/hooks/use-permissions';
import { CreditCard } from 'lucide-react';
import { useUser } from '@/contexts/user-context';

function RunningTablesPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { getCollectionPath, isBranchMode, currentBranch } = useBranch();
  const { hasPermission } = usePermissions();
  const { userProfile } = useUser();

  // Check if user has permission to view Running Tables
  React.useEffect(() => {
    if (!hasPermission(PagePermission.VIEW_RUNNING_TABLES) && !hasPermission(PagePermission.MANAGE_RUNNING_TABLES)) {
      router.push('/dashboard');
      return;
    }
  }, [hasPermission, router]);
  const currency = settings?.currency || 'USD';

  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState('active');
  const [selectedSale, setSelectedSale] = React.useState<HeldSale | null>(null);
  const [showActionsDialog, setShowActionsDialog] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [showUnprintConfirm, setShowUnprintConfirm] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [saleToPrint, setSaleToPrint] = React.useState<HeldSale | null>(null);
  const [unprintedSale, setUnprintedSale] = React.useState<HeldSale | null>(null);
  const [draftSale, setDraftSale] = React.useState<HeldSale | null>(null);
  const [showReturnItemDialog, setShowReturnItemDialog] = React.useState(false);
  const [returnSale, setReturnSale] = React.useState<HeldSale | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string>('all');

  // Date filters
  const [returnsDateRange, setReturnsDateRange] = React.useState<DateRange | undefined>();
  const [historyDateRange, setHistoryDateRange] = React.useState<DateRange | undefined>();

  // Pagination state for History Dockets
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyLastDoc, setHistoryLastDoc] = React.useState<any>(null);
  const [historyFirstDoc, setHistoryFirstDoc] = React.useState<any>(null);
  const [historyDirection, setHistoryDirection] = React.useState<'next' | 'prev' | null>(null);
  const historyPageSize = 20;

  // Pagination state for Returns & Resets
  const [returnsPage, setReturnsPage] = React.useState(1);
  const [returnsLastDoc, setReturnsLastDoc] = React.useState<any>(null);
  const [returnsFirstDoc, setReturnsFirstDoc] = React.useState<any>(null);
  const [returnsDirection, setReturnsDirection] = React.useState<'next' | 'prev' | null>(null);
  const returnsPageSize = 20;

  // Return receipt state
  const [showReturnReceipt, setShowReturnReceipt] = React.useState(false);
  const [returnReceiptData, setReturnReceiptData] = React.useState<{
    heldSale: HeldSale | null;
    returnedItems: { itemId: string; itemName: string; quantity: number; refundAmount: number; originalQuantity: number; remainingQuantity: number }[];
    totalRefundAmount: number;
    remainingAmount: number;
    originalTotal: number;
    reason?: string;
  } | null>(null);

  // Fetch staff members for filter
  const staffQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('name'));
  }, [firestore]);

  const { data: staffMembers, isLoading: areStaffLoading } = useCollection<UserProfile>(staffQuery);

  // Fetch stock returns for refund stats (all, for stats)
  const returnsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('stockReturns')), orderBy('returnedAt', 'desc'));
  }, [firestore, reloadCounter, getCollectionPath]);

  const { data: allStockReturns, isLoading: areAllReturnsLoading } = useCollection<StockReturn>(returnsQuery);

  // Use refs to avoid infinite loops from pagination state updates
  const returnsLastDocRef = React.useRef<StockReturn | null>(null);
  const returnsFirstDocRef = React.useRef<StockReturn | null>(null);

  // Fetch paginated returns for display
  const paginatedReturnsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const constraints: QueryConstraint[] = [
      orderBy('returnedAt', 'desc'),
      limit(returnsPageSize)
    ];

    if (returnsDirection === 'next' && returnsLastDocRef.current) {
      constraints.push(startAfter(returnsLastDocRef.current));
    } else if (returnsDirection === 'prev' && returnsFirstDocRef.current) {
      constraints.push(endBefore(returnsFirstDocRef.current));
    }

    return query(collection(firestore, getCollectionPath('stockReturns')), ...constraints);
  }, [firestore, returnsDirection, returnsPageSize, getCollectionPath]);

  const { data: paginatedReturns, isLoading: areReturnsLoading } = useCollection<StockReturn>(paginatedReturnsQuery);

  // Update refs when data changes (no state update = no infinite loop)
  React.useEffect(() => {
    if (paginatedReturns && paginatedReturns.length > 0) {
      returnsFirstDocRef.current = paginatedReturns[0];
      returnsLastDocRef.current = paginatedReturns[paginatedReturns.length - 1];
    }
  }, [paginatedReturns]);

  // Fetch docket history (deleted/reset tables) for stats
  const docketHistoryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('docketHistory')), orderBy('actionAt', 'desc'));
  }, [firestore, reloadCounter, getCollectionPath]);

  const { data: allDocketHistories, isLoading: areAllHistoryLoading } = useCollection<DocketHistory>(docketHistoryQuery);

  // Use refs to avoid infinite loops from pagination state updates
  const historyLastDocRef = React.useRef<DocketHistory | null>(null);
  const historyFirstDocRef = React.useRef<DocketHistory | null>(null);

  // Fetch paginated docket history for display
  const paginatedHistoryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const constraints: QueryConstraint[] = [
      orderBy('actionAt', 'desc'),
      limit(historyPageSize)
    ];

    if (historyDirection === 'next' && historyLastDocRef.current) {
      constraints.push(startAfter(historyLastDocRef.current));
    } else if (historyDirection === 'prev' && historyFirstDocRef.current) {
      constraints.push(endBefore(historyFirstDocRef.current));
    }

    return query(collection(firestore, getCollectionPath('docketHistory')), ...constraints);
  }, [firestore, historyDirection, historyPageSize, getCollectionPath]);

  const { data: paginatedHistories, isLoading: isHistoryLoading } = useCollection<DocketHistory>(paginatedHistoryQuery);

  // Update refs when data changes (no state update = no infinite loop)
  React.useEffect(() => {
    if (paginatedHistories && paginatedHistories.length > 0) {
      historyFirstDocRef.current = paginatedHistories[0];
      historyLastDocRef.current = paginatedHistories[paginatedHistories.length - 1];
    }
  }, [paginatedHistories]);

  // Held sales query with optional user filter
  const heldSalesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const constraints: QueryConstraint[] = [orderBy('heldAt', 'desc')];
    if (selectedUserId !== 'all') {
      constraints.push(where('heldByUid', '==', selectedUserId));
    }
    return query(collection(firestore, getCollectionPath('heldSales')), ...constraints);
  }, [firestore, reloadCounter, selectedUserId, getCollectionPath]);

  const { data: heldSales, isLoading } = useCollection<HeldSale>(heldSalesQuery);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!heldSales) return { totalTables: 0, printedTables: 0, totalAmount: 0, totalRefundAmount: 0, totalRefundCount: 0, myCreditSalesCount: 0, myCreditSalesAmount: 0 };

    const totalTables = heldSales.length;
    const printedTables = heldSales.filter(sale =>
      sale.cart.some(item => (item.printedQuantity || 0) > 0)
    ).length;
    const totalAmount = heldSales.reduce((sum, sale) =>
      sum + sale.cart.reduce((itemSum, item) =>
        itemSum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
      ), 0
    );

    // Filter credit sales for current user
    const myCreditSales = heldSales.filter(sale =>
      sale.isCreditSale === true && sale.heldByUid === userProfile?.uid
    );
    const myCreditSalesCount = myCreditSales.length;
    const myCreditSalesAmount = myCreditSales.reduce((sum, sale) =>
      sum + sale.cart.reduce((itemSum, item) =>
        itemSum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
      ), 0
    );

    return { totalTables, printedTables, totalAmount, myCreditSalesCount, myCreditSalesAmount };
  }, [heldSales, userProfile]);

  // Calculate refund stats from running tables
  const refundStats = React.useMemo(() => {
    if (!allStockReturns) return { totalRefundAmount: 0, totalRefundCount: 0 };

    // Filter returns that came from running tables using the source field
    const runningTableReturns = allStockReturns.filter(r => r.source === 'RunningTable');

    const totalRefundAmount = runningTableReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
    const totalRefundCount = runningTableReturns.length;

    return { totalRefundAmount, totalRefundCount };
  }, [allStockReturns]);

  // Filter returns by date range
  const filteredReturns = React.useMemo(() => {
    if (!paginatedReturns) return [];
    let returns = paginatedReturns.filter(r => r.source === 'RunningTable');

    if (returnsDateRange?.from) {
      returns = returns.filter(r => {
        const returnedAt = getSafeDate(r.returnedAt);
        if (!returnedAt) return false;
        return isWithinInterval(returnedAt, {
          start: startOfDay(returnsDateRange.from!),
          end: endOfDay(returnsDateRange.to || returnsDateRange.from!)
        });
      });
    }

    return returns;
  }, [paginatedReturns, returnsDateRange]);

  // Filter resets by date range
  const filteredResets = React.useMemo(() => {
    if (!paginatedHistories) return [];
    let resets = paginatedHistories.filter(h => h.actionType === 'Reset');

    if (returnsDateRange?.from) {
      resets = resets.filter(h => {
        const actionAt = getSafeDate(h.actionAt);
        if (!actionAt) return false;
        return isWithinInterval(actionAt, {
          start: startOfDay(returnsDateRange.from!),
          end: endOfDay(returnsDateRange.to || returnsDateRange.from!)
        });
      });
    }

    return resets;
  }, [paginatedHistories, returnsDateRange]);

  // Filter history by date range
  const filteredHistory = React.useMemo(() => {
    if (!paginatedHistories) return [];
    let history = [...paginatedHistories];

    if (historyDateRange?.from) {
      history = history.filter(h => {
        const actionAt = getSafeDate(h.actionAt);
        if (!actionAt) return false;
        return isWithinInterval(actionAt, {
          start: startOfDay(historyDateRange.from!),
          end: endOfDay(historyDateRange.to || historyDateRange.from!)
        });
      });
    }

    return history;
  }, [paginatedHistories, historyDateRange]);

  const allStaffMembers = React.useMemo(() => {
    if (!staffMembers) return [];
    return staffMembers;
  }, [staffMembers]);

  // Track first and last documents for history pagination - using refs to avoid infinite loops

  // Pagination handlers for History
  const handleHistoryNext = () => {
    setHistoryDirection('next');
    setHistoryPage(prev => prev + 1);
  };

  const handleHistoryPrev = () => {
    setHistoryDirection('prev');
    setHistoryPage(prev => prev - 1);
  };

  const handleHistoryPageReset = () => {
    setHistoryDirection(null);
    setHistoryPage(1);
  };

  // Pagination handlers for Returns
  const handleReturnsNext = () => {
    setReturnsDirection('next');
    setReturnsPage(prev => prev + 1);
  };

  const handleReturnsPrev = () => {
    setReturnsDirection('prev');
    setReturnsPage(prev => prev - 1);
  };

  const handleReturnsPageReset = () => {
    setReturnsDirection(null);
    setReturnsPage(1);
  };

  // Reset pagination when date filters change
  React.useEffect(() => {
    handleHistoryPageReset();
  }, [historyDateRange]);

  React.useEffect(() => {
    handleReturnsPageReset();
  }, [returnsDateRange]);

  const handleOpenActions = (sale: HeldSale) => {
    setSelectedSale(sale);
    setShowActionsDialog(true);
  };

  const handleCloseDialog = () => {
    setShowActionsDialog(false);
    setShowDeleteConfirm(false);
    setShowResetConfirm(false);
    setShowUnprintConfirm(false);
    setSelectedSale(null);
  };

  const handleDeleteSale = async () => {
    if (!firestore || !selectedSale) return;
    setIsProcessing(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), selectedSale.id);
        const heldSaleDoc = await transaction.get(heldSaleRef);

        if (!heldSaleDoc.exists()) {
          throw new Error("Running table not found.");
        }

        const saleData = heldSaleDoc.data() as HeldSale;
        const totalAmount = saleData.cart.reduce((sum, item) =>
          sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
        );

        // If billed to room, delete the associated bill
        if (saleData.linkedBillId && saleData.customer?.id) {
          const billRef = doc(firestore, `bookings/${saleData.customer.id}/bills`, saleData.linkedBillId);
          const billDoc = await transaction.get(billRef);
          if (billDoc.exists()) {
            transaction.delete(billRef);
          }
        }

        // Always return items to stock (except services), regardless of whether it was billed to room
        const itemsToReturnToStock = saleData.cart.filter(item => !item.isService);
        if (itemsToReturnToStock.length > 0) {
          for (const cartItem of itemsToReturnToStock) {
            const stockRef = doc(firestore, getCollectionPath('stock'), cartItem.id);
            transaction.update(stockRef, { quantity: increment(cartItem.sellQuantity) });
          }
        }

        // Record docket history before deleting
        const docketHistoryRef = doc(collection(firestore, getCollectionPath('docketHistory')));
        const historyData: Record<string, any> = {
          id: docketHistoryRef.id,
          originalSaleId: saleData.id,
          tableName: saleData.name,
          customerName: saleData.customer?.name || 'Walk-in Customer',
          heldAt: saleData.heldAt,
          heldByUid: saleData.heldByUid,
          heldByName: saleData.heldByName,
          items: saleData.cart.map(item => ({
            itemId: item.id,
            itemName: item.name,
            quantity: item.sellQuantity,
            price: item.price || item.sellingPrice || 0,
          })),
          totalAmount,
          actionType: 'Deleted',
          actionAt: Timestamp.now(),
          actionByUid: saleData.heldByUid,
          actionByName: saleData.heldByName,
          itemsReturnedToStock: itemsToReturnToStock.map(item => ({
            itemId: item.id,
            itemName: item.name,
            quantity: item.sellQuantity,
          })),
        };
        if (saleData.linkedBillId) {
          historyData.linkedBillId = saleData.linkedBillId;
        }
        if (saleData.customer?.id) {
          historyData.customerId = saleData.customer.id;
        }
        transaction.set(docketHistoryRef, historyData);

        transaction.delete(heldSaleRef);
      });

      toast({ variant: 'success', title: 'Running Table Deleted', description: 'The table was deleted and items were returned to stock.' });
      setReloadCounter(c => c + 1);
      handleCloseDialog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Deleting Table', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetSale = async () => {
    if (!firestore || !selectedSale) return;
    setIsProcessing(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), selectedSale.id);
        const heldSaleDoc = await transaction.get(heldSaleRef);

        if (!heldSaleDoc.exists()) {
          throw new Error("Running table not found.");
        }

        const saleData = heldSaleDoc.data() as HeldSale;
        const totalAmount = saleData.cart.reduce((sum, item) =>
          sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
        );

        // If billed to room, delete the associated bill
        if (saleData.linkedBillId && saleData.customer?.id) {
          const billRef = doc(firestore, `bookings/${saleData.customer.id}/bills`, saleData.linkedBillId);
          const billDoc = await transaction.get(billRef);
          if (billDoc.exists()) {
            transaction.delete(billRef);
          }
        }

        // Always return items to stock (except services), regardless of whether it was billed to room
        const itemsToReturnToStock = saleData.cart.filter(item => !item.isService);
        if (itemsToReturnToStock.length > 0) {
          for (const cartItem of itemsToReturnToStock) {
            const stockRef = doc(firestore, getCollectionPath('stock'), cartItem.id);
            transaction.update(stockRef, { quantity: increment(cartItem.sellQuantity) });
          }
        }

        // Record docket history before deleting
        const docketHistoryRef = doc(collection(firestore, getCollectionPath('docketHistory')));
        const historyData: Record<string, any> = {
          id: docketHistoryRef.id,
          originalSaleId: saleData.id,
          tableName: saleData.name,
          customerName: saleData.customer?.name || 'Walk-in Customer',
          heldAt: saleData.heldAt,
          heldByUid: saleData.heldByUid,
          heldByName: saleData.heldByName,
          items: saleData.cart.map(item => ({
            itemId: item.id,
            itemName: item.name,
            quantity: item.sellQuantity,
            price: item.price || item.sellingPrice || 0,
          })),
          totalAmount,
          actionType: 'Reset',
          actionAt: Timestamp.now(),
          actionByUid: saleData.heldByUid,
          actionByName: saleData.heldByName,
          itemsReturnedToStock: itemsToReturnToStock.map(item => ({
            itemId: item.id,
            itemName: item.name,
            quantity: item.sellQuantity,
          })),
        };
        if (saleData.linkedBillId) {
          historyData.linkedBillId = saleData.linkedBillId;
        }
        if (saleData.customer?.id) {
          historyData.customerId = saleData.customer.id;
        }
        transaction.set(docketHistoryRef, historyData);

        transaction.delete(heldSaleRef);
      });

      toast({ variant: 'success', title: 'Running Table Reset', description: 'The table has been reset and items returned to stock.' });
      setReloadCounter(c => c + 1);
      handleCloseDialog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Resetting Table', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnprintItems = async () => {
    if (!firestore || !selectedSale) return;
    setIsProcessing(true);

    try {
      const saleRef = doc(firestore, getCollectionPath('heldSales'), selectedSale.id);
      const updatedCart = selectedSale.cart.map(item => ({
        ...item,
        printedQuantity: 0,
      }));

      await updateDoc(saleRef, { cart: updatedCart });

      toast({ variant: 'success', title: 'Items Unprinted', description: 'All items have been marked as unprinted. You can now print them again.' });
      setReloadCounter(c => c + 1);
      handleCloseDialog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Unprinting Items', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFullDocketPrinted = async () => {
    if (!firestore || !saleToPrint) return;
    const saleRef = doc(firestore, getCollectionPath('heldSales'), saleToPrint.id);
    try {
      const updatedCart = saleToPrint.cart.map(item => ({
        ...item,
        printedQuantity: item.sellQuantity,
      }));

      // Update held sale
      await updateDoc(saleRef, { cart: updatedCart });

      // If this is billed to a room, also update the linked Bill's print status
      if (saleToPrint.linkedBillId && saleToPrint.customer?.id) {
        const billRef = doc(firestore, `bookings/${saleToPrint.customer.id}/bills`, saleToPrint.linkedBillId);
        const billItems = updatedCart.map(item => ({
          id: item.isService ? `service-${item.id}` : item.id,
          name: item.name,
          price: item.price || item.sellingPrice,
          quantity: item.sellQuantity,
          printedQuantity: item.sellQuantity, // Mark as fully printed
          paid: false,
          isService: item.isService,
          billId: saleToPrint.linkedBillId,
        }));
        await updateDoc(billRef, {
          items: billItems,
          printStatus: 'printed',
          printedAt: Timestamp.now(),
        });
      }

      setReloadCounter(c => c + 1);
    } catch (e) {
      console.error('Failed to update print status after full docket print:', e);
      toast({ variant: 'destructive', title: 'Failed to update print status' });
    }
  };

  const handleUnprintedDocketPrinted = async () => {
    if (!firestore || !unprintedSale) return;
    const saleRef = doc(firestore, getCollectionPath('heldSales'), unprintedSale.id);
    try {
      // CRITICAL: Fetch the LATEST document from Firestore to avoid using stale local state
      const saleDoc = await getDoc(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Running table not found');
      }

      const currentCart = saleDoc.data()?.cart || [];

      const updatedCart = currentCart.map(item => {
        const unprintedQty = item.sellQuantity - (item.printedQuantity || 0);
        if (unprintedQty > 0) {
          // Mark only the unprinted portion as printed
          // CRITICAL: Add to existing printedQuantity, don't replace it
          const existingPrinted = item.printedQuantity || 0;
          return { ...item, printedQuantity: existingPrinted + unprintedQty };
        }
        return item;
      });

      // Update held sale
      await updateDoc(saleRef, { cart: updatedCart });

      // If this is billed to a room, also update the linked Bill's print status
      if (unprintedSale.linkedBillId && unprintedSale.customer?.id) {
        const billRef = doc(firestore, `bookings/${unprintedSale.customer.id}/bills`, unprintedSale.linkedBillId);
        const billItems = updatedCart.map(item => ({
          id: item.isService ? `service-${item.id}` : item.id,
          name: item.name,
          price: item.price || item.sellingPrice,
          quantity: item.sellQuantity,
          printedQuantity: item.printedQuantity || 0,
          paid: false,
          isService: item.isService,
          billId: unprintedSale.linkedBillId,
        }));
        await updateDoc(billRef, {
          items: billItems,
          printStatus: 'printed',
          printedAt: Timestamp.now(),
        });
      }

      setReloadCounter(c => c + 1);
    } catch (e) {
      console.error('Failed to update print status after unprinted docket print:', e);
      toast({ variant: 'destructive', title: 'Failed to update print status' });
    }
  };

  const handleReturnItems = async (
    sale: HeldSale,
    itemsToReturn: { itemId: string; quantity: number; itemName: string; price: number }[],
    reason: string
  ) => {
    if (!firestore || !sale) return;
    setIsProcessing(true);

    // Calculate receipt data before the transaction
    const originalTotal = sale.cart.reduce((sum, item) =>
      sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
    );
    const totalRefundAmount = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const remainingAmount = originalTotal - totalRefundAmount;

    // Prepare detailed receipt data with original and remaining quantities
    const returnedItemsWithDetails = itemsToReturn.map(item => {
      const originalItem = sale.cart.find(i => i.id === item.itemId);
      const originalQuantity = originalItem?.sellQuantity || 0;
      return {
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        refundAmount: item.price * item.quantity,
        originalQuantity: originalQuantity,
        remainingQuantity: originalQuantity - item.quantity,
      };
    });

    // Prepare receipt data to show after transaction
    const receiptData = {
      heldSale: sale,
      returnedItems: returnedItemsWithDetails,
      totalRefundAmount,
      remainingAmount,
      originalTotal,
      reason,
    };

    try {
      await runTransaction(firestore, async (transaction) => {
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), sale.id);
        const heldSaleDoc = await transaction.get(heldSaleRef);

        if (!heldSaleDoc.exists()) {
          throw new Error('Running table not found.');
        }

        const saleData = heldSaleDoc.data() as HeldSale;

        // Update cart - remove returned items or reduce quantities
        const updatedCart = saleData.cart.map(item => {
          const returnItem = itemsToReturn.find(r => r.itemId === item.id);
          if (returnItem) {
            const newQuantity = item.sellQuantity - returnItem.quantity;
            if (newQuantity <= 0) {
              return null; // Item will be removed
            }
            return {
              ...item,
              sellQuantity: newQuantity,
              printedQuantity: Math.min(item.printedQuantity || 0, newQuantity),
            };
          }
          return item;
        }).filter(Boolean) as typeof saleData.cart;

        // Return items to stock (only for non-service items)
        const stockItems = itemsToReturn.filter(rItem => {
          const originalItem = saleData.cart.find(i => i.id === rItem.itemId);
          return originalItem && !originalItem.isService;
        });

        for (const returnItem of stockItems) {
          const stockRef = doc(firestore, getCollectionPath('stock'), returnItem.itemId);
          transaction.update(stockRef, { quantity: increment(returnItem.quantity) });
        }

        // Create a stock return record for audit trail
        const refundId = `RTN-${Date.now().toString(36).toUpperCase()}`;
        const totalRefundAmount = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const stockReturnRef = doc(collection(firestore, getCollectionPath('stockReturns')));
        const stockReturnData: Record<string, any> = {
          id: stockReturnRef.id,
          refundId,
          originalSaleId: sale.id,
          originalTotal,
          remainingAmount,
          items: itemsToReturn.map(item => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            refundAmount: item.price * item.quantity,
            originalQuantity: saleData.cart.find(i => i.id === item.itemId)?.sellQuantity || 0,
            remainingQuantity: (saleData.cart.find(i => i.id === item.itemId)?.sellQuantity || 0) - item.quantity,
          })),
          totalRefundAmount,
          reason: reason || `Return from Running Table: ${sale.name}`,
          returnedAt: Timestamp.now(),
          returnedByUid: sale.heldByUid,
          returnedByName: sale.heldByName,
          customerName: sale.customer?.name || 'Walk-in Customer',
          source: 'RunningTable',
        };
        if (sale.customer?.id) {
          stockReturnData.customerId = sale.customer.id;
        }
        transaction.set(stockReturnRef, stockReturnData);

        // If cart is now empty, delete the running table and record history
        if (updatedCart.length === 0) {
          // If billed to room, delete the associated bill
          if (saleData.linkedBillId && saleData.customer?.id) {
            const billRef = doc(firestore, `bookings/${saleData.customer.id}/bills`, saleData.linkedBillId);
            const billDoc = await transaction.get(billRef);
            if (billDoc.exists()) {
              transaction.delete(billRef);
            }
          }
          // Record history for completed table
          const docketHistoryRef = doc(collection(firestore, getCollectionPath('docketHistory')));
          const historyData: Record<string, any> = {
            id: docketHistoryRef.id,
            originalSaleId: saleData.id,
            tableName: saleData.name,
            customerName: saleData.customer?.name || 'Walk-in Customer',
            heldAt: saleData.heldAt,
            heldByUid: saleData.heldByUid,
            heldByName: saleData.heldByName,
            items: saleData.cart.map(item => ({
              itemId: item.id,
              itemName: item.name,
              quantity: item.sellQuantity,
              price: item.price || item.sellingPrice || 0,
            })),
            totalAmount: originalTotal,
            actionType: 'Completed',
            actionAt: Timestamp.now(),
            actionByUid: saleData.heldByUid,
            actionByName: saleData.heldByName,
          };
          if (saleData.linkedBillId) {
            historyData.linkedBillId = saleData.linkedBillId;
          }
          if (saleData.customer?.id) {
            historyData.customerId = saleData.customer.id;
          }
          transaction.set(docketHistoryRef, historyData);
          transaction.delete(heldSaleRef);
        } else {
          transaction.update(heldSaleRef, { cart: updatedCart });

          // If this is billed to a room, also update the linked Bill
          if (saleData.linkedBillId && saleData.customer?.id) {
            const billRef = doc(firestore, `bookings/${saleData.customer.id}/bills`, saleData.linkedBillId);
            const billItems = updatedCart.map(item => ({
              id: item.isService ? `service-${item.id}` : item.id,
              name: item.name,
              price: item.price || item.sellingPrice,
              quantity: item.sellQuantity,
              printedQuantity: item.printedQuantity || 0,
              paid: false,
              isService: item.isService,
              billId: saleData.linkedBillId,
            }));
            const newTotal = billItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
            transaction.update(billRef, {
              items: billItems,
              total: newTotal,
            });
          }
        }
      });

      toast({
        variant: 'success',
        title: 'Items Returned',
        description: 'Selected items have been returned and removed from the running table.',
      });

      // Show the return receipt
      setReturnReceiptData(receiptData);
      setShowReturnReceipt(true);

      setReloadCounter(c => c + 1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Returning Items', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle re-print receipt from returns & resets section
  const handleReprintReturnReceipt = (returnItem: StockReturn) => {
    // Find the original sale to reconstruct the receipt
    const mockHeldSale: HeldSale = {
      id: returnItem.originalSaleId,
      name: returnItem.reason?.includes(':') ? returnItem.reason.split(':')[1].trim() : 'Unknown Table',
      heldAt: returnItem.returnedAt,
      cart: returnItem.items.map(item => ({
        id: item.itemId,
        name: item.itemName,
        price: item.refundAmount / item.quantity,
        sellingPrice: item.refundAmount / item.quantity,
        sellQuantity: (item as any).originalQuantity || item.quantity,
        quantity: 0,
        lowStockThreshold: 0,
        category: '',
        sourceType: 'Stock',
        isService: false,
      })),
      customer: returnItem.customerId ? { id: returnItem.customerId, name: returnItem.customerName || 'Walk-in Customer', email: '', phoneNumber: '', bookingIds: [], totalBookings: 0, lastVisit: new Date() } : null,
      heldByUid: returnItem.returnedByUid,
      heldByName: returnItem.returnedByName,
    };

    const receiptData = {
      heldSale: mockHeldSale,
      returnedItems: returnItem.items.map(item => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        refundAmount: item.refundAmount,
        originalQuantity: (item as any).originalQuantity || item.quantity,
        remainingQuantity: (item as any).remainingQuantity || 0,
      })),
      totalRefundAmount: returnItem.totalRefundAmount,
      remainingAmount: (returnItem as any).remainingAmount || 0,
      originalTotal: (returnItem as any).originalTotal || returnItem.totalRefundAmount,
      reason: returnItem.reason,
    };

    setReturnReceiptData(receiptData);
    setShowReturnReceipt(true);
  };

  const columns: ColumnDef<HeldSale>[] = React.useMemo(
    () => [
      {
        id: 'name',
        header: 'Table Name',
        accessorKey: 'name',
        cell: ({ row }) => {
          const sale = row.original;
          const hasUnprintedItems = sale.cart.some(item => (item.printedQuantity || 0) < item.sellQuantity);
          return (
            <div className="flex items-center gap-2">
              <span className="font-medium">{sale.name}</span>
              {hasUnprintedItems && (
                <Badge variant="destructive" className="text-xs">
                  <Bell className="h-3 w-3 mr-1" />
                  Unprinted
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'heldAt',
        header: 'Date Started',
        accessorKey: 'heldAt',
        cell: ({ row }) => {
          const date = getSafeDate(row.original.heldAt);
          return date ? format(date, 'PPpp') : 'N/A';
        },
      },
      {
        id: 'heldByName',
        header: 'Started By',
        accessorKey: 'heldByName',
        cell: ({ row }) => <Badge variant="outline">{row.original.heldByName}</Badge>,
      },
      {
        id: 'customer',
        header: 'Customer',
        accessorKey: 'customer.name',
        cell: ({ row }) => row.original.customer?.name || 'Walk-in Customer',
      },
      {
        id: 'totalItems',
        header: 'Total Items',
        accessorFn: (row) => row.cart.reduce((sum, item) => sum + Number(item.sellQuantity), 0),
        cell: ({ row }) => {
          const total = row.original.cart.reduce((sum, item) => sum + Number(item.sellQuantity), 0);
          const printed = row.original.cart.reduce((sum, item) => sum + Number(item.printedQuantity || 0), 0);
          return (
            <div className="text-center">
              <span>{total}</span>
              {printed > 0 && printed < total && (
                <span className="text-muted-foreground text-xs ml-1">({printed} printed)</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'totalAmount',
        header: () => <div className="text-right">Total Amount</div>,
        accessorFn: (row) =>
          row.cart.reduce((sum, item) => sum + (item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0), 0),
        cell: ({ row }) => {
          const total = row.original.cart.reduce(
            (sum, item) => sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)),
            0
          );
          return <div className="text-right font-semibold">{formatCurrency(total)}</div>;
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const sale = row.original;
          if (sale.linkedBillId) {
            return <Badge variant="secondary">Billed to Room</Badge>;
          }
          return <Badge variant="default">Active</Badge>;
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const sale = row.original;
          return (
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => handleOpenActions(sale)}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [currency]
  );

  const hasPrintedItems = (selectedSale?.cart || []).some(item => (item.printedQuantity || 0) > 0);
  const hasUnprintedItems = (selectedSale?.cart || []).some(item => (item.printedQuantity || 0) < item.sellQuantity);
  const isBilledToRoom = !!selectedSale?.linkedBillId;

  if (isLoading || areStaffLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopHeader
        name="Running Tables"
        icon={<List />}
        description={isBranchMode ? `Branch: ${currentBranch?.name}` : undefined}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Running Tables"
          value={stats.totalTables}
          icon={List}
          description="Active running tables"
        />
        <StatCard
          title="Printed Tables"
          value={stats.printedTables}
          icon={Printer}
          description="Tables with printed items"
        />
        <StatCard
          title="Total Amount"
          value={formatCurrency(stats.totalAmount)}
          icon={Calculator}
          description="Combined value of all tables"
        />
        <StatCard
          title="My Credit Sales"
          value={stats.myCreditSalesCount}
          icon={CreditCard}
          description={formatCurrency(stats.myCreditSalesAmount)}
          className="border-amber-500"
        />
        <StatCard
          title="Total Refunds"
          value={formatCurrency(refundStats.totalRefundAmount)}
          icon={Undo2}
          description={`${refundStats.totalRefundCount} refund transaction(s)`}
          className="border-destructive"
        />
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Active Tables
            {stats.totalTables > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.totalTables}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="credit" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            My Credit Sales
            {stats.myCreditSalesCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 border-amber-300">{stats.myCreditSalesCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History Dockets
            {(allDocketHistories || []).length > 0 && (
              <Badge variant="secondary" className="ml-1">{allDocketHistories?.length || 0}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Returns & Resets
            {((allStockReturns?.filter(r => r.source === 'RunningTable') || []).length + (allDocketHistories?.filter(h => h.actionType === 'Reset').length || 0)) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {(allStockReturns?.filter(r => r.source === 'RunningTable').length || 0) + (allDocketHistories?.filter(h => h.actionType === 'Reset').length || 0)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Active Tables Tab */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>All Running Tables</CardTitle>
                  <CardDescription>
                    View and manage all running tables. You can reset, delete, return items, or mark items as unprinted for re-printing.
                  </CardDescription>
                </div>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={areStaffLoading}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <SelectValue placeholder="Filter by user..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {allStaffMembers.map((staff) => (
                      <SelectItem key={staff.uid} value={staff.uid}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!heldSales || heldSales.length === 0 ? (
                <EmptyState
                  icon={List}
                  title="No Running Tables"
                  description={
                    selectedUserId === 'all'
                      ? 'There are no running tables at the moment.'
                      : 'No running tables found for the selected user.'
                  }
                  className="py-12"
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={heldSales}
                  filterColumn="name"
                  filterPlaceholder="Filter by table name or customer..."
                  tableId="running-tables-table"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Credit Sales Tab */}
        <TabsContent value="credit" className="mt-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                  My Credit Sales
                </CardTitle>
                <CardDescription>
                  View all your credit sales that are not yet paid. Once paid, they will be removed from this list.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const myCreditSales = (heldSales || []).filter(sale =>
                  sale.isCreditSale === true && sale.heldByUid === userProfile?.uid
                );

                if (myCreditSales.length === 0) {
                  return (
                    <EmptyState
                      icon={CreditCard}
                      title="No Credit Sales"
                      description="You don't have any pending credit sales. Credit sales will appear here when customers buy on credit."
                      className="py-12"
                    />
                  );
                }

                return (
                  <ScrollArea className="h-[500px]">
                    <div className="p-4 space-y-4">
                      {myCreditSales.map((sale) => {
                        const totalAmount = sale.cart.reduce((sum, item) =>
                          sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
                        );
                        const heldDate = getSafeDate(sale.heldAt);

                        return (
                          <div key={sale.id} className="border rounded-lg p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                    Credit
                                  </Badge>
                                  <span className="font-semibold text-lg">{sale.name}</span>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div className="flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4" />
                                    <span>Date: {heldDate ? format(heldDate, 'PPpp') : 'N/A'}</span>
                                    <span className="text-xs">({heldDate ? format(heldDate, 'EEEE') : ''})</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Customer: <span className="font-medium text-foreground">{sale.customer?.name || 'Walk-in Customer'}</span></span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Amount</p>
                                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalAmount)}</p>
                                <p className="text-xs text-muted-foreground mt-1">{sale.cart.length} item(s)</p>
                              </div>
                            </div>
                            {sale.cart && sale.cart.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-amber-200">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Items:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                                  {sale.cart.map((item, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span>{item.name} x{item.sellQuantity}</span>
                                      <span className="text-muted-foreground">{formatCurrency((item.price || item.sellingPrice || 0) * item.sellQuantity)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Dockets Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    History Dockets
                  </CardTitle>
                  <CardDescription>
                    View all past dockets that have been deleted, reset, or completed.
                  </CardDescription>
                </div>
                <DateRangePicker
                  date={historyDateRange}
                  onDateChange={setHistoryDateRange}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !filteredHistory || filteredHistory.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No History Dockets"
                  description={
                    historyDateRange?.from
                      ? 'No history found for the selected date range.'
                      : 'There are no history dockets yet. When tables are deleted or reset, they will appear here.'
                  }
                  className="py-12"
                />
              ) : (
                <>
                  <ScrollArea className="h-[500px]">
                    <div className="p-4 space-y-4">
                    {filteredHistory.map((history) => {
                      const actionDate = getSafeDate(history.actionAt);
                      const heldDate = getSafeDate(history.heldAt);
                      return (
                        <div key={history.id} className="border rounded-lg p-4 bg-card">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">{history.tableName}</h3>
                                <Badge
                                  variant={history.actionType === 'Deleted' ? 'destructive' : history.actionType === 'Reset' ? 'warning' : 'default'}
                                  className="text-xs"
                                >
                                  {history.actionType}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="h-4 w-4" />
                                  <span>Started: {heldDate ? format(heldDate, 'PPpp') : 'N/A'}</span>
                                  <span className="text-xs">({heldDate ? format(heldDate, 'EEEE') : ''})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>By: {history.heldByName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="h-4 w-4" />
                                  <span>{history.actionType}: {actionDate ? format(actionDate, 'PPpp') : 'N/A'}</span>
                                  <span className="text-xs">({actionDate ? format(actionDate, 'EEEE') : ''})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Processed by: {history.actionByName}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Amount</p>
                              <p className="text-lg font-bold">{formatCurrency(history.totalAmount)}</p>
                              <p className="text-xs text-muted-foreground mt-1">{history.items?.length || 0} items</p>
                              <p className="text-xs text-muted-foreground">{history.customerName}</p>
                            </div>
                          </div>
                          {history.items && history.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Items:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                                {history.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>{item.itemName} x{item.quantity}</span>
                                    <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Pagination Controls for History */}
                  {filteredHistory && filteredHistory.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                      <div className="text-sm text-muted-foreground">
                        Page {historyPage}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (historyPage === 1) {
                              handleHistoryPageReset();
                            } else {
                              handleHistoryPrev();
                            }
                          }}
                          disabled={historyPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        {filteredHistory.length >= historyPageSize && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleHistoryNext}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Returns & Resets Tab */}
        <TabsContent value="returns" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    Returns & Resets
                  </CardTitle>
                  <CardDescription>
                    View all returns and resets with full information including day, date, time, original and remaining amounts.
                  </CardDescription>
                </div>
                <DateRangePicker
                  date={returnsDateRange}
                  onDateChange={setReturnsDateRange}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {areReturnsLoading || isHistoryLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="p-4 space-y-4">
                    {/* Combine returns and resets */}
                    {(() => {
                      // Combine and sort by date (most recent first)
                      const combinedItems = [
                        ...filteredReturns.map(r => ({
                          type: 'return' as const,
                          id: r.id,
                          date: getSafeDate(r.returnedAt),
                          day: getSafeDate(r.returnedAt) ? format(getSafeDate(r.returnedAt)!, 'EEEE') : '',
                          dateStr: getSafeDate(r.returnedAt) ? format(getSafeDate(r.returnedAt)!, 'PPpp') : '',
                          user: r.returnedByName,
                          amount: r.totalRefundAmount,
                          originalTotal: (r as any).originalTotal || r.totalRefundAmount,
                          remainingAmount: (r as any).remainingAmount || 0,
                          items: r.items,
                          reason: r.reason,
                          customerName: r.customerName,
                          originalSaleId: r.originalSaleId,
                          rawData: r,
                        })),
                        ...filteredResets.map(h => ({
                          type: 'reset' as const,
                          id: h.id,
                          date: getSafeDate(h.actionAt),
                          day: getSafeDate(h.actionAt) ? format(getSafeDate(h.actionAt)!, 'EEEE') : '',
                          dateStr: getSafeDate(h.actionAt) ? format(getSafeDate(h.actionAt)!, 'PPpp') : '',
                          user: h.actionByName,
                          amount: h.totalAmount,
                          originalTotal: h.totalAmount,
                          remainingAmount: 0,
                          items: h.items,
                          reason: `Reset - All items returned to stock`,
                          customerName: h.customerName,
                          originalSaleId: h.originalSaleId,
                          rawData: null,
                        })),
                      ].sort((a, b) => {
                        if (!a.date || !b.date) return 0;
                        return b.date.getTime() - a.date.getTime();
                      });

                      if (combinedItems.length === 0) {
                        return (
                          <EmptyState
                            icon={RotateCcw}
                            title="No Returns or Resets"
                            description={
                              returnsDateRange?.from
                                ? 'No returns or resets found for the selected date range.'
                                : 'When items are returned or tables are reset, they will appear here.'
                            }
                            className="py-12"
                          />
                        );
                      }

                      return combinedItems.map((item) => (
                        <div key={`${item.type}-${item.id}`} className={`border rounded-lg p-4 ${item.type === 'return' ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20' : 'bg-red-50 border-red-200 dark:bg-red-950/20'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant={item.type === 'return' ? 'warning' : 'destructive'}
                                  className="text-xs"
                                >
                                  {item.type === 'return' ? 'RETURN' : 'RESET'}
                                </Badge>
                                <span className="text-sm font-medium text-muted-foreground">{item.originalSaleId}</span>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span>Day: <span className="font-medium text-foreground">{item.day || 'N/A'}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="h-4 w-4" />
                                  <span>Date/Time: {item.dateStr || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>By: <span className="font-medium text-foreground">{item.user}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>Customer: <span className="font-medium text-foreground">{item.customerName}</span></span>
                                </div>
                              </div>
                              {item.reason && (
                                <div className="mt-2 text-xs text-muted-foreground bg-white/50 p-2 rounded">
                                  <span className="font-medium">Reason:</span> {item.reason}
                                </div>
                              )}
                            </div>
                            <div className="text-right space-y-2">
                              {/* Original Total */}
                              <div className="bg-white/70 rounded p-2">
                                <p className="text-xs text-muted-foreground">Original Total</p>
                                <p className="text-lg font-bold">{formatCurrency(item.originalTotal)}</p>
                              </div>

                              {/* Return/Reset Amount */}
                              <div className={`rounded p-2 ${item.type === 'return' ? 'bg-orange-100' : 'bg-red-100'}`}>
                                <p className="text-xs text-muted-foreground">
                                  {item.type === 'return' ? 'Return Amount' : 'Reset Amount'}
                                </p>
                                <p className={`text-lg font-bold ${item.type === 'return' ? 'text-orange-600' : 'text-red-600'}`}>
                                  -{formatCurrency(item.amount)}
                                </p>
                              </div>

                              {/* Remaining Amount (only for returns) */}
                              {item.type === 'return' && (
                                <div className="bg-green-100 rounded p-2">
                                  <p className="text-xs text-green-600">Remaining</p>
                                  <p className="text-lg font-bold text-green-600">{formatCurrency(item.remainingAmount)}</p>
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">{item.items?.length || 0} items</p>

                              {/* Re-print button for returns */}
                              {item.type === 'return' && item.rawData && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => handleReprintReturnReceipt(item.rawData!)}
                                >
                                  <Printer className="h-3 w-3 mr-1" />
                                  Re-print Receipt
                                </Button>
                              )}
                            </div>
                          </div>
                          {item.items && item.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-black/10">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {item.type === 'return' ? 'Returned Items (with Original & Remaining):' : 'Reset Items:'}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {item.items.map((itemEntry, idx) => {
                                  const originalQty = (itemEntry as any).originalQuantity || itemEntry.quantity;
                                  const remainingQty = (itemEntry as any).remainingQuantity || 0;
                                  return (
                                    <div key={idx} className="flex flex-col p-2 bg-white/50 rounded">
                                      <div className="flex justify-between items-center">
                                        <span className={item.type === 'return' ? 'line-through text-muted-foreground' : 'font-medium'}>
                                          {itemEntry.itemName}
                                        </span>
                                        <span className="text-muted-foreground font-medium">
                                          {formatCurrency(itemEntry.refundAmount || (itemEntry.price * itemEntry.quantity))}
                                        </span>
                                      </div>
                                      {item.type === 'return' && (
                                        <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                                          <span>Original: <span className="font-medium">{originalQty}</span></span>
                                          <span>Returned: <span className="font-medium text-orange-600">{itemEntry.quantity}</span></span>
                                          <span>Remaining: <span className="font-medium text-green-600">{remainingQty}</span></span>
                                        </div>
                                      )}
                                      {item.type === 'reset' && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Qty: {itemEntry.quantity}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Pagination Controls for Returns */}
                  {(filteredReturns.length > 0 || filteredResets.length > 0) && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                      <div className="text-sm text-muted-foreground">
                        Page {returnsPage}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (returnsPage === 1) {
                              handleReturnsPageReset();
                            } else {
                              handleReturnsPrev();
                            }
                          }}
                          disabled={returnsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        {((filteredReturns.length + filteredResets.length) >= returnsPageSize) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReturnsNext}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={showActionsDialog}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showDeleteConfirm
                ? 'Confirm Deletion'
                : showResetConfirm
                  ? 'Confirm Reset'
                  : showUnprintConfirm
                    ? 'Return to Unprinted'
                    : `Actions for "${selectedSale?.name}"`}
            </DialogTitle>
            <DialogDescription>
              {showDeleteConfirm
                ? 'This action cannot be undone. The table will be deleted and items returned to stock.'
                : showResetConfirm
                  ? 'This will delete the table and return all items to stock.'
                  : showUnprintConfirm
                    ? 'This will mark all items as unprinted, allowing you to print them again.'
                    : `Manage this running table and its items.`}
            </DialogDescription>
          </DialogHeader>

          {!showDeleteConfirm && !showResetConfirm && !showUnprintConfirm ? (
            <div className="grid gap-3 py-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        // Print only unprinted items
                        setUnprintedSale(selectedSale);
                        handleCloseDialog();
                      }}
                      disabled={!hasUnprintedItems}
                    >
                      <Printer className="mr-2 h-4 w-4" /> Print Full Docket
                    </Button>
                  </div>
                </TooltipTrigger>
                {!hasUnprintedItems && (
                  <TooltipContent>
                    <p>All items have already been printed.</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setDraftSale(selectedSale);
                  handleCloseDialog();
                }}
              >
                <Eye className="mr-2 h-4 w-4" /> View Draft Docket
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-orange-600 hover:text-orange-700"
                onClick={() => {
                  if (!hasPermission(PagePermission.PROCESS_SALE_REFUNDS)) {
                    toast({
                      variant: 'destructive',
                      title: 'Permission Denied',
                      description: 'You do not have permission to process returns from running tables.',
                    });
                    return;
                  }
                  setShowActionsDialog(false);
                  setShowReturnItemDialog(true);
                  }}
                  >
                <Undo className="mr-2 h-4 w-4" /> Return Items
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowUnprintConfirm(true)}
                      disabled={!hasPrintedItems}
                    >
                      <Undo className="mr-2 h-4 w-4" /> Return to Unprinted
                    </Button>
                  </div>
                </TooltipTrigger>
                {!hasPrintedItems && (
                  <TooltipContent>
                    <p>No printed items to return to unprinted.</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => setShowResetConfirm(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Reset Table
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Table
              </Button>
            </div>
          ) : showDeleteConfirm ? (
            <div className="py-4">
              <p className="text-sm font-semibold">
                Are you sure you want to permanently delete the running table for "{selectedSale?.name}"?
              </p>
              {isBilledToRoom && (
                <p className="text-sm text-muted-foreground mt-2">
                  This table is billed to a room. The associated bill will also be removed.
                </p>
              )}
            </div>
          ) : showResetConfirm ? (
            <div className="py-4">
              <p className="text-sm font-semibold">
                Are you sure you want to reset the running table for "{selectedSale?.name}"?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                All items will be returned to stock and the table will be removed.
              </p>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-sm font-semibold">Return all items to unprinted status?</p>
              <p className="text-sm text-muted-foreground mt-2">
                This will reset the printed quantity to 0 for all items, allowing you to print them again.
              </p>
            </div>
          )}

          <DialogFooter>
            {!showDeleteConfirm && !showResetConfirm && !showUnprintConfirm ? (
              <Button variant="ghost" onClick={handleCloseDialog}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={handleCloseDialog} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  variant={showDeleteConfirm ? 'destructive' : 'default'}
                  onClick={showDeleteConfirm ? handleDeleteSale : showResetConfirm ? handleResetSale : handleUnprintItems}
                  disabled={isProcessing}
                  loading={isProcessing}
                >
                  {showDeleteConfirm
                    ? 'Yes, Delete'
                    : showResetConfirm
                      ? 'Yes, Reset'
                      : 'Yes, Return to Unprinted'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HeldSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        heldSale={saleToPrint}
        onPrinted={handleFullDocketPrinted}
      />

      <UnprintedItemsReceiptDialog
        isOpen={!!unprintedSale}
        onClose={() => setUnprintedSale(null)}
        heldSale={unprintedSale}
        onPrinted={handleUnprintedDocketPrinted}
      />

      <DraftDocketReceiptDialog
        isOpen={!!draftSale}
        onClose={() => setDraftSale(null)}
        heldSale={draftSale}
        getCollectionPath={getCollectionPath}
      />

      <ReturnItemDialog
        isOpen={showReturnItemDialog}
        onClose={() => {
          setShowReturnItemDialog(false);
          setReturnSale(null);
        }}
        heldSale={returnSale}
        onConfirm={handleReturnItems}
      />

      <ReturnReceiptDialog
        isOpen={showReturnReceipt}
        onClose={() => {
          setShowReturnReceipt(false);
          setReturnReceiptData(null);
        }}
        heldSale={returnReceiptData?.heldSale || null}
        returnedItems={returnReceiptData?.returnedItems || []}
        totalRefundAmount={returnReceiptData?.totalRefundAmount || 0}
        remainingAmount={returnReceiptData?.remainingAmount || 0}
        originalTotal={returnReceiptData?.originalTotal || 0}
        reason={returnReceiptData?.reason}
        onReprint={() => {}}
      />
    </div>
  );
}

export default withAuth(RunningTablesPage, PagePermission.MANAGE_RUNNING_TABLES);
