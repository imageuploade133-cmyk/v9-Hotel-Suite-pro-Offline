
'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  Timestamp,
  writeBatch,
  doc,
  getDocs,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDoc,
  collectionGroup,
} from 'firebase/firestore';
import { format, parse, differenceInDays, setHours, setMinutes, isPast, formatDistanceToNow, isToday, startOfDay, endOfDay } from 'date-fns';
import {
  Bed,
  LogIn,
  LogOut,
  Phone,
  CircleX,
  Printer,
  Check,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  RefreshCw,
  FileText,
  DollarSign,
  User as UserIcon,
  Wallet,
  Users,
  CalendarCheck,
  ArrowRight,
  MoreHorizontal,
  Download,
  AlertCircle,
  ArrowRightLeft,
} from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import Link from 'next/link';

import type { Booking, Payment, Room, Bill, BillItem, UserProfile } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

import { getInitials, getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { EmptyState } from '@/components/ui/empty-state';
import { TimeRemaining } from '@/components/bookings/time-remaining';
import { CheckOutDialog } from '@/components/bookings/checkout-dialog';
import { CancelBookingDialog } from '@/components/bookings/cancel-booking-dialog';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { CancellationInvoiceDialog } from '@/components/bookings/cancellation-invoice-dialog';
import { AddBillDialog } from '@/components/bookings/add-bill-dialog';
import { PayBillsDialog } from '@/components/bookings/pay-bills-dialog';
import { GuestBillDialog } from '@/components/bookings/guest-bill-dialog';
import { InvoiceDownloadDialog } from '@/components/bookings/invoice-download-dialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { RenewBookingDialog } from '@/components/bookings/renew-booking-dialog';
import { ActiveBookingCard } from '@/components/bookings/active-booking-card';
import { TransferRoomDialog } from '@/components/bookings/transfer-room-dialog';
import { TotalActiveGuestBillCard } from '@/components/bookings/total-active-guest-bill-card';


const PAGE_SIZE = 8;
type TabType = 'active' | 'history';

interface FullBillItem extends BillItem {
    billId: string;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex-row items-center gap-4 space-y-0">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-12 w-full" />
          </CardContent>
          <CardFooter className="p-2">
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" onClick={onNext} disabled={!canNext}>
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function ActiveCheckInsPage() {
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const checkoutTime = settings?.checkoutTime || '12:00';
  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);


  const [activeTab, setActiveTab] = React.useState<TabType>('active');

  const [checkOutBooking, setCheckOutBooking] = React.useState<Booking | null>(
    null
  );
  const [cancelBooking, setCancelBooking] = React.useState<Booking | null>(
    null
  );
  const [receiptBooking, setReceiptBooking] = React.useState<Booking | null>(
    null
  );
  const [detailsBooking, setDetailsBooking] = React.useState<Booking | null>(
    null
  );
  const [invoiceBooking, setInvoiceBooking] = React.useState<Booking | null>(null);
  const [cancellationInvoiceBooking, setCancellationInvoiceBooking] = React.useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const [bookingToAddBill, setBookingToAddBill] = React.useState<Booking | null>(null);
  const [bookingToViewBill, setBookingToViewBill] = React.useState<Booking | null>(null);
  const [bookingToPayBills, setBookingToPayBills] = React.useState<Booking | null>(null);
  const [actionsBooking, setActionsBooking] = React.useState<Booking | null>(null);
  const [renewBooking, setRenewBooking] = React.useState<Booking | null>(null);
  const [transferBooking, setTransferBooking] = React.useState<Booking | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [cancelConfirmText, setCancelConfirmText] = React.useState('');
  const CONFIRM_CANCEL_TEXT = "CANCEL";

  const { data: rooms, isLoading: areRoomsLoading } = useCollection<Room>(
    React.useMemo(() => firestore ? query(collection(firestore, 'rooms')) : null, [firestore])
  );


  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);

  const [reloadCounter, setReloadCounter] = React.useState(0);
  const reloadCurrentPage = () => setReloadCounter(c => c + 1);

  const allBillsQuery = React.useMemo(() => firestore ? query(collectionGroup(firestore, 'bills')) : null, [firestore]);
  const { data: allBills, isLoading: areBillsLoading } = useCollection<Bill>(allBillsQuery);
  const paymentsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore]);
  const { data: allPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);

  // Fetch bills specifically for the invoice booking to ensure accuracy
  const invoiceBillsQuery = React.useMemo(() => invoiceBooking && firestore ? collection(firestore, 'bookings', invoiceBooking.id, 'bills') : null, [invoiceBooking, firestore]);
  const { data: invoiceBills } = useCollection<Bill>(invoiceBillsQuery);

  const invoicePayments = React.useMemo(() => {
    if (!invoiceBooking || !allPayments) return [];
    return allPayments.filter(p => p.bookingId === invoiceBooking.id);
  }, [invoiceBooking, allPayments]);

  const { totalCheckIns, totalIncome, todaysIncome, todaysCheckIns, overdueCheckIns } = React.useMemo(() => {
    let income = 0;
    let todayIncome = 0;
    let todayCheckInsCount = 0;
    let overdueCount = 0;

    bookings.forEach(booking => {
        const roomFee = booking.totalAmount || 0;
        const billsForBooking = (allBills || []).filter(bill => (bill as any).bookingId === booking.id);
        const billTotal = billsForBooking.reduce((billAcc, bill) => billAcc + bill.total, 0);

        income += roomFee + billTotal;

        if (getSafeDate(booking.checkInDate) && isToday(getSafeDate(booking.checkInDate)!)) {
            todayCheckInsCount++;
            todayIncome += roomFee + billTotal;
        }

        const scheduledCheckoutDate = getSafeDate(booking.checkOutDate) ? getCheckoutDateTime(getSafeDate(booking.checkOutDate)!, checkoutTime) : null;
        if (scheduledCheckoutDate && isPast(scheduledCheckoutDate)) {
            overdueCount++;
        }
    });

    return {
      totalCheckIns: bookings.length,
      totalIncome: income,
      todaysIncome: todayIncome,
      todaysCheckIns: todayCheckInsCount,
      overdueCheckIns: overdueCount
    };
  }, [bookings, allBills, checkoutTime]);


  const fetchBookings = React.useCallback(
    async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
      if (!firestore) return;

      setIsLoading(true);

      const statusFilter = activeTab === 'active' ? ['Checked-in', 'Active'] : ['Checked-out'];
      const orderByField = activeTab === 'active' ? 'checkOutDate' : 'actualCheckOutDate';
      const orderByDirection = activeTab === 'active' ? 'asc' : 'desc';

      const baseQuery = query(
        collection(firestore, 'bookings'),
        where('status', 'in', statusFilter),
        orderBy(orderByField, orderByDirection)
      );

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

        if (!snapshot.empty) {
          const data = snapshot.docs.map(
            doc =>
              ({
                id: doc.id,
                ...doc.data(),
                checkInDate: getSafeDate(doc.data().checkInDate),
                checkOutDate: getSafeDate(doc.data().checkOutDate),
                actualCheckOutDate: getSafeDate(doc.data().actualCheckOutDate),
              } as Booking)
          );
          setBookings(data);

          const newFirst = snapshot.docs[0];
          const newLast = snapshot.docs[snapshot.docs.length - 1];
          setFirstVisible(newFirst);
          setLastVisible(newLast);

          const nextQuery = query(baseQuery, startAfter(newLast), limit(1));
          const nextSnapshot = await getDocs(nextQuery);
          setHasMore(!nextSnapshot.empty);

          if(direction === 'next') setPage(p => p + 1);
          if(direction === 'prev' && page > 1) setPage(p => p - 1);
          if(isInitialOrReload) setPage(1);

        } else {
           if (isInitialOrReload) {
              setBookings([]);
          }
          setHasMore(false);
          if (direction === 'prev' && page > 1) {
            fetchBookings('initial');
          }
        }
      } catch (error) {
        console.error("Error fetching bookings: ", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch check-in data.'
        });
      } finally {
        setIsLoading(false);
      }
    },
    [firestore, lastVisible, firstVisible, toast, activeTab]
  );

  React.useEffect(() => {
    fetchBookings('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, reloadCounter, activeTab]);


  const handleNextPage = () => {
    if (!hasMore) return;
    fetchBookings('next');
  };

  const handlePrevPage = () => {
    if (page <= 1) return;
    fetchBookings('prev');
  };

  const handleCheckOut = async (booking: Booking) => {
    if (!firestore || !user || !booking.roomNumber) return;

    // Check for unpaid bills before proceeding
    const unpaidBillsQuery = query(
      collection(firestore, `bookings/${booking.id}/bills`),
      where('paid', '==', false)
    );
    const unpaidBillsSnapshot = await getDocs(unpaidBillsQuery);
    if (!unpaidBillsSnapshot.empty) {
      toast({
        variant: 'destructive',
        title: 'Checkout Blocked',
        description: `This guest has ${unpaidBillsSnapshot.size} unpaid bill(s). Please settle all payments before checking out.`,
        duration: 8000,
      });
      return; // Stop the checkout process
    }

    setCheckOutBooking(booking);
  };

  const confirmCheckOut = async (booking: Booking, staffName: string, notes?: string) => {
    if (!firestore || !user || !booking.roomNumber || !userProfile) {
        throw new Error("Required information for checkout is missing.");
    }

    const batch = writeBatch(firestore);
    const actualCheckOutDate = new Date();

    const bookingRef = doc(firestore, 'bookings', booking.id);
    const updateData: Partial<Booking> = {
      status: 'Checked-out',
      actualCheckOutDate: Timestamp.fromDate(actualCheckOutDate),
      checkoutNotes: notes || '',
      checkedOutByUid: user.uid,
      checkedOutByName: staffName,
    };
    batch.update(bookingRef, updateData);

    const roomRef = doc(firestore, 'rooms', booking.roomId);
    batch.update(roomRef, {
      availableRooms: increment(1),
      bookedRooms: increment(-1),
      [`individualRoomStatus.${booking.roomNumber}`]: 'Cleaning in Progress',
    });

    const cleaningQueueCollectionRef = collection(firestore, 'cleaning-queue');
    const newCleaningItemRef = doc(cleaningQueueCollectionRef);
    batch.set(newCleaningItemRef, {
      roomId: booking.roomId,
      roomNumber: booking.roomNumber,
      lastGuestName: booking.guestName,
      lastGuestPhotoURL: booking.guestPhotoURL || null,
      bookingId: booking.id,
      checkedOutAt: Timestamp.fromDate(actualCheckOutDate),
      lastGuestBookingDetails: { ...booking, ...updateData, actualCheckOutDate }
    });


    try {
        await batch.commit();
        toast({
            variant: 'success',
            title: 'Check-out Successful',
            description: `${booking.guestName} has been checked out. Room ${booking.roomNumber} is now in the cleaning queue.`,
        });
        const updatedBooking = { ...booking, ...updateData, actualCheckOutDate: actualCheckOutDate };
        setReceiptBooking(updatedBooking);
        reloadCurrentPage();
    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to check out.',
        });
        console.error('Check-out error:', error);
        throw error;
    } finally {
        setCheckOutBooking(null);
    }
  };

  const handleModalClose = () => {
    setActionsBooking(null);
    setShowCancelConfirm(false);
    setCancelConfirmText('');
  }

  const confirmCancelBooking = async (bookingToCancel: Booking) => {
    if (!firestore || !bookingToCancel || !user || !userProfile || !bookingToCancel.roomNumber) return;
    setIsCancelling(true);
    const batch = writeBatch(firestore);
    const bookingRef = doc(firestore, 'bookings', bookingToCancel.id);
    const roomRef = doc(firestore, 'rooms', bookingToCancel.roomId);

    batch.update(bookingRef, {
      status: 'Refunded',
      cancelledByUid: user.uid,
      cancelledByName: userProfile.name,
      cancelledAt: serverTimestamp(),
      refundedAt: serverTimestamp(),
    });

    // This was an active booking, so inventory must be adjusted
    batch.update(roomRef, {
      bookedRooms: increment(-1),
      availableRooms: increment(1),
      [`individualRoomStatus.${bookingToCancel.roomNumber}`]: 'Vacant',
    });

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Booking Cancelled & Refunded',
        description: `Booking for Room ${bookingToCancel.roomNumber} has been cancelled and refunded.`,
      });
      setCancellationInvoiceBooking(bookingToCancel);
      reloadCurrentPage();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to cancel booking.',
      });
      console.error('Cancellation error:', error);
    } finally {
      setIsCancelling(false);
      handleModalClose();
    }
  };

  const handleAddBill = async (booking: Booking, items: BillItem[], total: number) => {
    if (!firestore || !user) return;
    try {
      const billRef = doc(collection(firestore, `bookings/${booking.id}/bills`));
      await setDoc(billRef, {
        items: items.map(item => ({...item, billId: billRef.id})),
        total,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: userProfile?.name || 'Unknown',
        paid: false,
        bookingId: booking.id,
      });

      toast({
        variant: 'success',
        title: 'Bill Updated',
        description: `Successfully added charge of ${formatCurrency(total)} to the bill for Room ${booking.roomNumber}.`,
      });
      setBookingToAddBill(null);
      reloadCurrentPage();
    } catch (error) {
      console.error('Error adding bill:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add items to the bill.',
      });
    }
  };

  const handlePayBills = async (
    booking: Booking,
    paymentMethod: string,
    paidItems: FullBillItem[],
    customAmount?: number
  ) => {
    if (!firestore || !userProfile) return;

    const batch = writeBatch(firestore);
    const paymentRef = doc(collection(firestore, 'payments'));
    const amountToPay = customAmount ?? paidItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const now = new Date();

    const sanitizedBookingDetails = {
      ...booking,
      checkInDate: booking.checkInDate || null,
      checkOutDate: booking.checkOutDate || null,
      actualCheckOutDate: booking.actualCheckOutDate || null,
    };

    const paymentData: Partial<Payment> = {
      id: paymentRef.id,
      bookingId: booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      roomNumber: booking.roomNumber,
      amount: amountToPay,
      paymentMethod: paymentMethod,
      status: 'Paid',
      transactionDate: now,
      bookingDetails: sanitizedBookingDetails,
      createdByUid: userProfile.uid,
      createdByName: userProfile.name,
      ...(customAmount ? {type: 'Additional Charges'} : { type: 'Additional Charges', items: paidItems.map(({ billId, ...item }) => item) })
    };
    batch.set(paymentRef, paymentData);

    if (!customAmount) {
      for (const item of paidItems) {
        if (item.id === 'room-charge') {
          const bookingRef = doc(firestore, 'bookings', booking.id);
          batch.update(bookingRef, {
            paymentMethod: paymentMethod,
            status: 'Reserved'
          });
        } else {
          const billRef = doc(firestore, `bookings/${booking.id}/bills/${item.billId}`);
          const billDoc = await getDoc(billRef);

          if (billDoc.exists()) {
            const billData = billDoc.data() as Bill;
            const updatedItems = billData.items.map(i =>
              i.id === item.id ? { ...i, paid: true, paymentId: paymentRef.id } : i
            );
            batch.update(billRef, { items: updatedItems });

            const allPaid = updatedItems.every(i => i.paid);
            if (allPaid) {
              batch.update(billRef, { paid: true, paymentId: paymentRef.id, paymentMethod, paidAt: Timestamp.fromDate(now) });
            }
          }
        }
      }
    }

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Payment Successful',
        description: `Successfully processed payment of ${formatCurrency(amountToPay)}.`,
      });
      reloadCurrentPage();
    } catch (error) {
      console.error("Error paying bills: ", error);
      toast({ variant: 'destructive', title: 'Payment Failed', description: 'Could not process payment.' });
      throw error;
    } finally {
      setBookingToPayBills(null);
    }
  };

  const handleToggleCollectPayment = async (booking: Booking, collect: boolean) => {
    if (!firestore) return;
    const bookingRef = doc(firestore, 'bookings', booking.id);
    try {
        await updateDoc(bookingRef, { collectPayment: collect });
        toast({
            variant: 'success',
            title: 'Updated',
            description: `Payment collection for ${booking.guestName} is now ${collect ? 'ON' : 'OFF'}.`
        });
        reloadCurrentPage();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update payment status.'})
    }
  };

  const paymentForReceipt: Payment | null = React.useMemo(() => {
    if (!receiptBooking) return null;
    const isCheckedOut = receiptBooking.status === 'Checked-out';
    return {
      id: receiptBooking.bookingId || receiptBooking.id,
      guestName: receiptBooking.guestName,
      guestEmail: receiptBooking.guestEmail,
      guestPhotoURL: receiptBooking.guestPhotoURL,
      roomNumber: receiptBooking.roomNumber!,
      amount: receiptBooking.totalAmount || 0,
      paymentMethod: receiptBooking.paymentMethod || 'On-site',
      status: receiptBooking.status as string,
      transactionDate: getSafeDate(receiptBooking.checkInDate) || new Date(),
      bookingDetails: receiptBooking,
      createdByUid: isCheckedOut ? receiptBooking.checkedOutByUid : receiptBooking.createdByUid,
      createdByName: isCheckedOut ? receiptBooking.checkedOutByName : receiptBooking.createdByName,
    };
  }, [receiptBooking]);

  const isPageLoading = isLoading || areRoomsLoading || areBillsLoading || arePaymentsLoading;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <UserCheck className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Active Check-ins
              </h1>
              <p className="text-muted-foreground">
                A real-time overview of all currently checked-in guests.
              </p>
            </div>
          </div>
        </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Total Active Check-ins"
                value={totalCheckIns}
                icon={Users}
                description="Number of guests currently checked in."
                isLoading={isPageLoading}
            />
             <StatCard
                title="Overdue Checkouts"
                value={overdueCheckIns}
                icon={AlertCircle}
                description="Guests past scheduled checkout."
                isLoading={isPageLoading}
                className={overdueCheckIns > 0 ? "border-red-500 bg-red-50 dark:bg-red-900/10" : ""}
            />
             <StatCard
                title="Total Income (Active Stays)"
                value={formatCurrency(totalIncome)}
                icon={DollarSign}
                description="Total revenue from all active bookings."
                isLoading={isPageLoading}
            />
             <TotalActiveGuestBillCard bills={allBills || []} isLoadingBills={areBillsLoading} />
             <StatCard
                title="Today's Check-in Income"
                value={formatCurrency(todaysIncome)}
                icon={CalendarCheck}
                description="Revenue from guests who checked in today."
                isLoading={isPageLoading}
            />
             <StatCard
                title="Today's Check-ins"
                value={todaysCheckIns}
                icon={LogIn}
                description="Number of guests who checked in today."
                isLoading={isPageLoading}
            />
        </div>


        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
            <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
        </Tabs>

        {isPageLoading ? (
          <LoadingSkeleton />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={Bed}
            title={activeTab === 'active' ? "No Active Check-ins" : "No Checkout History"}
            description={activeTab === 'active' ? "There are currently no guests checked in." : "There are no checkouts to display."}
            className="min-h-[50vh]"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bookings.map(booking => (
              activeTab === 'active' ? (
                 <ActiveBookingCard
                    key={booking.id}
                    booking={booking}
                    onCheckOut={() => handleCheckOut(booking)}
                    onViewDetails={() => setDetailsBooking(booking)}
                    checkoutTime={checkoutTime}
                    onAddBill={() => setBookingToAddBill(booking)}
                    onViewBill={() => setBookingToViewBill(booking)}
                    onPayBills={() => setBookingToPayBills(booking)}
                    rooms={rooms}
                    onToggleCollectPayment={handleToggleCollectPayment}
                    onActionsClick={setActionsBooking}
                  />
              ) : (
                 <CheckoutHistoryCard
                    key={booking.id}
                    booking={booking}
                    onReprintReceipt={() => setReceiptBooking(booking)}
                    onViewDetails={() => setDetailsBooking(booking)}
                />
              )
            ))}
          </div>
        )}

        {!isPageLoading && bookings.length > 0 && (
            <div className="mt-4 flex items-center justify-end">
                <PaginationControls
                canPrev={page > 1}
                canNext={hasMore}
                onPrev={handlePrevPage}
                onNext={handleNextPage}
                />
            </div>
        )}
      </div>

      <CheckOutDialog
        isOpen={!!checkOutBooking}
        booking={checkOutBooking}
        onClose={() => setCheckOutBooking(null)}
        onCheckOut={(booking, staffName, notes) => confirmCheckOut(booking, staffName, notes)}
      />
      <ReprintReceiptDialog
        isOpen={!!receiptBooking}
        onClose={() => setReceiptBooking(null)}
        payment={paymentForReceipt}
        settings={settings}
      />
      <BookingDetailsDialog
        open={!!detailsBooking}
        onOpenChange={(open) => !open && setDetailsBooking(null)}
        booking={detailsBooking}
      />
      <CancellationInvoiceDialog
        isOpen={!!cancellationInvoiceBooking}
        onClose={() => setCancellationInvoiceBooking(null)}
        booking={cancellationInvoiceBooking}
      />
       {bookingToAddBill && (
        <AddBillDialog
          booking={bookingToAddBill}
          isOpen={!!bookingToAddBill}
          onClose={() => setBookingToAddBill(null)}
          onConfirm={handleAddBill}
        />
      )}
       <GuestBillDialog
        isOpen={!!bookingToViewBill}
        onClose={() => setBookingToViewBill(null)}
        booking={bookingToViewBill}
        allBills={allBills}
        allPayments={allPayments}
        isLoading={areBillsLoading || arePaymentsLoading}
      />
      <InvoiceDownloadDialog
        isOpen={!!invoiceBooking}
        onClose={() => setInvoiceBooking(null)}
        booking={invoiceBooking}
        bills={invoiceBills || []}
        payments={invoicePayments}
        currency={currency}
        settings={settings}
      />
      {bookingToPayBills && (
        <PayBillsDialog
          booking={bookingToPayBills}
          isOpen={!!bookingToPayBills}
          onClose={() => setBookingToPayBills(null)}
          onConfirm={handlePayBills}
        />
      )}
      <RenewBookingDialog
        isOpen={!!renewBooking}
        onClose={() => setRenewBooking(null)}
        booking={renewBooking}
        room={rooms?.find(r => r.id === renewBooking?.roomId)}
        onSuccess={reloadCurrentPage}
      />
      <TransferRoomDialog
        isOpen={!!transferBooking}
        onClose={() => setTransferBooking(null)}
        booking={transferBooking}
        rooms={rooms || []}
        onSuccess={reloadCurrentPage}
      />

      <Dialog open={!!actionsBooking} onOpenChange={handleModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showCancelConfirm ? 'Confirm Cancellation' : `Actions for ${actionsBooking?.guestName}`}</DialogTitle>
            {!showCancelConfirm && <DialogDescription>Room {actionsBooking?.roomNumber}</DialogDescription>}
          </DialogHeader>

          {!showCancelConfirm ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  setReceiptBooking(actionsBooking);
                  handleModalClose();
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Reprint Receipt
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInvoiceBooking(actionsBooking);
                  handleModalClose();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Invoice
              </Button>
              <Button variant="outline" onClick={() => { setRenewBooking(actionsBooking); handleModalClose(); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Renew Booking
              </Button>
              <Button variant="outline" onClick={() => { setTransferBooking(actionsBooking); handleModalClose(); }}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Room
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
              >
                <CircleX className="mr-2 h-4 w-4" />
                Cancel Booking
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <DialogDescription>
                  This action cannot be undone. This will cancel the booking for <span className="font-bold">{actionsBooking?.guestName}</span> and refund any payments made. Please confirm.
              </DialogDescription>
              <div>
                <Label htmlFor="cancel-confirm" className="text-destructive font-semibold">Type "{CONFIRM_CANCEL_TEXT}" to confirm.</Label>
                <Input
                  id="cancel-confirm"
                  value={cancelConfirmText}
                  onChange={(e) => setCancelConfirmText(e.target.value)}
                  autoComplete="off"
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
             {!showCancelConfirm ? (
              <Button variant="ghost" onClick={handleModalClose}>Close</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowCancelConfirm(false)} disabled={isCancelling}>Go Back</Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmCancelBooking(actionsBooking!)}
                  disabled={cancelConfirmText !== CONFIRM_CANCEL_TEXT || isCancelling}
                  loading={isCancelling}
                >
                  Confirm Cancellation
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(ActiveCheckInsPage, PagePermission.VIEW_BOOKINGS_PAGE);

function CheckoutHistoryCard({
  booking,
  onReprintReceipt,
  onViewDetails,
}: {
  booking: Booking;
  onReprintReceipt: (b: Booking) => void;
  onViewDetails: (b: Booking) => void;
}) {
  const checkedInDate = getSafeDate(booking.checkInDate);
  const checkedOutDate = getSafeDate(booking.actualCheckOutDate) || getSafeDate(booking.checkOutDate);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-4 space-y-0">
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12 border-2 border-muted transition-opacity">
            <AvatarImage src={booking.guestPhotoURL} />
            <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
          </Avatar>
        </div>
        <div>
          <CardTitle className="text-xl">{booking.guestName}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Bed className="h-4 w-4" /> Room {booking.roomNumber}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <LogIn className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Checked In</p>
              <p className="text-muted-foreground">
                {checkedInDate
                  ? format(checkedInDate, 'EEEE, dd-MM-yyyy, p')
                  : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Checked Out</p>
              <p className="text-muted-foreground">
                {checkedOutDate
                  ? format(checkedOutDate, 'EEEE, dd-MM-yyyy, p')
                  : 'N/A'}
              </p>
            </div>
          </div>
          {booking.checkedOutByName && (
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Processed By</p>
                <p className="text-muted-foreground">
                  {booking.checkedOutByName}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 bg-muted/50 p-2">
        <div className="flex w-full items-center gap-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => onViewDetails(booking)}>
                <FileText className="mr-2 h-4 w-4" /> View Details
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onReprintReceipt(booking)}>
                <Printer className="mr-2 h-4 w-4" /> Receipt
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

