

'use client';

import * as React from 'react';
import { PagePermission, ALL_PERMISSIONS } from '@/lib/permissions';
import {
  collection,
  query,
  doc,
  writeBatch,
  getDocs,
  where,
  increment,
  serverTimestamp,
  updateDoc,
  limit,
  deleteField,
  addDoc,
  getDoc,
} from 'firebase/firestore';
import { ShieldAlert } from 'lucide-react';
import type { Booking, IndividualRoom, Room } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import CustomStatusLoading from './loading';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { useRoomStatus } from '@/hooks/use-room-status';
import { useParams } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { useAuth } from '@/components/auth/auth-provider';
import { IndividualRoomCard } from '@/components/bookings/individual-room-card';
import { TopHeader } from '@/components/top-header';
import { WalkInDialog } from '@/components/bookings/walk-in-dialog';
import { useBookings } from '@/hooks/use-bookings';
import { sanitizeForUrl } from '@/lib/helpers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function StatusPageContent() {
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const params = useParams();

  const { isLoading, individualRoomsByStatus, allRoomsData, reload: reloadRoomStatus } = useRoomStatus();

  const status = React.useMemo(() => {
    const statusParam = params.status as string;
    if (!statusParam) return '';
    // Decode the URL-encoded status name and replace dashes with spaces
    return decodeURIComponent(statusParam).replace(/-/g, ' ');
  }, [params.status]);

  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [walkInRoom, setWalkInRoom] = React.useState<Room | null>(null);
  const { reload: reloadBookings } = useBookings();


  const statusRooms = React.useMemo(() => {
    if (isLoading || !status) return [];

    // Find the status with a case-insensitive match
    const statusKey = Object.keys(individualRoomsByStatus).find(
      key => key.toLowerCase() === status.toLowerCase()
    );

    return statusKey ? individualRoomsByStatus[statusKey] : [];
  }, [individualRoomsByStatus, status, isLoading]);


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

      if (newStatus === 'Maintenance') {
          const maintenanceQueueRef = collection(firestore, 'maintenance-queue');
          // Check if room already exists in maintenance queue
          const existingQuery = query(maintenanceQueueRef, where('roomNumber', '==', room.roomNumber));
          const existingSnapshot = await getDocs(existingQuery);
          if (existingSnapshot.empty) {
              await addDoc(maintenanceQueueRef, {
                  roomId: room.id,
                  roomNumber: room.roomNumber,
                  reason: `Manually set from '${status}'`,
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

  if (isLoading) {
    return <CustomStatusLoading statusName={status} />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <TopHeader
            name={status}
            icon={<DynamicIcon iconName={status} className="h-10 w-10" />}
            description={`A real-time overview of all rooms with the status: ${status}.`}
        />

        {statusRooms.length === 0 ? (
          <EmptyState
            icon={() => <DynamicIcon iconName={status} className="h-10 w-10 text-muted-foreground" />}
            title={`No rooms are marked as '${status}'`}
            description="When a room's status is set to this, it will appear here."
            className="min-h-[50vh]"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {statusRooms.map((item) => (
              <IndividualRoomCard
                key={item.roomNumber}
                room={item}
                onUpdateRoomStatus={handleUpdateStatus}
                onViewBooking={setSelectedBooking}
                onBook={setWalkInRoom}
                userName={userProfile?.name}
              />
            ))}
          </div>
        )}
      </div>
      <BookingDetailsDialog
        open={!!selectedBooking}
        onOpenChange={() => setSelectedBooking(null)}
        booking={selectedBooking}
      />
       <WalkInDialog
        isOpen={!!walkInRoom}
        room={walkInRoom}
        availableRooms={allRoomsData || []}
        onClose={() => setWalkInRoom(null)}
        onSuccess={() => { reloadBookings(); reloadRoomStatus(); }}
        initialBookingType="checkin"
      />
    </>
  );
}

const StatusPageWrapper = () => {
    const { dynamicPermissionGroups, loading, userProfile } = useUser();
    const { user } = useAuth();
    const params = useParams();
    const statusFromUrl = decodeURIComponent(params.status as string);
    const status = statusFromUrl.replace(/-/g, ' ');

    const requiredPermission = React.useMemo(() => {
        if (!status) return PagePermission.VIEW_BOOKINGS_PAGE; // Default fallback
        const customGroup = dynamicPermissionGroups.find(g => g.id === 'custom_statuses');
        const sanitizedUrlStatus = sanitizeForUrl(status);
        const customPermission = customGroup?.permissions.find((p: any) => {
            const descriptionMatch = p.description.match(/"([^"]+)"/);
            if (descriptionMatch) {
                const permissionStatusName = descriptionMatch[1];
                return sanitizeForUrl(permissionStatusName) === sanitizedUrlStatus;
            }
            return false;
        });
        return customPermission?.id || PagePermission.VIEW_BOOKINGS_PAGE;
    }, [status, dynamicPermissionGroups]);

    if (loading) {
        return <CustomStatusLoading statusName={status} />;
    }

    const { permissions } = useUser();
    const isSuperAdmin = !userProfile || userProfile?.isSuperAdmin || userProfile?.role === 'Super Admin' || userProfile?.role === 'Admin';
    const canManageRoomStatus = isSuperAdmin || permissions.includes(PagePermission.MANAGE_ROOM_STATUS);
    const hasRequiredPermission = isSuperAdmin || permissions.includes(requiredPermission) || canManageRoomStatus;

    if (!hasRequiredPermission) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardTitle className="text-2xl font-bold text-destructive">Permission Denied</CardTitle>
              <CardDescription>
                Your assigned role (<span className="font-semibold">{userProfile?.role || 'Unassigned'}</span>) does not have permission to view rooms with status "{status}".
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <StatusPageContent />;
};

export default StatusPageWrapper;
