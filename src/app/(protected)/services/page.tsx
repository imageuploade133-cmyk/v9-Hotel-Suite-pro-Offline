'use client';

import * as React from 'react';
import { commitLocalFirstMutations } from '@/lib/lan-sync/sync-helper';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Plus, ConciergeBell, DollarSign, CalendarCheck, Package, TrendingUp, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockSale, ServiceItem } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
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
import { usePermissions } from '@/hooks/use-permissions';
import { getSafeDate } from '@/lib/helpers';
import { where } from 'firebase/firestore';
import { isToday, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { ServiceSalesLogDialog } from '@/components/stock/service-sales-log-dialog';
import Link from 'next/link';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function ServicesPage() {
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
    const [selectedService, setSelectedService] = React.useState<UnifiedItem | null>(null);
    const [selectedServiceForLog, setSelectedServiceForLog] = React.useState<UnifiedItem | null>(null);
    const [reloadCounter, setReloadCounter] = React.useState(0);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [showAllSummaryCards, setShowAllSummaryCards] = React.useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();
    const { settings } = useSettings();
    const { getCollectionPath, currentBranch, isBranchMode, isGlobalMode } = useBranch();
    const { userProfile } = useUser();
    const { hasPermission } = usePermissions();
    const canViewServiceRestock = hasPermission(PagePermission.RESTOCK_SERVICES);

    // Branch mode queries
    const branchSalesQuery = React.useMemo(() => {
        return !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null;
    }, [firestore, isGlobalMode, getCollectionPath]);
    const branchSalesResult = useCollection<StockSale>(branchSalesQuery);

    // Global mode queries
    const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', []);

    // Use appropriate result based on mode
    const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;
    const branchServiceRestockQuery = React.useMemo(() => !isGlobalMode && firestore
      ? query(collection(firestore, getCollectionPath('serviceRestockHistory')), orderBy('restockedAt', 'desc')) : null,
      [firestore, isGlobalMode, getCollectionPath, reloadCounter]);
    const branchServiceRestocks = useCollection<any>(branchServiceRestockQuery);
    const globalServiceRestocks = useGlobalCollectionData<any>('serviceRestockHistory', [orderBy('restockedAt', 'desc')]);
    const { data: serviceRestocks, isLoading: areServiceRestocksLoading } = isGlobalMode ? globalServiceRestocks : branchServiceRestocks;


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
      const todaysRestocks = (serviceRestocks || []).filter(entry => { const date = getSafeDate(entry.restockedAt); return date && isToday(date); });
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
      return { totalInvestment, totalProfit, todayRestockValue, todayRestockQuantity };
    }, [serviceItems, sales, serviceRestocks]);
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
                        <Button asChild variant="outline"><Link href="/stock-management"><Package className="mr-2 h-4 w-4" />Manage Stock</Link></Button>
                        {canViewServiceRestock && <Button asChild variant="outline"><Link href="/services-restock"><RotateCcw className="mr-2 h-4 w-4" />Restock History</Link></Button>}
                        <Button onClick={() => { setSelectedService(null); setIsFormOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4"/> Add New Service
                        </Button>
                    </div>
                </div>

                <div>
                  <h2 className="text-base font-semibold">Inventory & Profit Overview</h2>
                  <p className="text-sm text-muted-foreground">Financial summary for Services & Foods stock.</p>
                </div>
                <Collapsible open={showAllSummaryCards} onOpenChange={setShowAllSummaryCards}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard title="Total Investment" value={formatCurrency(serviceStats.totalInvestment)} icon={Package} description="Current on-hand tracked stock valued at weighted-average cost." isLoading={areServicesLoading} className="border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100" iconClassName="text-sky-700 dark:text-sky-300" />
                    <StatCard title="Total Profit" value={formatCurrency(serviceStats.totalProfit)} icon={TrendingUp} description="Sold item revenue less saved sale-time cost, after refunded quantities." isLoading={areSalesLoading} className="border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" iconClassName="text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-4">
                      <StatCard title="Total Income from Services" value={formatCurrency(totalIncome)} icon={DollarSign} description="All-time revenue from services and foods." isLoading={areSalesLoading} className="border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100" iconClassName="text-violet-700 dark:text-violet-300" />
                      <StatCard title="Today's Income from Services" value={formatCurrency(todaysIncome)} icon={CalendarCheck} description="Revenue generated today." isLoading={areSalesLoading} className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" iconClassName="text-amber-700 dark:text-amber-300" />
                      <StatCard title="Today Restock Value" value={formatCurrency(serviceStats.todayRestockValue)} icon={RotateCcw} description="Units restocked today." isLoading={areServiceRestocksLoading} className="border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" iconClassName="text-rose-700 dark:text-rose-300" />
                      <StatCard title={incomeLabel} value={formatCurrency(filteredIncome)} icon={DollarSign} description="Income for the selected date range." isLoading={areSalesLoading} className="border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100" iconClassName="text-indigo-700 dark:text-indigo-300" />
                    </div>
                  </CollapsibleContent>
                  <div className="mt-4 flex items-center justify-center">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="outline" className="w-full sm:w-auto">
                        {showAllSummaryCards ? 'Show Less' : 'Show More Stats'}
                        <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAllSummaryCards ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </Collapsible>

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


            <ServiceSalesLogDialog
                open={!!selectedServiceForLog}
                onOpenChange={() => setSelectedServiceForLog(null)}
                item={selectedServiceForLog}
            />
        </>
    );
}

export default withAuth(ServicesPage, PagePermission.VIEW_SERVICES_PAGE);
