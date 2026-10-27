

'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, runTransaction, increment, updateDoc, writeBatch, serverTimestamp, collectionGroup, getDoc, getDocs } from 'firebase/firestore';
import type { HeldSale, CartItem, StockItem, Bill } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useBranch } from '@/contexts/branch-context';
import { EmptyState } from '@/components/ui/empty-state';
import { List, Trash2, Bell, BellRing } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { DataTable } from '../ui/data-table';
import { getHeldSalesColumns, renderHeldSaleSubComponent } from './held-sales-columns';
import { HeldSaleReceiptDialog } from './held-sale-receipt-dialog';
import { SingleItemReceiptDialog } from './single-item-receipt-dialog';
import { UnprintedItemsReceiptDialog } from './unprinted-items-receipt-dialog';
import type { RowSelectionState } from '@tanstack/react-table';
import { BulkActions } from './bulk-actions';
import { BulkDeleteHeldSalesDialog } from './bulk-delete-held-sales-dialog';
import { useUser } from '@/contexts/user-context';
import { usePOS } from '@/hooks/usePOS';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Animation styles for running tables
const pulseAnimation = `
  @keyframes table-pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
      transform: scale(1.01);
    }
  }
`;

interface HeldSalesSectionProps {
  onRestore: (sale: HeldSale) => void;
  onDelete: () => void;
}

const HeldSaleSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-7 w-20 mb-2" />
            <Skeleton className="h-4 w-16" />
        </CardContent>
        <CardFooter className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
        </CardFooter>
    </Card>
);

  export function HeldSalesSection({ onRestore, onDelete }: HeldSalesSectionProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const { getCollectionPath } = useBranch();
  const pos = usePOS({ userProfile, toast });

  const [saleToDelete, setSaleToDelete] = React.useState<HeldSale | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [saleToPrint, setSaleToPrint] = React.useState<HeldSale | null>(null);
  const [itemToPrint, setItemToPrint] = React.useState<{ sale: HeldSale, item: CartItem } | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [unprintedSale, setUnprintedSale] = React.useState<HeldSale | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteSales, setBulkDeleteSales] = React.useState<HeldSale[]>([]);

  const heldSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('heldSales')), orderBy('heldAt', 'desc'));
  }, [firestore, reloadCounter]);

  const { data: allHeldSales, isLoading } = useCollection<HeldSale>(heldSalesQuery);

  const heldSales = React.useMemo(() => {
    if (!allHeldSales) return [];
    if (userProfile?.role === 'Admin') {
      return allHeldSales;
    }
    return allHeldSales.filter(sale => sale.heldByUid === userProfile?.uid);
  }, [allHeldSales, userProfile]);

  const handleDeleteClick = (sale: HeldSale) => {
    setSaleToDelete(sale);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !saleToDelete) return;
    setIsDeleting(true);
    try {
        await pos.deleteHeldSale(saleToDelete);
        toast({ variant: 'success', title: 'Running Table Deleted', description: 'The table was deleted and any associated items were handled.' });
        setReloadCounter(c => c + 1);
        onDelete();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error Deleting Table', description: e.message });
    } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setSaleToDelete(null);
    }
  }

  const handleBulkDelete = (sales: HeldSale[]) => {
    const deletableSales = sales.filter(sale =>
        !(sale.cart || []).some(item => (item.printedQuantity || 0) > 0)
    );

    if (deletableSales.length < sales.length) {
        toast({
            variant: 'warning',
            title: 'Some Sales Cannot Be Deleted',
            description: 'Sales with printed items were automatically excluded from the deletion list.',
        });
    }

    if (deletableSales.length > 0) {
        setBulkDeleteSales(deletableSales);
    } else if (sales.length > 0) {
        toast({
            variant: 'destructive',
            title: 'Deletion Blocked',
            description: 'All selected sales have printed items and cannot be deleted.',
        });
    }
  };

  const confirmBulkDelete = async (salesToDelete: HeldSale[]) => {
    if (salesToDelete.length === 0) return;

    try {
      for (const sale of salesToDelete) {
        await pos.deleteHeldSale(sale);
      }
      toast({
        title: "Bulk Deletion Successful",
        description: `${salesToDelete.length} running table(s) were deleted and items returned to stock.`
      });
      setRowSelection({});
      onDelete();
      setReloadCounter(c => c + 1); // Trigger a reload
    } catch (e: any) {
        toast({ variant: "destructive", title: "Bulk Deletion Failed", description: e.message });
    }
  };


  const handleItemPrinted = async (saleId: string, itemId: string, printedQty: number) => {
    if (!firestore) return;
    const saleRef = doc(firestore, getCollectionPath('heldSales'), saleId);
    try {
      const sale = heldSales?.find(s => s.id === saleId);
      if (!sale) return;

      const updatedCart = sale.cart.map(item => {
        if (item.id === itemId) {
          return { ...item, printedQuantity: (item.printedQuantity || 0) + printedQty };
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
      const updatedCart = saleToPrint.cart.map(item => ({
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
      const updatedCart = unprintedSale.cart.map(item => ({
        ...item,
        printedQuantity: item.sellQuantity,
      }));
      await updateDoc(saleRef, { cart: updatedCart });
      setReloadCounter(c => c + 1);
    } catch (e) {
      console.error('Failed to update print status after unprinted docket print:', e);
      toast({ variant: 'destructive', title: 'Failed to update print status' });
    }
  };


  const columns = React.useMemo(() => getHeldSalesColumns({
    currency: settings?.currency || 'USD',
    onRestore,
    onDelete: handleDeleteClick,
    onPrint: setSaleToPrint,
    onPrintItem: (sale, item) => setItemToPrint({ sale, item }),
    onPrintAllUnprinted: handleAllItemsPrinted,
  }), [settings?.currency, onRestore]);

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

  return (
    <>
        <style>{pulseAnimation}</style>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="relative overflow-hidden">
            {/* Animated notification badge when there are running tables */}
            {heldSales && heldSales.length > 0 && (
              <motion.div
                className="absolute top-3 right-3 z-10"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Badge
                  variant="default"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                >
                  <BellRing className="h-3 w-3 mr-1 animate-pulse" />
                  {heldSales.length} Active
                </Badge>
              </motion.div>
            )}
             <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        rotate: heldSales && heldSales.length > 0 ? [0, 5, -5, 0] : 0
                      }}
                      transition={{
                        duration: 2,
                        repeat: heldSales && heldSales.length > 0 ? Infinity : 0,
                        repeatDelay: 3
                      }}
                    >
                      <List className="h-5 w-5" />
                    </motion.div>
                    Running Tables
                  </CardTitle>
                </div>
                <CardDescription>
                    These are tables that are currently active. Add more items to continue, or delete them to return items to stock.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <DataTable
                    columns={columns}
                    data={heldSales}
                    filterColumn="name"
                    filterPlaceholder="Filter by name or customer..."
                    tableId="held-sales-table"
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    renderSubComponent={(props) => renderHeldSaleSubComponent({ ...props, currency: settings?.currency || 'USD', onPrintItem: (sale, item) => setItemToPrint({ sale, item }), onPrintAllUnprinted: handleAllItemsPrinted })}
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
        </motion.div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Running Table?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the running table "{saleToDelete?.name}"? The items will be returned to stock. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting} onClick={() => setSaleToDelete(null)}>Cancel</AlertDialogCancel>
                    <Button variant="destructive" onClick={handleDeleteConfirm} loading={isDeleting}>
                        Delete
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

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
        <BulkDeleteHeldSalesDialog
            isOpen={bulkDeleteSales.length > 0}
            onClose={() => setBulkDeleteSales([])}
            sales={bulkDeleteSales}
            onConfirm={confirmBulkDelete}
        />
    </>
  );
}
