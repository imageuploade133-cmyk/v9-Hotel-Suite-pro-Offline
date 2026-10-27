
'use client';

import * as React from 'react';
import { Scissors, Plus, History, Loader2, ChevronRight, ChevronLeft, CalendarCheck, CheckCheck, DollarSign, Printer, Download, Image as ImageIcon, Trash2 } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { SalonService, UserProfile, Payment } from '@/lib/types';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  QueryConstraint,
  getDocs,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  doc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { CreateSalonOrderDialog } from '@/components/salon/create-salon-order-dialog';
import { SalonOrderCard } from '@/components/salon/salon-order-card';
import { SalonReceiptDialog } from '@/components/salon/salon-receipt-dialog';
import BarbingSalonLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, isWithinInterval, isToday } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { StatCard } from '@/components/ui/stat-card';
import { useSettings } from '@/contexts/settings-context';
import { SalonHistoryTable } from '@/components/salon/salon-history-table';
import { exportToCsv } from '@/lib/csv-export';
import { PaySalonOrderDialog } from '@/components/salon/pay-salon-order-dialog';
import { SalonHistoryReport } from '@/components/salon/salon-history-report';
import * as htmlToImage from 'html-to-image';
import { TopHeader } from '@/components/top-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';


const PAGE_SIZE = 12;

