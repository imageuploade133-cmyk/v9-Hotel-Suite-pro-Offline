
'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  where,
  getDocs,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
  collectionGroup,
} from 'firebase/firestore';
import {
  ChefHat,
  Clock,
  CheckCircle,
  FileText,
  User,
  Phone,
  ShoppingCart,
  Loader2,
  Printer,
  Hourglass,
  CalendarCheck,
  TrendingUp,
  DollarSign,
  ListOrdered,
  Check,
  ChevronDown,
  Search,
  Mail,
  CookingPot,
  FileWarning,
  Download,
  VolumeX,
  Volume2,
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSettings } from '@/contexts/settings-context';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
} from '@/components/ui/dialog';
import { KitchenOrderReceiptDialog } from '@/components/kitchen/kitchen-order-receipt-dialog';
import { StatCard } from '@/components/ui/stat-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { Order, BillItem, Booking, Bill } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { exportToCsv } from '@/lib/csv-export';
import { KitchenHistoryTable } from '@/components/kitchen/kitchen-history-table';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, isWithinInterval, startOfDay, endOfDay, isToday, differenceInMinutes } from 'date-fns';
import { OrderCard } from '@/components/kitchen/order-card';
import { LoadingSkeleton, PaginationControls } from '@/components/kitchen/kitchen-helpers';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KitchenReport } from '@/components/kitchen/kitchen-report';


const PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 15;


