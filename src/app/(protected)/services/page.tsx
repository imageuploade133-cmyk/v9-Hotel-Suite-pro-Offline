'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Plus, ConciergeBell, DollarSign, CalendarCheck, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockSale } from '@/lib/types';
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
import { getSafeDate } from '@/lib/helpers';
import { where } from 'firebase/firestore';
import { isToday, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { ServiceSalesLogDialog } from '@/components/stock/service-sales-log-dialog';
import Link from 'next/link';

function ServicesPage() {
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
    const [selectedService, setSelectedService] = React.useState<UnifiedItem | null>(null);
    const [selectedServiceForLog, setSelectedServiceForLog] = React.useState<UnifiedItem | null>(null);
    const [reloadCounter, setReloadCounter] = React.useState(0);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { settings } = useSettings();
    const { getCollectionPath, currentBranch, isBranchMode, isGlobalMode } = useBranch();
    const { userProfile } = useUser();

    // Branch mode queries
    const branchSalesQuery = React.useMemo(() => {
        return !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null;
    }, [firestore, isGlobalMode, getCollectionPath]);
    const branchSalesResult = useCollection<StockSale>(branchSalesQuery);

    // Global mode queries
    const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', []);

    // Use appropriate result based on mode
    const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;

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
            await deleteDoc(doc(firestore, getCollectionPath('services'), selectedService.id));
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
