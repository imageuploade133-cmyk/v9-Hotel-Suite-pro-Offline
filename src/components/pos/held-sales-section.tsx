
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { HeldSale, CartItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { List, Trash2, RotateCcw, Printer, Info, Undo2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { DataTable } from '../ui/data-table';
import { getHeldSalesColumns, renderHeldSaleSubComponent } from './held-sales-columns';
import { HeldSaleReceiptDialog } from './held-sale-receipt-dialog';
import { SingleItemReceiptDialog } from './single-item-receipt-dialog';
import { UnprintedItemsReceiptDialog } from './unprinted-items-receipt-dialog';
import { DraftDocketReceiptDialog } from './draft-docket-receipt-dialog';
import type { RowSelectionState } from '@tanstack/react-table';
import { BulkActions } from './bulk-actions';
import { BulkDeleteHeldSalesDialog } from './bulk-delete-held-sales-dialog';
import { useUser } from '@/contexts/user-context';
import { usePOS } from '@/hooks/usePOS';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { useBranch } from '@/contexts/branch-context';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { ReturnItemDialog } from '@/components/running-tables/return-item-dialog';

interface HeldSalesSectionProps {
  onRestore: (sale: HeldSale) => void;
  onDelete: () => void;
}

export function HeldSalesSection({ onRestore, onDelete }: HeldSalesSectionProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { deleteHeldSale } = usePOS({ userProfile, toast });
  const { settings } = useSettings();
  const { getCollectionPath } = useBranch();
  const { hasPermission } = usePermissions();
  const currency = settings?.currency || 'USD';

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [saleToPrint, setSaleToPrint] = React.useState<HeldSale | null>(null);
  const [itemToPrint, setItemToPrint] = React.useState<{ sale: HeldSale, item: CartItem } | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [unprintedSale, setUnprintedSale] = React.useState<HeldSale | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteSales, setBulkDeleteSales] = React.useState<HeldSale[]>([]);
  const [actionsSale, setActionsSale] = React.useState<HeldSale | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [draftSale, setDraftSale] = React.useState<HeldSale | null>(null);
  const [showReturnItemDialog, setShowReturnItemDialog] = React.useState(false);
  const [returnSale, setReturnSale] = React.useState<HeldSale | null>(null);

  const heldSalesQuery = React.useMemo(() => {
    if (!firestore || !userProfile) return null;

    const baseQuery = collection(firestore, getCollectionPath('heldSales'));

    if (userProfile.role === 'Admin') {
        return query(baseQuery, orderBy('heldAt', 'desc'));
    } else {
        return query(baseQuery, where('heldByUid', '==', userProfile.uid), orderBy('heldAt', 'desc'));
    }
}, [firestore, reloadCounter, userProfile]);

  const { data: heldSales, isLoading } = useCollection<HeldSale>(heldSalesQuery);

  const handleOpenActions = (sale: HeldSale) => {
    setActionsSale(sale);
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !actionsSale) return;
    setIsDeleting(true);
    try {
        await deleteHeldSale(actionsSale);
        toast({ variant: 'success', title: 'Running Table Deleted', description: 'The table was deleted and any associated items were handled.' });
        setReloadCounter(c => c + 1);
        onDelete();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error Deleting Table', description: e.message });
    } finally {
        setIsDeleting(false);
        setActionsSale(null);
        setShowDeleteConfirm(false);
    }
  };

  const handleBulkDelete = (sales: HeldSale[]) => {
    setBulkDeleteSales(sales);
  };

  const confirmBulkDelete = async (salesToDelete: HeldSale[]) => {
    if (salesToDelete.length === 0) return;

    try {
      for (const sale of salesToDelete) {
        await deleteHeldSale(sale);
      }
      toast({
        title: "Bulk Deletion Successful",
        description: `${salesToDelete.length} running table(s) were deleted and associated records updated.`
      });
      setRowSelection({});
      onDelete();
      setReloadCounter(c => c + 1); // Trigger a reload
    } catch (e: any) {
        toast({ variant: "destructive", title: "Bulk Deletion Failed", description: e.message });
    }
  };


  const handleItemPrinted = async (saleId: string, itemId: string, printedQty: number) => {
    if (!firestore || !heldSales) return;
    const saleRef = doc(firestore, getCollectionPath('heldSales'), saleId);
    try {
      // CRITICAL: Fetch the LATEST document from Firestore to avoid using stale local state
      const saleDoc = await getDoc(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Running table not found');
      }

      const currentCart = saleDoc.data()?.cart || [];

      const updatedCart = currentCart.map(item => {
        if (item.id === itemId) {
          // CRITICAL: Add to existing printedQuantity, don't replace it
          const existingPrinted = item.printedQuantity || 0;
          return { ...item, printedQuantity: existingPrinted + printedQty };
        }
        return item;
      });

      await updateDoc(saleRef, { cart: updatedCart });
      setReloadCounter(c => c + 1);
    } catch (e) {
      console.error("Failed to update printed quantity:", e);
      toast({ variant: "destructive", title: "Failed to update print status" });
    }
  };

  const handleAllItemsPrinted = (saleToUpdate: HeldSale) => {
    setUnprintedSale(saleToUpdate);
  };

  const handleFullDocketPrinted = async () => {
    if (!firestore || !saleToPrint) return;
    const saleRef = doc(firestore, getCollectionPath('heldSales'), saleToPrint.id);
    try {
      // CRITICAL: Fetch the LATEST document from Firestore to avoid using stale local state
      const saleDoc = await getDoc(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Running table not found');
      }

      const currentCart = saleDoc.data()?.cart || [];

      const updatedCart = currentCart.map(item => ({
        ...item,
        printedQuantity: item.sellQuantity,
      }));
      await updateDoc(saleRef, { cart: updatedCart });
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

      // Only update items that have unprinted quantities
      const updatedCart = currentCart.map(item => {
        const unprintedQty = item.sellQuantity - (item.printedQuantity || 0);
        if (unprintedQty > 0) {
          // Mark only the unprinted portion as printed
          // CRITICAL: Add to existing printedQuantity, don't replace it
          const existingPrinted = item.printedQuantity || 0;
          return { ...item, printedQuantity: existingPrinted + unprintedQty };
        }
        // Keep existing printed quantity for already printed items
        return item;
      });
      await updateDoc(saleRef, { cart: updatedCart });
      setReloadCounter(c => c + 1);
    } catch (e) {
      console.error('Failed to update print status after unprinted docket print:', e);
      toast({ variant: 'destructive', title: 'Failed to update print status' });
    }
  };


  const columns = React.useMemo(() => getHeldSalesColumns({
    currency: currency,
    onRestore: onRestore,
    onDelete: (sale) => {
      setActionsSale(sale);
      setShowDeleteConfirm(true);
    },
    onPrint: (sale) => setSaleToPrint(sale),
    onPrintItem: (sale, item) => setItemToPrint({ sale, item }),
    onPrintAllUnprinted: handleAllItemsPrinted,
    onOpenActions: handleOpenActions,
  }), [currency, onRestore]);

  if (isLoading) {
    return (
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
    );
  }

  if (!heldSales || heldSales.length === 0) {
    return (
      <EmptyState
        icon={List}
        title="No Running Tables"
        description="Tables that are currently active will appear here."
      />
    );
  }

  const hasPrintedItems = (actionsSale?.cart || []).some(item => (item.printedQuantity || 0) > 0);
  const isBilledToRoom = !!actionsSale?.linkedBillId;
  const canDelete = !hasPrintedItems && !isBilledToRoom;

  // Credit sale return logic
  const isCreditSale = actionsSale?.isCreditSale === true;
  const hasReturnsPermission = hasPermission(PagePermission.PROCESS_SALE_REFUNDS);
  const hasRolesPermission = hasPermission(PagePermission.MANAGE_ROLES);
  // For credit sales: can only return if no items are printed (docket not printed)
  const canReturnCreditSale = isCreditSale && !hasPrintedItems;
  // For non-credit sales: can return if user has permission (existing behavior)
  const canReturn = !isCreditSale && (hasReturnsPermission || hasRolesPermission);

  // Handler for returning items from running table
  const handleReturnItems = async (
    sale: HeldSale,
    itemsToReturn: { itemId: string; quantity: number; itemName: string; price: number }[],
    reason: string
  ) => {
    if (!firestore || !sale) return;

    const { increment, doc, collection, runTransaction } = await import('firebase/firestore');

    // Calculate totals
    const originalTotal = sale.cart.reduce((sum, item) =>
      sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
    );
    const totalRefundAmount = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const remainingAmount = originalTotal - totalRefundAmount;

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
          reason: reason || `Return from POS Running Table: ${sale.name}`,
          returnedAt: new Date(),
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
          const { collection: col, doc: d, serverTimestamp } = await import('firebase/firestore');
          const docketHistoryRef = d(collection(firestore, getCollectionPath('docketHistory')));
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
            actionAt: new Date(),
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
        }
      });

      toast({
        variant: 'success',
        title: 'Items Returned',
        description: 'Selected items have been returned and removed from the running table.',
      });

      setReloadCounter(c => c + 1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Returning Items', description: e.message });
    }
  };

  return (
    <>
        <Card>
             <CardHeader>
                <CardTitle>Running Tables</CardTitle>
                <CardDescription>
                    These are tables that are currently active. Add more items to continue, or delete them to return items to stock.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <DataTable
                    columns={columns}
                    data={heldSales || []}
                    filterColumn="name"
                    filterPlaceholder="Filter by name or customer..."
                    tableId="held-sales-table"
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    renderSubComponent={(props) => renderHeldSaleSubComponent({ ...props, currency: currency, onPrintItem: (sale, item) => setItemToPrint({ sale, item }), onPrintAllUnprinted: handleAllItemsPrinted })}
                >
                    {(table) => (
                        <BulkActions
                            table={table}
                            onBulkDelete={handleBulkDelete}
                        />
                    )}
                </DataTable>
            </CardContent>
        </Card>

        <Dialog open={!!actionsSale} onOpenChange={(open) => {
            if (!open) {
                setActionsSale(null);
                setShowDeleteConfirm(false);
            }
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{showDeleteConfirm ? 'Confirm Deletion' : `Actions for "${actionsSale?.name}"`}</DialogTitle>
                     <DialogDescription>
                        {showDeleteConfirm
                            ? "This action cannot be undone. Associated billings will be removed and items will be returned to stock."
                            : (
                                <>
                                    {actionsSale?.customer?.name && `Customer: ${actionsSale.customer.name}`}
                                    <br />
                                    {actionsSale?.heldAt && `Started on: ${format(getSafeDate(actionsSale.heldAt)!, 'PPpp')}`}
                                </>
                            )
                        }
                    </DialogDescription>
                </DialogHeader>

                {!showDeleteConfirm ? (
                    <div className="grid gap-3 py-4">
                        <Button variant="outline" className="w-full justify-start" onClick={() => { onRestore(actionsSale!); setActionsSale(null); }}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Add New Item
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => { setUnprintedSale(actionsSale); setActionsSale(null); }}>
                            <Printer className="mr-2 h-4 w-4" /> Print Full Docket
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => { setDraftSale(actionsSale); setActionsSale(null); }}>
                            <Printer className="mr-2 h-4 w-4" /> Print Draft Docket
                        </Button>

                        {hasRolesPermission && (
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div className="w-full">
                                      <Button
                                          variant="outline"
                                          className="w-full justify-start text-orange-600 hover:text-orange-700"
                                          onClick={() => {
                                              // Check if it's a credit sale - only allow if no items printed
                                              if (isCreditSale) {
                                                  if (hasPrintedItems) {
                                                      // Credit sale with printed items - block
                                                      toast({
                                                          variant: 'destructive',
                                                          title: 'Cannot Return',
                                                          description: 'Credit sale docket has already been printed. Returns not allowed.',
                                                      });
                                                      return;
                                                  }
                                                  // Credit sale without printed items - allow
                                                  setReturnSale(actionsSale);
                                                  setShowReturnItemDialog(true);
                                                  setActionsSale(null);
                                                  return;
                                              }
                                              // For non-credit sales: check permission
                                              if (!hasPermission(PagePermission.PROCESS_SALE_REFUNDS) && !hasRolesPermission) {
                                                  toast({
                                                      variant: 'destructive',
                                                      title: 'Permission Denied',
                                                      description: 'You do not have permission to process returns from running tables.',
                                                  });
                                                  return;
                                              }
                                              setReturnSale(actionsSale);
                                              setShowReturnItemDialog(true);
                                              setActionsSale(null);
                                          }}
                                          disabled={isCreditSale ? !canReturnCreditSale : !canReturn}
                                      >
                                          <Undo2 className="mr-2 h-4 w-4" /> Return Items
                                      </Button>
                                  </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                  {isCreditSale ? (
                                      hasPrintedItems ? (
                                          <p>Cannot return credit sale items - docket has already been printed.</p>
                                      ) : (
                                          <p>Return credit sale items (Cancel Credit/Returns Credit sales)</p>
                                      )
                                  ) : (
                                      !hasReturnsPermission && !hasRolesPermission ? (
                                          <p>You do not have permission to process returns.</p>
                                      ) : (
                                          <p>Return items from this running table.</p>
                                      )
                                  )}
                              </TooltipContent>
                          </Tooltip>
                        )}

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="w-full">
                                        <Button variant="destructive" className="w-full justify-start" onClick={() => setShowDeleteConfirm(true)} disabled={!canDelete}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Sale
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                {!canDelete && (
                                <TooltipContent>
                                    <p className="flex items-center gap-2">
                                    <Info className="h-4 w-4" /> {isBilledToRoom ? "Cannot delete billed sale." : "Cannot delete sale with printed items."}
                                    </p>
                                </TooltipContent>
                                )}
                            </Tooltip>

                    </div>
                ) : (
                    <div className="py-4">
                        <p className="text-sm font-semibold">Are you sure you want to permanently delete the running table for "{actionsSale?.name}"?</p>
                    </div>
                )}

                <DialogFooter>
                    {!showDeleteConfirm ? (
                        <Button variant="ghost" onClick={() => { setActionsSale(null); }}>Close</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                loading={isDeleting}
                            >
                                Yes, Delete Sale
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

        <SingleItemReceiptDialog
          isOpen={!!itemToPrint}
          onClose={() => setItemToPrint(null)}
          sale={itemToPrint?.sale || null}
          item={itemToPrint?.item || null}
          onSuccess={(qty) => handleItemPrinted(itemToPrint!.sale.id, itemToPrint!.item.id, qty)}
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
        <BulkDeleteHeldSalesDialog
            isOpen={bulkDeleteSales.length > 0}
            onClose={() => setBulkDeleteSales([])}
            sales={bulkDeleteSales}
            onConfirm={confirmBulkDelete}
        />
    </>
  );
}
