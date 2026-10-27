'use client';

import * as React from 'react';
import { Bed, DollarSign, Wallet, FileWarning, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddRoomForm } from '@/components/rooms/add-room-form';
import { EditRoomForm } from '@/components/rooms/edit-room-form';
import { DeleteRoomDialog } from '@/components/rooms/delete-room-dialog';
import { ViewRoomDialog } from '@/components/rooms/view-room-dialog';
import { BulkDeleteRoomDialog } from '@/components/rooms/bulk-delete-room-dialog';
import { BulkEditRoomForm } from '@/components/rooms/bulk-edit-room-form';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, writeBatch, collection, query, where, getDocs, increment, collectionGroup } from 'firebase/firestore';
import { ResetInventoryDialog } from '@/components/rooms/reset-inventory-dialog';
import { StatCard } from '@/components/ui/stat-card';
import { isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { RoomList } from '@/components/rooms/room-list';
import type { Room, Booking, Payment, Bill } from '@/lib/types';


function RoomsPage() {
  const [isAddRoomOpen, setIsAddRoomOpen] = React.useState(false);
  const [isEditRoomOpen, setIsEditRoomOpen] = React.useState(false);
  const [isDeleteRoomOpen, setIsDeleteRoomOpen] = React.useState(false);
  const [isViewRoomOpen, setIsViewRoomOpen] = React.useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = React.useState(false);
  const [isResetInventoryOpen, setIsResetInventoryOpen] = React.useState(false);
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null);
  const [allRooms, setAllRooms] = React.useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = React.useState<Room[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const { settings } = useSettings();
  const firestore = useFirestore();
  const { toast } = useToast();
  const userCurrency = settings?.currency || 'USD';

  const FETCH_OPTS = { realtime: false, cache: false } as const;

  const roomsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'rooms')) : null, [firestore]);
  const { data: rooms, isLoading: areRoomsLoading, refetch: refetchRooms } = useCollection<Room>(roomsQuery, FETCH_OPTS);

  const paymentsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore]);
  const { data: payments, isLoading: arePaymentsLoading, refetch: refetchPayments } = useCollection<Payment>(paymentsQuery, FETCH_OPTS);

  const billsQuery = React.useMemo(() => firestore ? query(collectionGroup(firestore, 'bills')) : null, [firestore]);
  const { data: bills, isLoading: areBillsLoading, refetch: refetchBills } = useCollection<Bill>(billsQuery, FETCH_OPTS);

  const activeBookingsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in'])) : null, [firestore]);
  const { data: activeBookings, isLoading: areActiveBookingsLoading, refetch: refetchActiveBookings } = useCollection<Booking>(activeBookingsQuery, FETCH_OPTS);

  const allBookingsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'bookings')) : null, [firestore]);
  const { data: allBookingsData, isLoading: areAllBookingsLoading, refetch: refetchAllBookings } = useCollection<Booking>(allBookingsQuery, FETCH_OPTS);


  const dashboardStats = React.useMemo(() => {
    const totalRooms = rooms?.reduce((acc, room) => acc + (room.totalRooms || 0), 0) || 0;

    const allBookingPayments = (allBookingsData || [])
        .filter(b => b.paymentMethod && b.status !== 'Refunded' && b.status !== 'Cancelled')
        .map(b => ({
            amount: b.totalAmount || 0,
            date: getSafeDate(b.createdAt)!,
            paymentMethod: b.paymentMethod!,
        }));

    const allAdditionalPayments = (payments || []).map(p => ({
        amount: p.amount,
        date: getSafeDate(p.transactionDate)!,
        paymentMethod: p.paymentMethod,
    }));

    const allPayments = [...allBookingPayments, ...allAdditionalPayments].filter(p => p.date);

    let filteredPayments = allPayments;
    let incomeLabel = "Total Income";

    if (dateRange?.from) {
      const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
      filteredPayments = allPayments.filter(p => p.date && isWithinInterval(p.date, interval));
      incomeLabel = `Filtered Income (${format(dateRange.from, 'LLL d')} - ${format(dateRange.to || dateRange.from, 'LLL d')})`
    }

    const income = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalBillPaid = (bills || []).filter(b => b.paid).reduce((sum, b) => sum + b.total, 0) || 0;

    const activeBookingIds = new Set(activeBookings?.map(b => b.id));
    const activeOutstandingBills = (bills || []).filter(b => !b.paid && activeBookingIds.has((b as any).bookingId));
    const totalOutstandingBill = activeOutstandingBills?.reduce((sum, b) => sum + b.total, 0) || 0;

    const grandTotal = totalRevenue + totalBillPaid;

    const paymentMethodTotals = filteredPayments.reduce((acc, p) => {
        const method = p.paymentMethod || 'Unknown';
        acc[method] = (acc[method] || 0) + p.amount;
        return acc;
    }, {} as Record<string, number>);

    const topPaymentMethods = Object.entries(paymentMethodTotals || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    return {
      totalRooms,
      income,
      incomeLabel,
      totalRevenue,
      totalBillPaid,
      totalOutstandingBill,
      grandTotal,
      topPaymentMethods
    };
  }, [rooms, allBookingsData, payments, bills, activeBookings, dateRange]);


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);
  }

  const handleDataMutation = () => {
    refetchRooms();
    refetchPayments();
    refetchBills();
    refetchActiveBookings();
    refetchAllBookings();
  };


  const handleViewDetails = (room: Room) => {
    setSelectedRoom(room);
    setIsViewRoomOpen(true);
  };

  const handleEdit = (room: Room) => {
    setSelectedRoom(room);
    setIsEditRoomOpen(true);
  };

  const handleDelete = (room: Room) => {
    setSelectedRoom(room);
    setIsDeleteRoomOpen(true);
  };

  const handleBulkDelete = (roomsToDelete: Room[]) => {
    setSelectedRooms(roomsToDelete);
    setIsBulkDeleteOpen(true);
  }

  const handleBulkEdit = (roomsToEdit: Room[]) => {
    setSelectedRooms(roomsToEdit);
    setIsBulkEditOpen(true);
  }

  const handleResetInventory = (room: Room) => {
    setSelectedRoom(room);
    setIsResetInventoryOpen(true);
  };

  const confirmResetInventory = async (roomToReset: Room) => {
    if (!firestore) return;
    try {
      const batch = writeBatch(firestore);
      const roomRef = doc(firestore, 'rooms', roomToReset.id);

      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('roomId', '==', roomToReset.id),
        where('status', 'in', ['Active', 'Checked-in'])
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);

      for (const bookingDoc of bookingsSnapshot.docs) {
        const billsQuery = query(collection(firestore, `bookings/${bookingDoc.id}/bills`));
        const billsSnapshot = await getDocs(billsQuery);
        billsSnapshot.forEach(billDoc => batch.delete(billDoc.ref));

        batch.delete(bookingDoc.ref);
      }

      batch.update(roomRef, {
        availableRooms: roomToReset.totalRooms,
        bookedRooms: 0,
        individualRoomStatus: {},
      });

      await batch.commit();

      toast({
        variant: 'success',
        title: 'Inventory Reset',
        description: `The inventory for ${roomToReset.name} has been reset.`,
      });
      handleDataMutation();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Resetting Inventory',
        description: error.message || 'An unexpected error occurred.',
      });
    }
  };

  const handleNavigateRoom = (direction: 'next' | 'prev') => {
    if (!selectedRoom || !rooms || rooms.length === 0) return;

    const currentIndex = rooms.findIndex(r => r.id === selectedRoom.id);
    if (currentIndex === -1) return;

    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex >= 0 && nextIndex < rooms.length) {
        setSelectedRoom(rooms[nextIndex]);
    }
  };


  const handleCloseDialogs = () => {
    setSelectedRoom(null);
    setSelectedRooms([]);
    setIsAddRoomOpen(false);
    setIsEditRoomOpen(false);
    setIsDeleteRoomOpen(false);
    setIsViewRoomOpen(false);
    setIsBulkDeleteOpen(false);
    setIsBulkEditOpen(false);
    setIsResetInventoryOpen(false);
  }

  return (
    <>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Bed className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Manage Rooms</h1>
              <p className="text-muted-foreground">
                View, add, and manage your hotel's room inventory.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            <Button onClick={() => setIsAddRoomOpen(true)}>Add Room</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <StatCard icon={Bed} title="Total Rooms" value={dashboardStats.totalRooms} description="All rooms across all types." />
            <StatCard icon={DollarSign} title={dashboardStats.incomeLabel} value={formatCurrency(dashboardStats.income)} description="Total revenue for the selected period." />
            <StatCard icon={Wallet} title="Total Revenue" value={formatCurrency(dashboardStats.totalRevenue)} description="Total revenue from all sources." />
            <StatCard icon={TrendingUp} title="Total Bills Paid" value={formatCurrency(dashboardStats.totalBillPaid)} description="Total from paid bills only." />
            <StatCard icon={FileWarning} title="Outstanding Bills (Active Guests)" value={formatCurrency(dashboardStats.totalOutstandingBill)} description="Total amount of all unpaid bills from active guests." className="text-yellow-600 border-yellow-500"/>
            <StatCard icon={Wallet} title="Grand Total" value={formatCurrency(dashboardStats.grandTotal)} description="Total Revenue + Total Bills Paid" className="bg-primary/10 text-primary" />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardStats.topPaymentMethods.map(([method, total]) => (
                 <StatCard key={method} icon={Wallet} title={`${method} Total`} value={formatCurrency(total)} description={`Total revenue via ${method} for the selected period.`} />
            ))}
        </div>

        <RoomList
          onAddRoom={() => setIsAddRoomOpen(true)}
          onEditRoom={handleEdit}
          onDeleteRoom={handleDelete}
          onViewRoom={handleViewDetails}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
          onResetInventory={handleResetInventory}
          setAllRooms={setAllRooms}
          rooms={rooms || []}
          isLoading={areRoomsLoading}
          bills={bills || []}
        />
      </div>
      <AddRoomForm open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen} onSuccess={handleDataMutation} />
      {selectedRoom && (
        <>
          <ViewRoomDialog
            open={isViewRoomOpen}
            onOpenChange={handleCloseDialogs}
            room={selectedRoom}
            currency={userCurrency}
            roomList={rooms || []}
            onNavigate={handleNavigateRoom}
          />
          <EditRoomForm
            open={isEditRoomOpen}
            onOpenChange={handleCloseDialogs}
            room={selectedRoom}
            onSuccess={handleDataMutation}
          />
          <DeleteRoomDialog
            open={isDeleteRoomOpen}
            onOpenChange={handleCloseDialogs}
            room={selectedRoom}
            onSuccess={handleDataMutation}
          />
           <ResetInventoryDialog
            open={isResetInventoryOpen}
            onOpenChange={handleCloseDialogs}
            room={selectedRoom}
            onConfirmReset={confirmResetInventory}
          />
        </>
      )}
      {selectedRooms.length > 0 && (
        <>
            <BulkDeleteRoomDialog
                open={isBulkDeleteOpen}
                onOpenChange={handleCloseDialogs}
                rooms={selectedRooms}
                onSuccess={handleDataMutation}
            />
            <BulkEditRoomForm
                open={isBulkEditOpen}
                onOpenChange={handleCloseDialogs}
                rooms={selectedRooms}
                onSuccess={handleDataMutation}
            />
        </>
      )}
    </>
  );
}

export default withAuth(RoomsPage, PagePermission.VIEW_ROOMS_PAGE);
