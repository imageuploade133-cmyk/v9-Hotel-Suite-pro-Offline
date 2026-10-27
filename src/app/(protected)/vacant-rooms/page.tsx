'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Bed, DollarSign, UserCheck, BedDouble, Search } from 'lucide-react';
import type { Booking, IndividualRoom, Room, Payment } from '@/lib/types';
import { useRoomStatus } from '@/hooks/use-room-status';
import { EmptyState } from '@/components/ui/empty-state';
import VacantRoomsLoading from './loading';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/contexts/settings-context';
import { IndividualRoomCard } from '@/components/rooms/individual-room-card';
import { WalkInDialog } from '@/components/bookings/walk-in-dialog';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { useUser } from '@/contexts/user-context';
import { doc, writeBatch, serverTimestamp, getDocs, query, collection, where, getDoc, increment, addDoc, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { StatCard } from '@/components/ui/stat-card';
import { getSafeDate } from '@/lib/helpers';
import { isToday } from 'date-fns';

function VacantRoomsPage() {
  const { isLoading: isRoomStatusLoading, individualRoomsByStatus, allRoomsData, allBookingsData, reload: reloadRoomStatus } = useRoomStatus();
  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const canViewFinancials = userProfile?.role?.toLowerCase() === 'admin';

  const [searchTerm, setSearchTerm] = React.useState('');
  const [walkInRoom, setWalkInRoom] = React.useState<Room | null>(null);
  const [detailsBooking, setDetailsBooking] = React.useState<Booking | null>(null);

  const paymentsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore]);
  const { data: payments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery, { realtime: false });

  const { todaysIncome, todaysCheckIns } = React.useMemo(() => {
    const today = new Date();

    const allBookingPayments = (allBookingsData || [])
        .filter(b => b.paymentMethod && b.status !== 'Refunded' && b.status !== 'Cancelled' && getSafeDate(b.createdAt) && isToday(getSafeDate(b.createdAt)!))
        .map(b => ({ amount: b.totalAmount || 0 }));

    const allAdditionalPayments = (payments || [])
        .filter(p => getSafeDate(p.transactionDate) && isToday(getSafeDate(p.transactionDate)!))
        .map(p => ({ amount: p.amount }));

    const income = [...allBookingPayments, ...allAdditionalPayments].reduce((acc, p) => acc + p.amount, 0);

    const checkIns = (allBookingsData || []).filter(b => {
        const checkInDate = getSafeDate(b.checkInDate);
        return checkInDate && isToday(checkInDate) && (b.status === 'Active' || b.status === 'Checked-in');
    }).length;

    return { todaysIncome: income, todaysCheckIns: checkIns };
  }, [allBookingsData, payments]);

  const formatCurrency = (value: number) => {
    if (!settings?.currency) return value.toString();
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: settings.currency,
    }).format(value);
  };


  const vacantRooms = React.useMemo(() => {
    const vacant = individualRoomsByStatus['Vacant'] || [];

    if (!searchTerm) {
      return vacant;
    }

    const lowerCaseSearch = searchTerm.toLowerCase();
    return vacant.filter(room =>
      room.name.toLowerCase().includes(lowerCaseSearch) ||
      room.roomNumber.toLowerCase().includes(lowerCaseSearch)
    );
  }, [individualRoomsByStatus, searchTerm]);


  const handleBookingSuccess = () => {
    reloadRoomStatus();
  };

    const handleUpdateStatus = async (
    room: { id: string; roomNumber: string },
    newStatus: string
  ) => {
    if (!firestore || !userProfile) return;

    const batch = writeBatch(firestore);
    const roomTypeRef = doc(firestore, 'rooms', room.id);

    try {
      const roomTypeDoc = await getDoc(roomTypeRef);
      if (!roomTypeDoc.exists()) throw new Error("Room type not found");

      const roomTypeData = roomTypeDoc.data();
      const currentStatus = roomTypeData.individualRoomStatus?.[room.roomNumber];

      const wasAvailable = !currentStatus || currentStatus === 'Vacant';
      const isBecomingAvailable = newStatus === 'Vacant';

      const updates: { [key: string]: any } = {};
      const statusPath = `individualRoomStatus.${room.roomNumber}`;

      if (isBecomingAvailable) {
        updates[statusPath] = deleteField();
      } else {
        updates[statusPath] = newStatus;
      }

      // Only adjust counts if availability changes
      if (!wasAvailable && isBecomingAvailable) {
        updates.availableRooms = increment(1);
      } else if (wasAvailable && !isBecomingAvailable) {
        updates.availableRooms = increment(-1);
      }

      batch.update(roomTypeRef, updates);

        if (newStatus === 'Maintenance' && firestore) {
            const maintenanceQueueRef = collection(firestore, 'maintenance-queue');
            // Check if room already exists in maintenance queue
            const existingQuery = query(maintenanceQueueRef, where('roomNumber', '==', room.roomNumber));
            const existingSnapshot = await getDocs(existingQuery);
            if (existingSnapshot.empty) {
                await addDoc(maintenanceQueueRef, {
                    roomId: room.id,
                    roomNumber: room.roomNumber,
                    reason: 'Manually set to maintenance',
                    reportedAt: serverTimestamp(),
                    reportedBy: userProfile?.name || 'System',
                });
            }
        }

      await batch.commit();
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: `Room ${room.roomNumber} is now marked as "${newStatus}".`,
      });
      reloadRoomStatus();
    } catch (error) {
      console.error('Update status error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update status.',
      });
    }
  };

  const isLoading = isRoomStatusLoading || arePaymentsLoading;


  if (isLoading) {
    return <VacantRoomsLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
                <Bed className="h-10 w-10 text-primary" />
                <div>
                <h1 className="text-4xl font-bold tracking-tight">Vacant Rooms</h1>
                <p className="text-muted-foreground">
                    A real-time overview of all currently available rooms.
                </p>
                </div>
            </div>
             <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by room type or number..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {canViewFinancials && (
                <StatCard
                    title="Today's Income (All Rooms)"
                    value={formatCurrency(todaysIncome)}
                    icon={DollarSign}
                    description="Total revenue from all sources today."
                    isLoading={isLoading}
                />
            )}
            <StatCard
                title="Total Check-ins Today"
                value={todaysCheckIns}
                icon={UserCheck}
                description="Number of guests who have checked in today."
                isLoading={isLoading}
            />
             <StatCard
                title="Total Available Rooms"
                value={vacantRooms.length}
                icon={BedDouble}
                description="Rooms currently available for booking."
                isLoading={isLoading}
            />
        </div>

        {vacantRooms.length === 0 ? (
          <EmptyState
            icon={Bed}
            title={searchTerm ? 'No Vacant Rooms Found' : 'No Vacant Rooms Available'}
            description={searchTerm ? `No available rooms match your search for "${searchTerm}".` : "All rooms are currently occupied or otherwise unavailable."}
            className="min-h-[50vh]"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vacantRooms.map(room => (
              <IndividualRoomCard
                key={`${room.id}-${room.roomNumber}`}
                room={room}
                onUpdateRoomStatus={handleUpdateStatus}
                onViewBooking={setDetailsBooking}
                onBook={setWalkInRoom}
                userName={userProfile?.name}
              />
            ))}
          </div>
        )}
      </div>

       <WalkInDialog
        isOpen={!!walkInRoom}
        room={walkInRoom}
        availableRooms={allRoomsData || []}
        onClose={() => setWalkInRoom(null)}
        onSuccess={handleBookingSuccess}
        initialBookingType="checkin"
      />
       <BookingDetailsDialog
        open={!!detailsBooking}
        onOpenChange={(open) => !open && setDetailsBooking(null)}
        booking={detailsBooking}
      />
    </>
  );
}

export default withAuth(VacantRoomsPage, PagePermission.MANAGE_ROOM_STATUS);
