'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import type { StockItem, StockSale, StockReturn, Payment, UserProfile, Transaction } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign, Package, Undo2, Download, Loader2, CreditCard, ChevronDown, Hand, Search, ArrowLeft, Minus, Plus, Eye, Printer, Undo2 as UndoIcon } from 'lucide-react';
import HistoryLoading from './HistoryLoading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, format, isToday } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exportToCsv } from '@/lib/csv-export';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/ui/data-table';
import { useSalesHistoryColumns } from '@/components/sales-history/columns';
import { StockSaleReceiptDialog } from '../stock/stock-sale-receipt-dialog';
import { useUser } from '@/contexts/user-context';
import { ViewSaleDetailsDialog } from '../stock/view-sale-details-dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { processRefund, type RefundItem, calculateNetRevenue } from '@/lib/refund-service';

interface HistorySectionProps {
  searchTerm: string;
}

type TransactionWithPayments = (StockSale | StockReturn) & {
  type: 'Sale' | 'Return';
  amountPaid?: number;
};

export function HistorySection({ searchTerm }: HistorySectionProps) {
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { getCollectionPath, isGlobalMode } = useBranch();

  const [saleToView, setSaleToView] = React.useState<StockSale | null>(null);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [actionsSale, setActionsSale] = React.useState<Transaction | null>(null);
  const { hasPermission } = usePermissions();
  const canProcessRefunds = hasPermission(PagePermission.PROCESS_SALE_REFUNDS);

  // State for the integrated refund UI
  const [showRefundUI, setShowRefundUI] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState('');
  const [itemsToReturn, setItemsToReturn] = React.useState<Record<string, number>>({});
  const [refundSearchTerm, setRefundSearchTerm] = React.useState('');

  // Branch mode queries
  const branchSalesQuery = React.useMemo(() => {
    return !isGlobalMode && firestore
      ? query(
          collection(firestore, getCollectionPath('stockSales')),
          orderBy('soldAt', 'desc'),
          limit(50)
        )
      : null;
  }, [firestore, isGlobalMode, getCollectionPath, reloadCounter]);

  const branchReturnsQuery = React.useMemo(() => {
    return !isGlobalMode && firestore
      ? query(
          collection(firestore, getCollectionPath('stockReturns')),
          orderBy('returnedAt', 'desc'),
          limit(50)
        )
      : null;
  }, [firestore, isGlobalMode, getCollectionPath, reloadCounter]);

  // Global mode queries
  const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', [orderBy('soldAt', 'desc')]);
  const globalReturnsResult = useGlobalCollectionData<StockReturn>('stockReturns', [orderBy('returnedAt', 'desc')]);

  const branchSalesResult = useCollection<StockSale>(branchSalesQuery);
  const branchReturnsResult = useCollection<StockReturn>(branchReturnsQuery);

  // Use appropriate result based on mode
  const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;
  const { data: returns, isLoading: areReturnsLoading } = isGlobalMode ? globalReturnsResult : branchReturnsResult;

  const creditPaymentsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'payments'), where('type', '==', 'Credit Repayment'));
  }, [firestore, reloadCounter]);

  const { data: creditPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(creditPaymentsQuery);

  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    if (!usersData) return new Map();
    return new Map(usersData.map((u) => [u.uid, u]));
  }, [usersData]);

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const handleConfirmRefund = async () => {
    if (!actionsSale || actionsSale.type !== 'Sale') return;

    const itemsToReturnArray: RefundItem[] = Object.entries(itemsToReturn)
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => {
        const item = (actionsSale as StockSale).items.find((i) => i.itemId === itemId);
        if (!item) throw new Error('Item not found during refund processing');
        return {
          itemId,
          quantity,
          itemName: item.itemName,
          sellingPrice: item.sellingPrice,
        };
      });

    if (itemsToReturnArray.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Items Selected',
        description: 'Please select a quantity to return for at least one item.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await processRefund(actionsSale as StockSale, itemsToReturnArray, refundReason, {
        firestore,
        getCollectionPath,
        userProfile: userProfile!,
        formatCurrency,
      });

      if (result.success) {
        toast({
          variant: 'success',
          title: 'Refund Processed',
          description: `Refund of ${formatCurrency(result.totalRefundAmount)} has been successfully processed.`,
        });
        setReloadCounter((c) => c + 1);
        handleCloseActions();
      } else {
        toast({
          variant: 'destructive',
          title: 'Refund Failed',
          description: result.error || 'Failed to process refund',
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Refund Failed',
        description: err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const combinedData: TransactionWithPayments[] = React.useMemo(() => {
    const saleItems = sales || [];
    const returnItems = returns || [];

    let combined = [
      ...saleItems.map((s) => ({ ...s, type: 'Sale' as const })),
      ...returnItems.map((r) => ({ ...r, type: 'Return' as const })),
    ];

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      combined = combined.filter((t) => {
        if (t.type === 'Sale') {
          return (
            (t as StockSale).saleId.toLowerCase().includes(lowercasedTerm) ||
            (t as StockSale).customerName?.toLowerCase().includes(lowercasedTerm)
          );
        }
        if (t.type === 'Return') {
          return (
            (t as StockReturn).refundId?.toLowerCase().includes(lowercasedTerm) ||
            (t as StockReturn).customerName?.toLowerCase().includes(lowercasedTerm)
          );
        }
        return false;
      });
    }

    const sorted = combined.sort((a, b) => {
      const dateA = getSafeDate((a as StockSale).soldAt || (a as StockReturn).returnedAt);
      const dateB = getSafeDate((b as StockSale).soldAt || (b as StockReturn).returnedAt);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });

    return sorted.map((t) => {
      if (t.type === 'Sale' && t.paymentMethod === 'Credit') {
        const sale = t as StockSale;
        const repaymentsForSale = (creditPayments || []).filter((p) => p.bookingId === sale.id);
        const totalRepaid = repaymentsForSale.reduce((sum, p) => sum + p.amount, 0);
        return { ...t, amountPaid: totalRepaid + (sale.initialPaymentAmount || 0) };
      }
      return t;
    });
  }, [sales, returns, searchTerm, creditPayments]);

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const safeSales = sales || [];
    const safeReturns = returns || [];

    const totalSalesValue = safeSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalRefundsValue = safeReturns.reduce((acc, ret) => acc + ret.totalRefundAmount, 0);
    const netRevenue = totalSalesValue - totalRefundsValue;
    const totalItemsRefunded = safeReturns.reduce((sum, r) => sum + r.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);
    const itemsSold = safeSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

    return {
      totalSalesValue,
      totalRefundsValue,
      netRevenue,
      totalItemsRefunded,
      itemsSold,
    };
  }, [sales, returns]);

  const columns = useSalesHistoryColumns({
    currency: currency,
    onActions: setActionsSale,
    userMap,
  });

  const isLoading = areSalesLoading || areUsersLoading || arePaymentsLoading || areReturnsLoading;

  const handleCloseActions = () => {
    setActionsSale(null);
    setShowRefundUI(false);
    setItemsToReturn({});
    setRefundReason('');
    setRefundSearchTerm('');
  };

  const saleForRefund = actionsSale?.type === 'Sale' ? (actionsSale as StockSale) : null;

  const availableItemsToReturn = React.useMemo(
    () =>
      saleForRefund?.items
        .map((item) => {
          const alreadyRefunded = (saleForRefund.refundedItems || [])
            .filter((ri) => ri.itemId === item.itemId)
            .reduce((sum, ri) => sum + ri.quantity, 0);
          return { ...item, availableToReturn: item.quantity - alreadyRefunded };
        })
        .filter((item) => item.availableToReturn > 0) || [],
    [saleForRefund]
  );

  const filteredItemsToReturn = React.useMemo(() => {
    if (!refundSearchTerm) return availableItemsToReturn;
    return availableItemsToReturn.filter((item) =>
      item.itemName.toLowerCase().includes(refundSearchTerm.toLowerCase())
    );
  }, [availableItemsToReturn, refundSearchTerm]);

  const handleQuantityChange = (itemId: string, currentQuantity: number, change: number) => {
    const originalItem = availableItemsToReturn.find((i) => i.itemId === itemId);
    if (!originalItem) return;

    const currentReturnQty = itemsToReturn[itemId] || 0;
    const newReturnQty = currentReturnQty + change;

    if (newReturnQty >= 0 && newReturnQty <= originalItem.availableToReturn) {
      setItemsToReturn((prev) => ({ ...prev, [itemId]: newReturnQty }));
    }
  };

  const handleSelectAllFiltered = (checked: boolean | 'indeterminate') => {
    const newItemsToReturn = { ...itemsToReturn };
    if (checked) {
      filteredItemsToReturn.forEach((item) => {
        newItemsToReturn[item.itemId] = item.availableToReturn;
      });
    } else {
      filteredItemsToReturn.forEach((item) => {
        delete newItemsToReturn[item.itemId];
      });
    }
    setItemsToReturn(newItemsToReturn);
  };

  const totalRefundAmount = Object.entries(itemsToReturn).reduce((sum, [itemId, quantity]) => {
    const item = saleForRefund?.items.find((i) => i.itemId === itemId);
    return sum + (item?.sellingPrice || 0) * quantity;
  }, 0);

  const allFilteredSelected =
    filteredItemsToReturn.length > 0 &&
    filteredItemsToReturn.every((item) => (itemsToReturn[item.itemId] || 0) === item.availableToReturn);
  const someFilteredSelected = filteredItemsToReturn.some((item) => (itemsToReturn[item.itemId] || 0) > 0);

  if (isLoading) {
    return <HistoryLoading />;
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          title="Total Sales"
          value={formatCurrency(summaryStats.totalSalesValue)}
          icon={DollarSign}
          description="Total sales value"
          className="border-green-500 text-green-500"
        />
        <StatCard
          title="Net Revenue"
          value={formatCurrency(summaryStats.netRevenue)}
          icon={DollarSign}
          description="Sales minus refunds"
          className="border-primary"
        />
        <StatCard
          title="Items Sold"
          value={summaryStats.itemsSold.toLocaleString()}
          icon={Package}
          description="Total units sold"
        />
        <StatCard
          title="Total Refunds"
          value={formatCurrency(summaryStats.totalRefundsValue)}
          icon={Undo2}
          description={`From ${summaryStats.totalItemsRefunded} items`}
          className="border-destructive text-destructive"
        />
      </div>

      <DataTable columns={columns} data={combinedData} isLoading={isLoading} tableId="pos-history-dialog" />
      <Dialog open={!!actionsSale} onOpenChange={handleCloseActions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {showRefundUI ? `Refund Sale #${(actionsSale as StockSale)?.saleId}` : 'Actions for Transaction'}
            </DialogTitle>
            <DialogDescription>
              {showRefundUI
                ? 'Select items to return to stock.'
                : `ID: ${(actionsSale as StockSale)?.saleId || (actionsSale as StockReturn)?.refundId}`}
            </DialogDescription>
          </DialogHeader>

          {!showRefundUI ? (
            <div className="grid gap-3 py-4">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setSaleToView(actionsSale as StockSale);
                  setActionsSale(null);
                }}
              >
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setSaleToPrint(actionsSale as StockSale);
                  setActionsSale(null);
                }}
              >
                <Printer className="mr-2 h-4 w-4" /> Reprint Receipt
              </Button>
              {actionsSale?.type === 'Sale' && (
                <Button
                  variant="destructive"
                  className="justify-start"
                  onClick={() => setShowRefundUI(true)}
                  disabled={(actionsSale as StockSale).status === 'Refunded' || !canProcessRefunds}
                >
                  <UndoIcon className="mr-2 h-4 w-4" /> Refund Sale
                </Button>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items to return..."
                    value={refundSearchTerm}
                    onChange={(e) => setRefundSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-filtered"
                    checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => handleSelectAllFiltered(checked)}
                    disabled={filteredItemsToReturn.length === 0}
                  />
                  <Label htmlFor="select-all-filtered">Select All ({filteredItemsToReturn.length})</Label>
                </div>
              </div>
              <ScrollArea className="max-h-60 border rounded-md">
                <div className="p-4 space-y-3">
                  {filteredItemsToReturn.length > 0 ? (
                    filteredItemsToReturn.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg bg-background"
                      >
                        <div className="flex-1">
                          <p className="font-semibold">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            Purchased: {item.quantity} | Available to Return: {item.availableToReturn}
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleQuantityChange(item.itemId, item.quantity, -1)}
                            disabled={(itemsToReturn[item.itemId] || 0) <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={itemsToReturn[item.itemId] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setItemsToReturn((prev) => ({
                                ...prev,
                                [item.itemId]: Math.max(0, Math.min(val, item.availableToReturn)),
                              }));
                            }}
                            className="w-16 h-8 text-center font-bold"
                            max={item.availableToReturn}
                            min={0}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleQuantityChange(item.itemId, item.quantity, 1)}
                            disabled={(itemsToReturn[item.itemId] || 0) >= item.availableToReturn}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-10">No items match your search.</p>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 rounded-lg border bg-muted">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total Refund Amount:</span>
                  <span className="text-destructive">{formatCurrency(totalRefundAmount)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refund-reason">Reason for Refund (Optional)</Label>
                <Textarea
                  id="refund-reason"
                  placeholder="e.g., Customer returned damaged item, wrong product sold..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {!showRefundUI ? (
              <Button variant="ghost" onClick={handleCloseActions}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowRefundUI(false)} disabled={isProcessing}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmRefund}
                  loading={isProcessing}
                  disabled={totalRefundAmount <= 0}
                >
                  <UndoIcon className="mr-2 h-4 w-4" />
                  Confirm Refund
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ViewSaleDetailsDialog isOpen={!!saleToView} onClose={() => setSaleToView(null)} sale={saleToView} currency={currency} />
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
        allUsers={usersData || []}
        dataReady={!!usersData && !areUsersLoading}
      />
    </>
  );
}
