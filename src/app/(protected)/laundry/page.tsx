
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
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  WashingMachine,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
  Download,
  Printer,
  DollarSign,
  Volume2,
  VolumeX,
  Trash2,
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import type { LaundryOrder, Booking, UserProfile, Bill } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateLaundryOrderDialog } from '@/components/laundry/create-laundry-order-dialog';
import { LaundryOrderCard } from '@/components/laundry/laundry-order-card';
import { LaundryReceiptDialog } from '@/components/laundry/laundry-receipt-dialog';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LaundryHistoryTable } from '@/components/laundry/laundry-history-table';
import type { DateRange } from 'react-day-picker';
import { useSettings } from '@/contexts/settings-context';
import { StatCard } from '@/components/ui/stat-card';
import { getSafeDate } from '@/lib/helpers';
import { isToday, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { TopHeader } from '@/components/top-header';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import LaundryLoading from './loading';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const PAGE_SIZE = 12;

type FilterType = 'All' | 'Pending' | 'In-Progress' | 'Washed';

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

function LaundryManagementPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [activeListTab, setActiveListTab] = React.useState<FilterType>('Pending');
  const [activeMainTab, setActiveMainTab] = React.useState('active');
  const [orderToPrint, setOrderToPrint] = React.useState<LaundryOrder | null>(null);
  const [actionsOrder, setActionsOrder] = React.useState<LaundryOrder | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const [orders, setOrders] = React.useState<LaundryOrder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters for history
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('all');
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);


  // Pagination for Active Orders
  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);

  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';


   const staffQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('name'));
  }, [firestore]);
  const { data: staffMembers, isLoading: areStaffLoading } = useCollection<UserProfile>(staffQuery);

  const allBillsQuery = React.useMemo(() => firestore ? query(collectionGroup(firestore, 'bills')) : null, [firestore]);
  const { data: allBills } = useCollection<Bill>(allBillsQuery);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);
  };

  const { filteredIncome, todaysIncome, totalOutstanding, incomeLabel, totalIncome } = React.useMemo(() => {
    if (!allBills) return { totalIncome: 0, filteredIncome: 0, todaysIncome: 0, totalOutstanding: 0, incomeLabel: "Today's Income" };

    const laundryBills = allBills.filter(bill => bill.items.some(item => item.id.startsWith('laundry-')));

    let label = "Today's Income";
    const paidLaundryBills = laundryBills.filter(bill => bill.paid && bill.paidAt);

    const totalIncome = paidLaundryBills.reduce((acc, bill) => acc + bill.total, 0);

    const today = paidLaundryBills
      .filter(bill => isToday(getSafeDate(bill.paidAt)!))
      .reduce((acc, bill) => acc + bill.total, 0);

    let income = today;

    if (dateRange?.from) {
      const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
      const filteredPaidBills = paidLaundryBills.filter(b => {
          const paidAt = getSafeDate(b.paidAt);
          return paidAt && isWithinInterval(paidAt, interval);
      });
       income = filteredPaidBills.reduce((acc, bill) => acc + bill.total, 0);
      label = `Filtered Income (${format(dateRange.from, 'LLL d')} - ${format(dateRange.to || dateRange.from, 'LLL d')})`;
    } else {
      label = "Today's Income";
    }

    const outstanding = laundryBills
      .filter(bill => !bill.paid)
      .reduce((acc, bill) => acc + bill.total, 0);

    return { totalIncome, filteredIncome: income, todaysIncome: today, totalOutstanding: outstanding, incomeLabel: label };
  }, [allBills, dateRange]);


  const fetchOrders = React.useCallback(
    async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
      if (!firestore) return;

      setIsLoading(true);

      const constraints: any[] = [orderBy('createdAt', 'desc')];
      if (activeListTab !== 'All') {
        constraints.push(where('status', '==', activeListTab));
      } else {
        constraints.push(where('status', 'in', ['Pending', 'In-Progress', 'Washed']));
      }

      const baseQuery = query(collection(firestore, 'laundry'), ...constraints);

      const countSnapshot = await getDocs(baseQuery);
      setTotalCount(countSnapshot.size);

      let paginatedQuery;
      if (direction === 'next' && lastVisible) {
        paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisible) {
        paginatedQuery = query(baseQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      } else {
        paginatedQuery = query(baseQuery, limit(PAGE_SIZE));
      }

      try {
        const snapshot = await getDocs(paginatedQuery);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaundryOrder));

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
        console.error("Error fetching laundry orders:", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch laundry orders.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firestore, activeListTab]
  );

  React.useEffect(() => {
    fetchOrders('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListTab]);

  const handleCreateOrder = async (orderData: Omit<LaundryOrder, 'id' | 'createdAt' | 'orderNumber' | 'source'>) => {
    if (!firestore) return;

    try {
      const orderNumber = Math.floor(100000 + Math.random() * 900000).toString();
      const docRef = await addDoc(collection(firestore, 'laundry'), {
        ...orderData,
        orderNumber,
        createdAt: serverTimestamp(),
      });
      const newOrder = { id: docRef.id, ...orderData, orderNumber, createdAt: new Date() } as unknown as LaundryOrder;
      toast({ variant: 'success', title: 'Order Created', description: `Laundry order #${orderNumber} has been created.` });
      setIsCreateOpen(false);
      fetchOrders('initial');
      setOrderToPrint(newOrder);
    } catch (error) {
      console.error("Error creating order:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create order.' });
      throw error; // Re-throw to allow dialog to handle its loading state
    }
  };

  const handleUpdateStatus = async (order: LaundryOrder, newStatus: LaundryOrder['status']) => {
    if (!firestore || !userProfile) return;

    const orderRef = doc(firestore, 'laundry', order.id);

    try {
        await updateDoc(orderRef, {
            status: newStatus,
            staffId: userProfile.uid,
            staffName: userProfile.name,
        });
        toast({ variant: 'success', title: 'Status Updated', description: `Order #${order.orderNumber} is now ${newStatus}.` });
        fetchOrders('initial');
    } catch (error) {
        console.error("Error updating status:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    }
  };

  const handleQuickBill = async (order: LaundryOrder) => {
    if (!firestore || !userProfile) return;

    const bookingsQuery = query(collection(firestore, 'bookings'), where('roomNumber', '==', order.roomNumber), where('status', 'in', ['Active', 'Checked-in']), limit(1));

    const bookingSnapshot = await getDocs(bookingsQuery);

    if (bookingSnapshot.empty) {
        toast({ variant: 'destructive', title: 'No Active Guest', description: `No active guest found in room ${order.roomNumber} to bill.` });
        return;
    }

    const booking = { id: bookingSnapshot.docs[0].id, ...bookingSnapshot.docs[0].data() } as Booking;

    const batch = writeBatch(firestore);

    const newBillRef = doc(collection(firestore, `bookings/${booking.id}/bills`));
    batch.set(newBillRef, {
      items: order.items.map((item, index) => ({
        id: `laundry-${order.orderNumber}-${index}`,
        name: `Laundry: ${item.name}`,
        price: item.price,
        quantity: item.quantity,
        paid: false
      })),
      total: order.totalPrice,
      createdAt: serverTimestamp(),
      createdBy: userProfile.uid,
      createdByName: userProfile.name,
      paid: false,
      bookingId: booking.id,
    });

    const orderRef = doc(firestore, 'laundry', order.id);
    batch.update(orderRef, {
      billedAt: serverTimestamp(),
      billedByUid: userProfile.uid,
      billedByName: userProfile.name,
    });

    try {
        await batch.commit();
        toast({ variant: 'success', title: 'Bill Added', description: `Charge of ${formatCurrency(order.totalPrice)} for laundry added to bill for Room ${order.roomNumber}.` });
        fetchOrders('initial');
    } catch (error) {
        console.error("Error adding bill:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add bill.' });
    }
  };

  const confirmCancelOrder = async (orderToCancel: LaundryOrder) => {
    if (!firestore) return;

    setIsCancelling(true);
    const batch = writeBatch(firestore);

    const billForItem = allBills?.find(b => b.items.some(i => i.id.startsWith(`laundry-${orderToCancel.orderNumber}`)));

    if (billForItem) {
      const billRef = doc(firestore, `bookings/${(billForItem as any).bookingId}/bills`, billForItem.id);
      const newItems = billForItem.items.filter(item => !item.id.startsWith(`laundry-${orderToCancel.orderNumber}`));

      if (newItems.length === 0) {
        batch.delete(billRef);
      } else {
        const newTotal = newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        batch.update(billRef, { items: newItems, total: newTotal });
      }
    }

    const orderRef = doc(firestore, 'laundry', orderToCancel.id);
    batch.delete(orderRef);

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Order Cancelled',
        description: `Order #${orderToCancel.orderNumber} has been successfully cancelled and removed.`,
      });
      fetchOrders('initial');
      handleCloseActions();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        variant: 'destructive',
        title: 'Cancellation Failed',
        description: 'An unexpected error occurred while cancelling the order.',
      });
    } finally {
        setIsCancelling(false);
    }
  };


  const TABS: FilterType[] = ['All', 'Pending', 'In-Progress', 'Washed'];
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (isLoading && page === 1) {
    return <LaundryLoading />;
  }

  const handleOpenActions = (order: LaundryOrder) => {
    setActionsOrder(order);
  };
  const handleCloseActions = () => {
    setActionsOrder(null);
    setShowCancelConfirm(false);
  };

  const isBilled = !!allBills?.find(b => b.items.some(i => i.id.startsWith(`laundry-${actionsOrder?.orderNumber}`)));

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <TopHeader name="Laundry Management" icon={<WashingMachine />} description="Oversee and manage all guest laundry requests from a centralized dashboard."/>
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Laundry Order
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title={incomeLabel}
                value={formatCurrency(filteredIncome)}
                icon={DollarSign}
                description="From all paid laundry services in this period."
            />
             <StatCard
                title="Total Income"
                value={formatCurrency(totalIncome)}
                icon={DollarSign}
                description="All-time revenue from all paid laundry services."
            />
             <StatCard
                title="Total Outstanding"
                value={formatCurrency(totalOutstanding)}
                icon={DollarSign}
                description="For billed but unpaid laundry."
                className={totalOutstanding > 0 ? "text-yellow-600 border-yellow-500" : ""}
            />
        </div>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active Orders</TabsTrigger>
                <TabsTrigger value="history">Order History</TabsTrigger>
            </TabsList>
             <TabsContent value="active" className="mt-4">
                <Tabs value={activeListTab} onValueChange={(value) => { setActiveListTab(value as FilterType); setPage(1); fetchOrders('initial'); }}>
                    <TabsList>
                        {TABS.map(tab => (
                        <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
                      {Array.from({ length: 8 }).map((_, i) => <Loader2 key={i} className="animate-spin h-8 w-8 text-primary" />)}
                  </div>
                ) : orders.length === 0 ? (
                <EmptyState
                    icon={WashingMachine}
                    title={`No ${activeListTab !== 'All' ? activeListTab : ''} Orders`}
                    description="There are no laundry orders in this category."
                    className="mt-4"
                />
                ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
                    {orders.map(order => (
                        <LaundryOrderCard
                          key={order.id}
                          order={order}
                          onUpdateStatus={handleUpdateStatus}
                          onAddBill={handleQuickBill}
                          onOpenActions={handleOpenActions}
                          allBills={allBills || []}
                        />
                    ))}
                    </div>
                    {totalPages > 1 && (
                    <PaginationControls
                        canPrev={page > 1}
                        canNext={hasMore}
                        onPrev={() => setPage(p => p - 1)}
                        onNext={() => setPage(p => p + 1)}
                        currentPage={page}
                        totalPages={totalPages}
                    />
                    )}
                </>
                )}
            </TabsContent>
             <TabsContent value="history" className="mt-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Laundry Order History</h3>
                                <p className="text-sm text-muted-foreground">A record of all completed and delivered orders.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={areStaffLoading}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <SelectValue placeholder="Filter by staff..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Staff</SelectItem>
                                        {staffMembers?.map(staff => (
                                            <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                       <LaundryHistoryTable
                          dateRange={dateRange}
                          staffId={selectedStaffId}
                          onPrintReceipt={setOrderToPrint}
                          currency={userCurrency}
                          allBills={allBills || []}
                       />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!actionsOrder} onOpenChange={(open) => !open && handleCloseActions()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{showCancelConfirm ? 'Confirm Cancellation' : `Actions for Order #${actionsOrder?.orderNumber}`}</DialogTitle>
                {showCancelConfirm ? (
                     <DialogDescription>
                        This action cannot be undone. This will permanently delete laundry order #{actionsOrder?.orderNumber}.
                        {isBilled && <b className="block mt-2 text-destructive">The associated charge will be removed from the guest's bill.</b>}
                    </DialogDescription>
                ) : (
                    <DialogDescription>Customer: {actionsOrder?.customerName}</DialogDescription>
                )}
            </DialogHeader>
            {!showCancelConfirm ? (
                <div className="grid gap-3 py-4">
                    <Button variant="outline" className="w-full justify-start" onClick={() => { setOrderToPrint(actionsOrder); handleCloseActions(); }}>
                        <Printer className="mr-2 h-4 w-4" /> Print Receipt
                    </Button>
                    <Button variant="destructive" className="w-full justify-start" onClick={() => setShowCancelConfirm(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Cancel Order
                    </Button>
                </div>
            ) : (
                 <div className="py-4 font-semibold">
                    Are you sure you want to proceed?
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
                            onClick={() => confirmCancelOrder(actionsOrder!)}
                            loading={isCancelling}
                        >
                            Yes, Cancel Order
                        </Button>
                    </>
                 )}
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateLaundryOrderDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateOrder}
      />

      <LaundryReceiptDialog
        isOpen={!!orderToPrint}
        onClose={() => setOrderToPrint(null)}
        order={orderToPrint}
        allBills={allBills || []}
      />
    </>
  );
}

export default withAuth(LaundryManagementPage, PagePermission.VIEW_LAUNDRY_PAGE);