type MainTabType = 'active' | 'history';
type FilterType = 'All Services' | 'Pending' | 'In-Progress' | 'Completed' | 'Paid' | 'Unpaid';

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
  currentPage,
  totalPages,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  currentPage: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Prev
      </Button>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
        Next <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function BarbingSalonManagementPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [activeListTab, setActiveListTab] = React.useState<FilterType>('Pending');
  const [activeMainTab, setActiveMainTab] = React.useState<MainTabType>('active');
  const [orderToPrint, setOrderToPrint] = React.useState<SalonService | null>(null);
  const [orderToPay, setOrderToPay] = React.useState<SalonService | null>(null);

  const [orders, setOrders] = React.useState<SalonService[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const [actionsOrder, setActionsOrder] = React.useState<SalonService | null>(null);
  const [historyActionsOrder, setHistoryActionsOrder] = React.useState<SalonService | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);


  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const handleSuccess = (newOrder: SalonService) => {
      setReloadCounter(c => c + 1);
      setOrderToPrint(newOrder);
  };


  const allSalonServicesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'salonServices'));
  }, [firestore]);
  const { data: allServices, isLoading: areAllServicesLoading } = useCollection<SalonService>(allSalonServicesQuery);

  const { todaysIncome, totalIncome, incomeByPaymentMethod } = React.useMemo(() => {
    if (!allServices) return { todaysIncome: 0, totalIncome: 0, incomeByPaymentMethod: {} };

    const paidServices = allServices.filter(service => service.paymentStatus === 'Paid');
    const today = new Date();
    const todays = paidServices
      .filter(service => {
          const serviceDate = getSafeDate(service.createdAt);
          return serviceDate && isToday(serviceDate);
      })
      .reduce((sum, service) => sum + service.totalPrice, 0);

    const total = paidServices.reduce((sum, service) => sum + service.totalPrice, 0);

    const incomeByMethod: { [key: string]: number } = {};
    paidServices.forEach(service => {
        if (service.paymentMethod) {
            if (!incomeByMethod[service.paymentMethod]) {
                incomeByMethod[service.paymentMethod] = 0;
            }
            incomeByMethod[service.paymentMethod] += service.totalPrice;
        }
    });

    return { todaysIncome: todays, totalIncome: total, incomeByPaymentMethod: incomeByMethod };
  }, [allServices]);

  const handleOpenActions = (order: SalonService) => {
    setActionsOrder(order);
  };

  const handleCloseActions = () => {
    setActionsOrder(null);
    setShowCancelConfirm(false);
  };

  const handleOpenHistoryActions = (order: SalonService) => {
    setHistoryActionsOrder(order);
  };

  const handleCloseHistoryActions = () => {
    setHistoryActionsOrder(null);
  };

  const confirmCancelOrder = async () => {
    if (!firestore || !actionsOrder) return;
    setIsCancelling(true);
    try {
      await deleteDoc(doc(firestore, 'salonServices', actionsOrder.id));
      toast({
        variant: 'success',
        title: 'Order Cancelled',
        description: `Order #${actionsOrder.orderNumber} has been successfully removed.`,
      });
      handleCloseActions();
      setReloadCounter(c => c + 1);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Cancellation Failed',
        description: 'An unexpected error occurred.',
      });
    } finally {
      setIsCancelling(false);
    }
  };


  const fetchOrders = React.useCallback(
    async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
      if (!firestore) return;
      setIsLoading(true);

      const constraints: QueryConstraint[] = [];
      if (activeListTab !== 'All Services') {
        if (activeListTab === 'Paid' || activeListTab === 'Unpaid') {
          constraints.push(where('paymentStatus', '==', activeListTab));
        } else {
          constraints.push(where('status', '==', activeListTab));
        }
      }

      if (dateRange?.from) {
        constraints.push(where('createdAt', '>=', startOfDay(dateRange.from)));
        if (dateRange.to) {
          constraints.push(where('createdAt', '<=', endOfDay(dateRange.to)));
        }
      }

      const baseQuery = query(collection(firestore, 'salonServices'), ...constraints, orderBy('createdAt', 'desc'));

      const countSnapshot = await getDocs(baseQuery);
      setTotalCount(countSnapshot.size);

      let paginatedQuery;
      const isInitialOrReload = direction === 'initial';

      if (direction === 'next' && lastVisible) {
        paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisible) {
        paginatedQuery = query(baseQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      } else {
        paginatedQuery = query(baseQuery, limit(PAGE_SIZE));
      }

      try {
        const snapshot = await getDocs(paginatedQuery);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalonService));

        setOrders(data);
        setFirstVisible(snapshot.docs[0] || null);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);

        if (snapshot.docs.length > 0 && snapshot.docs.length === PAGE_SIZE) {
          const nextQuery = query(baseQuery, startAfter(snapshot.docs[snapshot.docs.length - 1]), limit(1));
          const nextSnapshot = await getDocs(nextQuery);
          setHasMore(!nextSnapshot.empty);
        } else {
          setHasMore(false);
        }

        if (direction === 'next') setPage(p => p + 1);
        else if (direction === 'prev' && page > 1) setPage(p => p - 1);
        else if (direction === 'initial') setPage(1);

      } catch (error) {
        console.error("Error fetching salon services:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch salon services.' });
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firestore, activeListTab, dateRange, lastVisible, firstVisible, page, toast]
  );

  React.useEffect(() => {
    fetchOrders('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListTab, dateRange, reloadCounter]);

    const handleExport = () => {
    if (!allServices || allServices.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There is no history to export.',
      });
      return;
    }
    setIsExporting(true);
    toast({
      title: 'Exporting Data',
      description: 'Your service history is being prepared for download.',
    });

    try {
      const dataToExport = allServices.map(p => ({
        'Order #': p.orderNumber,
        'Customer Name': p.customerName,
        'Room #': p.roomNumber || 'N/A',
        'Services': p.items.map(i => i.name).join(', '),
        'Total Price': p.totalPrice,
        'Payment Status': p.paymentStatus,
        'Service Status': p.status,
        'Staff Name': p.staffName || 'N/A',
        'Date': getSafeDate(p.createdAt)?.toISOString(),
      }));

      const today = new Date().toISOString().split('T')[0];
      exportToCsv(dataToExport, `salon-history-${today}.csv`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'An unexpected error occurred while exporting data.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (content) {
      setIsPrinting(true);
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Salon History Report</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body class="p-8">');
        printWindow.document.write(content.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
          setIsPrinting(false);
        }, 500);
      } else {
        setIsPrinting(false);
      }
    }
  };

    const handleDownloadImage = async () => {
        const reportNode = printRef.current;
        if (!reportNode) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find report content.' });
            return;
        }
        setIsExporting(true);
        toast({ title: 'Generating Image', description: 'Your report is being converted to an image.' });
        try {
            const dataUrl = await htmlToImage.toPng(reportNode, { quality: 1.0, pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `salon-history-report_${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
            toast({ variant: 'success', title: 'Image Downloaded' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Image Generation Failed', description: 'Could not generate image.' });
        } finally {
        setIsExporting(false);
        }
    };


    const handleConfirmPayment = async (order: SalonService, paymentMethod: string) => {
    if (!firestore || !userProfile) return;

    const batch = writeBatch(firestore);

    const serviceRef = doc(firestore, 'salonServices', order.id);
    batch.update(serviceRef, {
      paymentStatus: 'Paid',
      paymentMethod: paymentMethod,
    });

    const paymentRef = doc(collection(firestore, 'payments'));
    const paymentData: Partial<Payment> = {
      guestName: order.customerName,
      amount: order.totalPrice,
      paymentMethod: paymentMethod,
      status: 'Paid',
      transactionDate: new Date(),
      type: 'Additional Charges',
      roomNumber: order.roomNumber,
      createdByUid: userProfile.uid,
      createdByName: userProfile.name,
      items: order.items.map(s => ({ name: s.name, price: s.price, quantity: 1 })),
    };

    if (order.bookingId) {
      paymentData.bookingId = order.bookingId;
    }

    batch.set(paymentRef, paymentData);

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Payment Successful',
        description: `Payment for order #${order.orderNumber} has been recorded.`,
      });
      setReloadCounter(c => c + 1);
      const updatedOrder = { ...order, paymentStatus: 'Paid', paymentMethod: paymentMethod } as SalonService;
      setOrderToPrint(updatedOrder);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      throw error;
    } finally {
      setOrderToPay(null);
    }
  };


  const handleNextPage = () => fetchOrders('next');
  const handlePrevPage = () => fetchOrders('prev');

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <div className="hidden">
        <div ref={printRef}>
          <SalonHistoryReport data={allServices || []} settings={settings} userProfile={userProfile} />
        </div>
      </div>
       <style>{`
        @media print { @page { margin: 0mm !important; }
          body > *, body > #__next > * { visibility: hidden; }
          #salon-report-print, #salon-report-print * { visibility: visible; }
          #salon-report-print { position: absolute; left: 0; top: 0; width: 100%; z-index: 9999; }
        }
      `}</style>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <TopHeader name="Barbing Salon" icon={<Scissors />} description="Manage all barbing salon services and payments."/>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Service
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Today's Income"
                value={formatCurrency(todaysIncome)}
                icon={DollarSign}
                description="Total revenue from paid services today."
            />
            <StatCard
                title="Total Income"
                value={formatCurrency(totalIncome)}
                icon={DollarSign}
                description="All-time revenue from all paid services."
            />
             {Object.entries(incomeByPaymentMethod).map(([method, amount]) => (
                <StatCard
                    key={method}
                    title={`${method} Total`}
                    value={formatCurrency(amount as number)}
                    icon={DollarSign}
                    description={`Total revenue via ${method}.`}
                />
            ))}
        </div>

         <Tabs value={activeMainTab} onValueChange={(value) => setActiveMainTab(value as MainTabType)}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active Orders</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
                <Tabs value={activeListTab} onValueChange={(value) => setActiveListTab(value as FilterType)}>
                    <div className="flex justify-between items-center">
                        <TabsList>
                        {(['All Services', 'Pending', 'In-Progress', 'Completed', 'Paid', 'Unpaid'] as FilterType[]).map(tab => (
                            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
                        ))}
                        </TabsList>
                    </div>
                </Tabs>

                <div className="flex-1 mt-4">
                {isLoading ? (
                    <BarbingSalonLoading />
                ) : orders.length === 0 ? (
                    <EmptyState
                    icon={Scissors}
                    title="No Services Found"
                    description={`There are no services that match the filter: "${activeListTab}"`}
                    />
                ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {orders.map(order => (
                        <SalonOrderCard
                            key={order.id}
                            order={order}
                            onOrderUpdate={() => setReloadCounter(c => c + 1)}
                            onPrint={() => setOrderToPrint(order)}
                            onPay={() => setOrderToPay(order)}
                            onOpenActions={handleOpenActions}
                        />
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <PaginationControls
                        canPrev={page > 1}
                        canNext={hasMore}
                        onPrev={handlePrevPage}
                        onNext={handleNextPage}
                        currentPage={page}
                        totalPages={totalPages}
                        />
                    )}
                    </>
                )}
                </div>
            </TabsContent>
            <TabsContent value="history" className="mt-4">
                 <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Service History</h3>
                                <p className="text-sm text-muted-foreground">A record of all salon services.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                 <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                                <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                                  {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                                  Print
                                </Button>
                                 <Button variant="outline" onClick={handleDownloadImage} disabled={isExporting}>
                                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                                    Download
                                </Button>
                                <Button onClick={handleExport} disabled={isExporting}>
                                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Export CSV
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SalonHistoryTable
                            data={allServices || []}
                            isLoading={areAllServicesLoading}
                            onPrintReceipt={setOrderToPrint}
                            onActions={handleOpenHistoryActions}
                        />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>

      <CreateSalonOrderDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleSuccess}
      />
      {orderToPay && (
        <PaySalonOrderDialog
          order={orderToPay}
          isOpen={!!orderToPay}
          onClose={() => setOrderToPay(null)}
          onConfirmPayment={handleConfirmPayment}
        />
      )}
      <SalonReceiptDialog
        isOpen={!!orderToPrint}
        onClose={() => setOrderToPrint(null)}
        order={orderToPrint}
      />
        <Dialog open={!!actionsOrder} onOpenChange={(open) => { if (!open) handleCloseActions(); }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{showCancelConfirm ? 'Confirm Cancellation' : `Actions for Order #${actionsOrder?.orderNumber}`}</DialogTitle>
                <DialogDescription>
                    {showCancelConfirm
                        ? (
                            <>
                            This will permanently cancel this service order.
                            {actionsOrder?.paymentStatus === 'Paid' && <b className="block mt-2 text-destructive">This action does NOT automatically refund the payment. Please process a refund separately if needed.</b>}
                            </>
                        )
                        : `Customer: ${actionsOrder?.customerName}`
                    }
                </DialogDescription>
            </DialogHeader>
            {!showCancelConfirm ? (
                <div className="grid gap-3 py-4">
                    <Button variant="outline" className="justify-start" onClick={() => { setOrderToPrint(actionsOrder); handleCloseActions(); }}>
                        <Printer className="mr-2 h-4 w-4" /> Print Receipt
                    </Button>
                    <Button variant="destructive" className="justify-start" onClick={() => setShowCancelConfirm(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Cancel Order
                    </Button>
                </div>
            ) : (
                <div className="py-4 font-semibold">
                    Are you sure you want to proceed? This action cannot be undone.
                </div>
            )}
            <DialogFooter>
                {!showCancelConfirm ? (
                    <Button variant="ghost" onClick={handleCloseActions}>Close</Button>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => setShowCancelConfirm(false)} disabled={isCancelling}>Back</Button>
                        <Button
                            variant="destructive"
                            onClick={confirmCancelOrder}
                            loading={isCancelling}
                        >
                            Yes, Cancel Order
                        </Button>
                    </>
                )}
            </DialogFooter>
        </DialogContent>
    </Dialog>
     <Dialog open={!!historyActionsOrder} onOpenChange={(open) => !open && handleCloseHistoryActions()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actions for Order #{historyActionsOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Customer: {historyActionsOrder?.customerName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                setOrderToPrint(historyActionsOrder);
                handleCloseHistoryActions();
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Print Receipt
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseHistoryActions}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default withAuth(BarbingSalonManagementPage, PagePermission.VIEW_SALON_PAGE);
