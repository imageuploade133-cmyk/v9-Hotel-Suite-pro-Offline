'use client';

import * as React from 'react';
import { commitLocalFirstMutations } from '@/lib/lan-sync/sync-helper';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Plus, ConciergeBell, DollarSign, CalendarCheck, Package, TrendingUp, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockSale, ServiceItem } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc, collection, query, orderBy, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { AddEditServiceItemDialog } from '@/components/stock/add-edit-service-dialog';
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
import { ServiceManagement, type UnifiedItem } from '@/components/stock/service-management';
import { TopHeader } from '@/components/top-header';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { useUser } from '@/contexts/user-context';
import { getSafeDate } from '@/lib/helpers';
import { where } from 'firebase/firestore';
import { isToday, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { ServiceSalesLogDialog } from '@/components/stock/service-sales-log-dialog';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/use-permissions';

function ServicesPage() {
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
    const [selectedService, setSelectedService] = React.useState<UnifiedItem | null>(null);
    const [selectedServiceForLog, setSelectedServiceForLog] = React.useState<UnifiedItem | null>(null);
    const [reloadCounter, setReloadCounter] = React.useState(0);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [restockItem, setRestockItem] = React.useState<UnifiedItem | null>(null);
    const [restockQuantity, setRestockQuantity] = React.useState('');
    const [restockUnitCost, setRestockUnitCost] = React.useState('');
    const [restockNotes, setRestockNotes] = React.useState('');
    const [isRestocking, setIsRestocking] = React.useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();
    const { settings } = useSettings();
    const { getCollectionPath, currentBranch, isBranchMode, isGlobalMode } = useBranch();
    const { userProfile } = useUser();
    const { hasPermission } = usePermissions();
    const canRestock = hasPermission(PagePermission.RESTOCK_INVENTORY);

    // Branch mode queries
    const branchSalesQuery = React.useMemo(() => {
        return !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null;
    }, [firestore, isGlobalMode, getCollectionPath]);
    const branchSalesResult = useCollection<StockSale>(branchSalesQuery);

    // Global mode queries
    const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', []);

    // Use appropriate result based on mode
    const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;

    const branchRestockQuery = React.useMemo(() => !isGlobalMode && firestore
      ? query(collection(firestore, getCollectionPath('serviceRestockHistory')), orderBy('restockedAt', 'desc')) : null,
      [firestore, isGlobalMode, getCollectionPath, reloadCounter]);
    const branchRestockResult = useCollection<any>(branchRestockQuery);
    const globalRestockResult = useGlobalCollectionData<any>('serviceRestockHistory', [orderBy('restockedAt', 'desc')]);
    const { data: restockHistory, isLoading: areRestocksLoading } = isGlobalMode ? globalRestockResult : branchRestockResult;
    const branchServicesQuery = React.useMemo(() => !isGlobalMode && firestore
      ? query(collection(firestore, getCollectionPath('services')), orderBy('name')) : null,
      [firestore, isGlobalMode, getCollectionPath, reloadCounter]);
    const branchServicesResult = useCollection<ServiceItem>(branchServicesQuery);
    const globalServicesResult = useGlobalCollectionData<ServiceItem>('services', [orderBy('name')]);
    const { data: serviceItems, isLoading: areServicesLoading } = isGlobalMode ? globalServicesResult : branchServicesResult;

    // Fetch branches for branch selection in dialog
    const branchesQuery = React.useMemo(() => {
        if (!firestore || !userProfile) return null;
        return query(collection(firestore, 'branches'), where('createdBy', '==', userProfile.id));
    }, [firestore, userProfile]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    const { totalIncome, todaysIncome, incomeLabel, filteredIncome } = React.useMemo(() => {
        if (!sales) return { totalIncome: 0, todaysIncome: 0, filteredIncome: 0, incomeLabel: "Today's Income" };

        const serviceSales = sales.flatMap(sale =>
            sale.items
                .filter(item => (item as any).isService)
                .map(item => ({...sale, itemTotal: item.sellingPrice * item.quantity, saleDate: getSafeDate(sale.soldAt)}))
        );

        const total = serviceSales.reduce((acc, sale) => acc + sale.itemTotal, 0);

        const today = serviceSales
            .filter(sale => sale.saleDate && isToday(sale.saleDate))
            .reduce((acc, sale) => acc + sale.itemTotal, 0);

        let currentFilteredIncome = today;
        let label = "Today's Income";

        if (dateRange?.from) {
          const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
          currentFilteredIncome = serviceSales
            .filter(sale => sale.saleDate && isWithinInterval(sale.saleDate, interval))
            .reduce((acc, sale) => acc + sale.itemTotal, 0);
          label = `Filtered Income (${format(dateRange.from, 'LLL d')} - ${format(dateRange.to || dateRange.from, 'LLL d')})`;
        }

        return { totalIncome: total, todaysIncome: today, filteredIncome: currentFilteredIncome, incomeLabel: label };
    }, [sales, dateRange]);


    const serviceStats = React.useMemo(() => {
      const items = serviceItems || [];
      const tracked = items.filter(item => Number.isFinite(item.quantity));
      const totalInvestment = tracked.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.costPrice || 0)), 0);
      const todaysRestocks = (restockHistory || []).filter(entry => {
        const date = getSafeDate(entry.restockedAt);
        return date && isToday(date);
      });
      const todayRestockValue = todaysRestocks.reduce((sum, entry) => sum + Math.max(0, Number(entry.totalCost || 0)), 0);
      const todayRestockQuantity = todaysRestocks.reduce((sum, entry) => sum + Math.max(0, Number(entry.quantityAdded || 0)), 0);
      const totalProfit = (sales || []).reduce((sum, sale) => {
        if (sale.paymentStatus === 'Refunded') return sum;
        return sum + (sale.items || []).filter(item => item.isService).reduce((lineSum, item) => {
          const refunded = (sale.refundedItems || []).filter(refund => refund.itemId === item.itemId).reduce((n, refund) => n + Number(refund.quantity || 0), 0);
          const soldQty = Math.max(0, Number(item.quantity || 0) - refunded);
          return lineSum + (Number(item.sellingPrice || 0) - Number(item.costPrice || 0)) * soldQty;
        }, 0);
      }, 0);
      return { totalInvestment, todayRestockValue, todayRestockQuantity, totalProfit };
    }, [serviceItems, restockHistory, sales]);
    const handleSuccess = () => {
        setReloadCounter(c => c + 1);
    };

    const handleEdit = (item: any) => {
        setSelectedService(item);
        setIsFormOpen(true);
    };

    const handleDelete = (item: any) => {
        setSelectedService(item);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!firestore || !selectedService) return;
        try {
            const serviceRef = doc(firestore, getCollectionPath('services'), selectedService.id);
            await commitLocalFirstMutations([{ collectionName: getCollectionPath('services'), docId: selectedService.id, action: 'delete' }], `service-delete:${selectedService.id}:${Date.now()}`, () => deleteDoc(serviceRef));
            toast({ variant: 'success', title: 'Service Deleted' });
            handleSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
        setIsDeleteOpen(false);
    };


    const openRestock = (item: UnifiedItem) => {
      setRestockItem(item);
      setRestockQuantity('');
      setRestockUnitCost(String(item.costPrice || 0));
      setRestockNotes('');
    };

    const submitRestock = async () => {
      if (!firestore || !userProfile || !restockItem) return;
      const quantity = Number(restockQuantity);
      const unitCost = Number(restockUnitCost);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        toast({ variant: 'destructive', title: 'Check restock details', description: 'Enter a quantity greater than zero and a valid non-negative unit cost.' });
        return;
      }
      if (!Number.isFinite(restockItem.quantity)) {
        toast({ variant: 'destructive', title: 'Stock tracking is disabled', description: 'Enable Track Quantity when editing this item before restocking it.' });
        return;
      }
      setIsRestocking(true);
      try {
        const servicePath = restockItem.branchId ? `branches/${restockItem.branchId}/services` : getCollectionPath('services');
        const historyPath = restockItem.branchId ? `branches/${restockItem.branchId}/serviceRestockHistory` : getCollectionPath('serviceRestockHistory');
        const serviceRef = doc(firestore, servicePath, restockItem.id);
        const historyRef = doc(collection(firestore, historyPath));
        const oldQuantity = Math.max(0, Number(restockItem.quantity || 0));
        const nextQuantity = oldQuantity + quantity;
        const oldCost = Math.max(0, Number(restockItem.costPrice || 0));
        const weightedCost = nextQuantity > 0 ? ((oldQuantity * oldCost) + (quantity * unitCost)) / nextQuantity : unitCost;
        const entry = {
          id: historyRef.id, itemId: restockItem.id, itemName: restockItem.name,
          quantityAdded: quantity, costPerUnit: unitCost, totalCost: quantity * unitCost,
          previousQuantity: oldQuantity, resultingQuantity: nextQuantity,
          restockedAt: new Date().toISOString(), restockedBy: userProfile.name || 'Unknown',
          restockedByUid: userProfile.uid || userProfile.id || '',
          ...(restockItem.branchId ? { branchId: restockItem.branchId } : {}),
          ...(restockNotes.trim() ? { notes: restockNotes.trim() } : {}),
        };
        await commitLocalFirstMutations([
          { collectionName: servicePath, docId: restockItem.id, action: 'update', data: { quantity: nextQuantity, costPrice: weightedCost, updatedAt: new Date().toISOString() } },
          { collectionName: historyPath, docId: historyRef.id, action: 'set', data: entry },
        ], `service-restock:${historyRef.id}`, async () => {
          await updateDoc(serviceRef, { quantity: nextQuantity, costPrice: weightedCost, updatedAt: serverTimestamp() });
          await setDoc(historyRef, { ...entry, restockedAt: serverTimestamp() });
        });
        toast({ variant: 'success', title: 'Restock recorded', description: `${quantity} added to ${restockItem.name}.` });
        setRestockItem(null);
        handleSuccess();
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Restock failed', description: error?.message || 'Could not record this restock.' });
      } finally {
        setIsRestocking(false);
      }
    };

    const handleCloseDialogs = () => {
        setSelectedService(null);
        setIsFormOpen(false);
        setIsDeleteOpen(false);
    };

    return (
        <>
            <div className="h-full flex-col gap-6 flex">
                <div className="flex items-center justify-between">
                    <TopHeader name="Services & Foods" icon={<ConciergeBell />} description={isBranchMode ? `Branch: ${currentBranch?.name}` : "A list of all non-inventory items like services or made-to-order food."} />
                    <div className="flex items-center gap-2">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        <Button asChild variant="outline">
                          <Link href="/stock-management">
                            <Package className="mr-2 h-4 w-4" />
                            Manage Stock
                          </Link>
                        </Button>
                        <Button onClick={() => { setSelectedService(null); setIsFormOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4"/> Add New Service
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <StatCard
                        title="Total Income from Services"
                        value={formatCurrency(totalIncome)}
                        icon={DollarSign}
                        description="All-time revenue from all non-inventory services and foods."
                        isLoading={areSalesLoading}
                    />
                    <StatCard
                        title="Today's Income from Services"
                        value={formatCurrency(todaysIncome)}
                        icon={CalendarCheck}
                        description="Revenue generated from services and foods sold today."
                        isLoading={areSalesLoading}
                    />
                    <StatCard
                        title={incomeLabel}
                        value={formatCurrency(filteredIncome)}
                        icon={DollarSign}
                        description="Income for the selected date range."
                        isLoading={areSalesLoading}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <StatCard title="Total Investment" value={formatCurrency(serviceStats.totalInvestment)} icon={Package} description="Current on-hand tracked service and food stock at weighted average cost." isLoading={areServicesLoading} />
                    <StatCard title="Total Profit" value={formatCurrency(serviceStats.totalProfit)} icon={TrendingUp} description="Sold service and food items less their saved sale-time cost; refunded quantities excluded." isLoading={areSalesLoading} />
                    <StatCard title="Today's Restock Value" value={formatCurrency(serviceStats.todayRestockValue)} icon={RotateCcw} description={`${serviceStats.todayRestockQuantity.toLocaleString()} units restocked today.`} isLoading={areRestocksLoading} />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Manage Services & Foods</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ServiceManagement
                          salesData={sales}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onViewSales={setSelectedServiceForLog}
                          onRestock={openRestock}
                          canRestock={canRestock}
                          reloadCounter={reloadCounter}
                        />
                    </CardContent>
                </Card>
            </div>

            <AddEditServiceItemDialog
                isOpen={isFormOpen}
                onClose={handleCloseDialogs}
                service={selectedService}
                onSuccess={handleSuccess}
                branches={branches || []}
            />

            {selectedService && (
                <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the service "{selectedService.name}".
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}


            <Dialog open={!!restockItem} onOpenChange={(open) => { if (!open && !isRestocking) setRestockItem(null); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Restock {restockItem?.name || 'item'}</DialogTitle>
                  <DialogDescription>Record the incoming quantity and purchase unit cost. The item's cost price is updated using a weighted average.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label htmlFor="service-restock-qty">Quantity to add</Label><Input id="service-restock-qty" type="number" min="0.01" step="any" value={restockQuantity} onChange={e => setRestockQuantity(e.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="service-restock-cost">Unit cost</Label><Input id="service-restock-cost" type="number" min="0" step="0.01" value={restockUnitCost} onChange={e => setRestockUnitCost(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="service-restock-notes">Notes (optional)</Label><Textarea id="service-restock-notes" value={restockNotes} onChange={e => setRestockNotes(e.target.value)} placeholder="Supplier, invoice or restock notes" /></div>
                  {Number(restockQuantity) > 0 && Number.isFinite(Number(restockUnitCost)) && <p className="text-sm text-muted-foreground">Restock value: <strong>{formatCurrency(Number(restockQuantity) * Number(restockUnitCost))}</strong></p>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRestockItem(null)} disabled={isRestocking}>Cancel</Button>
                  <Button type="button" onClick={submitRestock} disabled={isRestocking}>{isRestocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}{isRestocking ? 'Saving...' : 'Save Restock'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ServiceSalesLogDialog
                open={!!selectedServiceForLog}
                onOpenChange={() => setSelectedServiceForLog(null)}
                item={selectedServiceForLog}
            />
        </>
    );
}

export default withAuth(ServicesPage, PagePermission.VIEW_SERVICES_PAGE);