function KitchenPanelPage() {
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const [allOrders, setAllOrders] = React.useState<Order[]>([]);
  const [allBills, setAllBills] = React.useState<Bill[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const printRef = React.useRef<HTMLDivElement>(null);

  const [orderToUpdate, setOrderToUpdate] = React.useState<{order: Order, newStatus: 'Preparing' | 'Completed'} | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = React.useState(false);
  const [orderToPrint, setOrderToPrint] = React.useState<Order | null>(null);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [imageToView, setImageToView] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [orderToBill, setOrderToBill] = React.useState<Order | null>(null);
  const [bookingForBill, setBookingForBill] = React.useState<Booking | null>(null);
  const [ambiguousBookings, setAmbiguousBookings] = React.useState<Booking[]>([]);
  const [selectedBookingIdForBill, setSelectedBookingIdForBill] = React.useState<string | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = React.useState(false);
  const [manualRoomNumber, setManualRoomNumber] = React.useState('');

  const [activePage, setActivePage] = React.useState(1);
  const [completedPage, setCompletedPage] = React.useState(1);


  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);


  React.useEffect(() => {
    if (!firestore) return;
    setIsLoading(true);

    const billsQuery = query(collectionGroup(firestore, 'bills'));
    const ordersQuery = query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'));

    const unsubBills = onSnapshot(billsQuery, (snapshot) => {
        const billsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
        setAllBills(billsData);
    });

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setAllOrders(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching recent orders:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch recent orders.' });
      setIsLoading(false);
    });

    return () => {
        unsubBills();
        unsubOrders();
    };
  }, [firestore, toast]);

  React.useEffect(() => {
    if (!firestore || !orderToBill) {
      setBookingForBill(null);
      setAmbiguousBookings(null);
      return;
    };

    if (orderToBill.bookingId) {
      setIsLoadingBooking(true);
      const bookingRef = doc(firestore, 'bookings', orderToBill.bookingId);
      getDoc(bookingRef).then(docSnap => {
        if (docSnap.exists() && (docSnap.data().status === 'Active' || docSnap.data().status === 'Checked-in')) {
          setBookingForBill({ id: docSnap.id, ...docSnap.data() } as Booking);
        } else {
          setBookingForBill(null);
        }
      }).finally(() => setIsLoadingBooking(false));
    } else {
        setIsLoadingBooking(false);
        setBookingForBill(null);
    }
  }, [firestore, orderToBill]);

 const {
    activeOrders,
    completedOrders,
    stats,
    paginatedActiveOrders,
    activeTotalPages,
  } = React.useMemo(() => {

    const todaysCompletedOrders = allOrders.filter(o => {
        const completedDate = getSafeDate(o.completedAt);
        return o.status === 'Completed' && completedDate && isToday(completedDate);
    });

    const todaysIncome = todaysCompletedOrders.reduce((acc, order) => acc + order.totalPrice, 0);

    const filteredOrders = allOrders.filter(order => {
        const createdAt = getSafeDate(order.createdAt);
        let dateMatch = true;
        if (dateRange?.from && createdAt) {
            const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
            dateMatch = isWithinInterval(createdAt, interval);
        }

        let searchMatch = true;
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            searchMatch = (
                (order.orderNumber && String(order.orderNumber).includes(lowerCaseSearch)) ||
                order.roomNumber.toLowerCase().includes(lowerCaseSearch) ||
                (order.guestName && order.guestName.toLowerCase().includes(lowerCaseSearch)) ||
                (order.phoneNumber && order.phoneNumber.toLowerCase().includes(lowerCaseSearch))
            );
        }
        return dateMatch && searchMatch;
    });

    const active = filteredOrders.filter(o => o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Billed');
    const completed = filteredOrders.filter(o => o.status === 'Completed').sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    const totalRevenue = allOrders.reduce((acc, bill) => acc + bill.totalPrice, 0);

    const outstandingBillsTotal = active.reduce((acc, order) => acc + order.totalPrice, 0);

    const allCompletedOrders = allOrders.filter(o => o.status === 'Completed');

    let totalMinutes = 0;
    const fulfillmentOrders = allOrders.filter(o => o.completedAt);
    if (fulfillmentOrders.length > 0) {
      totalMinutes = fulfillmentOrders.reduce((acc, order) => {
        const created = order.createdAt.toDate();
        const completedTime = order.completedAt!.toDate();
        return acc + differenceInMinutes(completedTime, created);
      }, 0);
    }
    const avgTime = fulfillmentOrders.length > 0 ? totalMinutes / fulfillmentOrders.length : 0;

    const hourlyCounts = allOrders.reduce((acc, order) => {
      const hour = format(order.createdAt.toDate(), 'ha'); // e.g., "5PM"
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let maxHour = 'N/A';
    let maxCount = 0;
    for (const hour in hourlyCounts) {
      if (hourlyCounts[hour] > maxCount) {
        maxCount = hourlyCounts[hour];
        maxHour = hour;
      }
    }

    const pendingOrders = active.filter(o => o.status === 'Pending');

    // Active pagination
    const activeStartIndex = (activePage - 1) * PAGE_SIZE;
    const activeEndIndex = activeStartIndex + PAGE_SIZE;
    const paginatedActive = active.slice(activeStartIndex, activeEndIndex);
    const activePages = Math.ceil(active.length / PAGE_SIZE);

    return {
      activeOrders: active,
      completedOrders: completed,
      stats: {
        todaysIncome: formatCurrency(todaysIncome),
        totalRevenue: formatCurrency(totalRevenue),
        outstandingBills: formatCurrency(outstandingBillsTotal),
        totalOrders: allOrders.length,
        totalCompleted: allCompletedOrders.length,
        pendingOrders: pendingOrders.length,
        completedToday: todaysCompletedOrders.length,
        avgFulfillmentTime: `${avgTime.toFixed(1)} min`,
        busiestHour: maxHour,
      },
      paginatedActiveOrders: paginatedActive,
      activeTotalPages: activePages,
    };
  }, [allOrders, currency, formatCurrency, searchTerm, dateRange, activePage]);


  const handleUpdateOrderStatus = async () => {
    if (!firestore || !user || !userProfile || !orderToUpdate) return;

    const { order, newStatus } = orderToUpdate;

    setIsUpdatingOrder(true);
    const batch = writeBatch(firestore);
    const orderRef = doc(firestore, 'orders', order.id);

    const updateData: Partial<Order> = { status: newStatus };
    if (newStatus === 'Preparing') {
      updateData.preparingAt = serverTimestamp() as Timestamp;
      updateData.preparingByUid = user.uid;
      updateData.preparingByName = userProfile?.name || 'System';
    } else if (newStatus === 'Completed') {
      updateData.completedAt = serverTimestamp() as Timestamp;
      updateData.completedByUid = user.uid;
      updateData.completedByName = userProfile?.name || 'System';
    }
    batch.update(orderRef, updateData as any);

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: `Order ${newStatus}`,
        description: `Order for Room ${order.roomNumber} has been marked as ${newStatus.toLowerCase()}.`
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update order status.' });
    } finally {
      setOrderToUpdate(null);
      setIsUpdatingOrder(false);
    }
  };

   const handleAddBill = (order: Order) => {
    setOrderToBill(order);
    setManualRoomNumber(order.roomNumber);
    setAmbiguousBookings(null);
    setSelectedBookingIdForBill(null);
  };

   const handleAddBillToRoom = async () => {
    if (!firestore || !user || !userProfile || !orderToBill) return;

    setIsUpdatingOrder(true);
    let finalBookingId: string | undefined = bookingForBill?.id;

    if (selectedBookingIdForBill) {
        finalBookingId = selectedBookingIdForBill;
    } else if (!finalBookingId && manualRoomNumber) {
        const roomQuery = query(
            collection(firestore, 'bookings'),
            where('roomNumber', '==', manualRoomNumber),
            where('status', 'in', ['Active', 'Checked-in']),
        );
        const roomSnapshot = await getDocs(roomQuery);

        if (roomSnapshot.empty) {
            toast({
                variant: 'destructive',
                title: 'No Active Guest',
                description: `Could not find an active guest in Room ${manualRoomNumber}. Please verify the room number.`
            });
            setIsUpdatingOrder(false);
            return;
        } else if (roomSnapshot.size > 1) {
            const foundBookings = roomSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
            setAmbiguousBookings(foundBookings);
            setIsUpdatingOrder(false);
            return;
        } else {
            finalBookingId = roomSnapshot.docs[0].id;
        }
    }

    if (!finalBookingId) {
        toast({ variant: 'destructive', title: 'No Guest Selected', description: 'Please select a guest to bill.' });
        setIsUpdatingOrder(false);
        return;
    }


    const batch = writeBatch(firestore);

    const billItems: BillItem[] = orderToBill.items.map(item => ({
        id: `order-${orderToBill.orderNumber}-${item.id}`,
        name: `${item.name}`,
        price: item.price,
        quantity: item.quantity,
        paid: false,
        images: null,
        isService: false,
        billId: '',
    }));

    const newBillRef = doc(collection(firestore, `bookings/${finalBookingId}/bills`));
    batch.set(newBillRef, {
        items: billItems,
        total: orderToBill.totalPrice,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: userProfile.name,
        paid: false,
        bookingId: finalBookingId,
    });

    const orderRef = doc(firestore, 'orders', orderToBill.id);
    batch.update(orderRef, {
      status: 'Billed',
      billedAt: serverTimestamp(),
      billedByUid: user.uid,
      billedByName: userProfile.name
    });


    try {
        await batch.commit();
        let toastDescription = `The charge of ${formatCurrency(orderToBill.totalPrice)} has been added to the guest's bill for Room ${manualRoomNumber}.`;
        toast({
            variant: 'success',
            title: `Bill Added to Room`,
            description: toastDescription,
            duration: 8000,
        });
    } catch (error) {
        console.error("Error adding bill:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add bill to room.' });
    } finally {
        setOrderToBill(null);
        setManualRoomNumber('');
        setIsUpdatingOrder(false);
        setAmbiguousBookings(null);
        setSelectedBookingIdForBill(null);
    }
  }


  const handlePrint = () => {
    const content = printRef.current;
    if (content) {
      setIsPrinting(true);
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Kitchen Report</title>');
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

  const handleExport = () => {
    if (completedOrders.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no completed orders to export.',
      });
      return;
    }
    setIsExporting(true);
    toast({
      title: 'Exporting Data',
      description: 'Your order history is being prepared for download.',
    });

    try {
      const dataToExport = completedOrders.map(order => ({
        'Order Number': order.orderNumber,
        'Room': order.roomNumber,
        'Guest': order.guestName || 'N/A',
        'Date': format(getSafeDate(order.createdAt)!, 'PPpp'),
        'Items': order.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
        'Total': order.totalPrice,
        'Status': order.status,
        'Completed By': order.completedByName || 'N/A',
      }));

      const today = new Date().toISOString().split('T')[0];
      exportToCsv(dataToExport, `kitchen-history-report-${today}.csv`);
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

  return (
    <>
      <div className="hidden">
        <div ref={printRef}>
          <KitchenReport
            orders={completedOrders}
            settings={settings}
            dateRange={dateRange}
            userProfile={userProfile}
            allBills={allBills}
          />
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <ChefHat className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Kitchen Panel</h1>
              <p className="text-muted-foreground">
                A real-time overview of all incoming food and beverage orders.
              </p>
            </div>
          </div>
           <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Search orders..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          </div>
        </div>

        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard
                    title="Today's Income"
                    value={stats.todaysIncome}
                    icon={DollarSign}
                    description="From completed room service orders today."
                />
                <StatCard
                    title="Total Revenue"
                    value={stats.totalRevenue}
                     description="From all orders."
                    icon={DollarSign}
                />
                <StatCard
                    title="Outstanding Bills"
                    value={stats.outstandingBills}
                    icon={FileWarning}
                    description="Total of active but uncompleted kitchen orders."
                    className="bg-yellow-100 dark:bg-yellow-900/50"
                />
            </div>
            <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
                 <StatCard
                    title="Total Orders"
                    value={stats.totalOrders}
                    icon={ListOrdered}
                     description="All orders ever placed."
                />
                <StatCard
                    title="Total Completed"
                    value={stats.totalCompleted}
                    icon={Check}
                     description="All completed orders."
                />
                <StatCard
                    title="Pending Orders"
                    value={stats.pendingOrders}
                    icon={Hourglass}
                    className="bg-yellow-100 dark:bg-yellow-900/50"
                     description=""
                />
                <StatCard
                    title="Completed Today"
                    value={stats.completedToday}
                    icon={CalendarCheck}
                     description=""
                />
                <StatCard
                    title="Avg. Fulfillment Time"
                    value={stats.avgFulfillmentTime}
                    icon={Clock}
                     description=""
                />
                <StatCard
                    title="Busiest Hour Today"
                    value={stats.busiestHour}
                    icon={TrendingUp}
                    className="bg-primary/10 text-primary"
                    iconClassName="text-primary"
                     description=""
                />
            </CollapsibleContent>
             <div className="mt-4 flex items-center justify-center">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  {isStatsExpanded ? 'Show Less' : 'Show More Stats'}
                  <ChevronDown
                    className={cn(
                      'ml-2 h-4 w-4 transition-transform',
                      isStatsExpanded && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
        </Collapsible>


        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">
                Active Orders
                 {activeOrders.length > 0 && (
                  <Badge className={cn("ml-2", activeOrders.length > 0 && "blinking-red-badge")}>
                    {activeOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">
                History
                <Badge variant="secondary" className="ml-2">{completedOrders.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-6">
                {paginatedActiveOrders.length === 0 ? (
                    <EmptyState
                    icon={FileText}
                    title="No Active Orders"
                    description="New orders from the online menu will appear here."
                    className="min-h-[40vh]"
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {paginatedActiveOrders.map(order => (
                                <OrderCard key={order.id} order={order} onUpdateStatus={(order, newStatus) => setOrderToUpdate({order, newStatus})} onPrint={setOrderToPrint} formatCurrency={formatCurrency} onViewImage={setImageToView} allBills={allBills} onAddBill={handleAddBill} />
                            ))}
                        </div>
                        {activeTotalPages > 1 && (
                            <div className="mt-4">
                                <PaginationControls
                                    canPrev={activePage > 1}
                                    canNext={activePage < activeTotalPages}
                                    onPrev={() => setActivePage(p => p - 1)}
                                    onNext={() => setActivePage(p => p + 1)}
                                />
                            </div>
                        )}
                    </>
                )}
            </TabsContent>
             <TabsContent value="history" className="mt-6">
                <div className="flex justify-end mb-4 gap-2">
                    <Button variant="outline" onClick={handlePrint} disabled={isLoading || isPrinting}>
                        {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        {isPrinting ? 'Processing...' : 'Print Report'}
                    </Button>
                    <Button onClick={handleExport} disabled={isLoading || isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {isExporting ? 'Exporting...' : 'Export to Excel'}
                    </Button>
                </div>
                <KitchenHistoryTable
                    orders={completedOrders}
                    isLoading={isLoading}
                    onPrintReceipt={setOrderToPrint}
                    currency={currency}
                    allBills={allBills}
                />
            </TabsContent>
          </Tabs>
        )}
      </div>

       <AlertDialog open={!!orderToUpdate} onOpenChange={(open) => !open && setOrderToUpdate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order for Room{' '}
              <span className="font-bold">{orderToUpdate?.order.roomNumber}</span> as {orderToUpdate?.newStatus.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingOrder}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleUpdateOrderStatus}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              loading={isUpdatingOrder}
            >
              Mark as {orderToUpdate?.newStatus}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KitchenOrderReceiptDialog
        isOpen={!!orderToPrint}
        onClose={() => setOrderToPrint(null)}
        order={orderToPrint}
        allBills={allBills}
      />

      <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitleComponent>Item Image</DialogTitleComponent>
          </DialogHeader>
          {imageToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageToView}
                alt="Order item image"
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

       <AlertDialog open={!!orderToBill} onOpenChange={(open) => !open && setOrderToBill(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Add Bill to Room {orderToBill?.roomNumber}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please confirm the guest details before adding the bill of{' '}
                        <span className="font-bold">{formatCurrency(orderToBill?.totalPrice || 0)}</span> to their room.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 {isLoadingBooking ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : ambiguousBookings ? (
                    <div className="space-y-2">
                        <p className="font-semibold text-destructive">Multiple active bookings found for this room number. Please select the correct guest:</p>
                        <Select onValueChange={setSelectedBookingIdForBill}>
                            <SelectTrigger><SelectValue placeholder="Select a guest..." /></SelectTrigger>
                            <SelectContent>
                                {ambiguousBookings.map(b => (
                                    <SelectItem key={b.id} value={b.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={b.guestPhotoURL} />
                                                <AvatarFallback>{getInitials(b.guestName)}</AvatarFallback>
                                            </Avatar>
                                            <span>{b.guestName} (Checked in: {getSafeDate(b.checkInDate) ? format(getSafeDate(b.checkInDate)!, 'PPp') : 'N/A'})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : bookingForBill ? (
                     <div className="p-4 rounded-md border bg-muted flex items-center gap-4">
                         <Avatar className="h-14 w-14">
                            <AvatarImage src={bookingForBill.guestPhotoURL} />
                            <AvatarFallback>{getInitials(bookingForBill.guestName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{bookingForBill.guestName}</p>
                            <p className="text-sm text-muted-foreground">{bookingForBill.guestEmail}</p>
                            <Badge variant="success" className="mt-1">Active Check-in</Badge>
                        </div>
                    </div>
                ) : (
                     <div className="space-y-2">
                        <p className="font-semibold text-destructive">Could not automatically find an active booking for Room {orderToBill?.roomNumber}.</p>
                        <Label htmlFor="manual-room-number">Enter Correct Room Number</Label>
                        <Input id="manual-room-number" value={manualRoomNumber} onChange={(e) => setManualRoomNumber(e.target.value)} />
                    </div>
                )}
                 <AlertDialogFooter>
                    <AlertDialogCancel disabled={isUpdatingOrder}>Cancel</AlertDialogCancel>
                    <Button
                        onClick={handleAddBillToRoom}
                        loading={isUpdatingOrder}
                        disabled={isLoadingBooking || (!bookingForBill && !manualRoomNumber && !selectedBookingIdForBill)}
                    >
                    Confirm & Add Bill
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}

export default withAuth(KitchenPanelPage, PagePermission.VIEW_KITCHEN_PAGE);
