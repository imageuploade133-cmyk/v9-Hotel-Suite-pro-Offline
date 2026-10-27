
'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Wrench } from 'lucide-react';
import type { Room } from '@/lib/types';
import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { DynamicIcon } from '../ui/dynamic-icon';
import { useUser } from '@/contexts/user-context';

interface RoomStatusUpdaterProps {
  room: Room & { roomNumber: string; status: string };
  onUpdateStatus: (room: { id: string; roomNumber: string }, newStatus: string) => Promise<void>;
  excludeStatuses?: string[];
}

export function RoomStatusUpdater({
  room = {} as any,
  onUpdateStatus,
  excludeStatuses = [],
}: RoomStatusUpdaterProps) {
  const [currentStatus, setCurrentStatus] = useState(room.status || 'Vacant');
  const [isUpdating, setIsUpdating] = useState(false);
  const firestore = useFirestore();
  const { userProfile } = useUser();

  useEffect(() => {
    setCurrentStatus(room.status || 'Vacant');
  }, [room.status]);

  const roomStatusesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomStatuses'));
  }, [firestore]);
  const { data: roomStatuses } = useCollection(roomStatusesQuery);

  const availableStatuses = useMemo(() => {
    const dbStatusNames = roomStatuses?.map((s: any) => s.name) || [];
    // Ensure 'Vacant' is always an option as it's a critical system status.
    const allStatuses = new Set(['Vacant', 'Cleaning in Progress', 'Maintenance', 'Do Not Disturb', 'Inspection', ...dbStatusNames]);
    return Array.from(allStatuses);
  }, [roomStatuses]);

  const handleSelect = async (status: string) => {
    setIsUpdating(true);
    try {
        if (status === 'Maintenance' && firestore) {
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
        await onUpdateStatus(room, status);
    } catch(error) {
        // Error is handled by parent component's toast
    } finally {
        setIsUpdating(false);
    }
  };

  const otherStatuses = useMemo(
    () => availableStatuses.filter(s => s !== currentStatus && !excludeStatuses.includes(s)),
    [currentStatus, availableStatuses, excludeStatuses]
  );

  const getIconForStatus = (status: string) => {
    const statusInfo = (roomStatuses as any[])?.find(s => s.name === status);
    return <DynamicIcon iconName={statusInfo?.iconName || status} className="h-4 w-4" />;
  }

  return (
    <div className="flex w-full items-center gap-1 rounded-md border bg-background">
      <div className="flex flex-1 items-center gap-2 px-3 py-2 text-sm">
        {getIconForStatus(currentStatus)}
        <span>{currentStatus}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-full rounded-l-none border-l"
            disabled={isUpdating}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {otherStatuses.map(status => (
            <DropdownMenuItem
              key={status}
              onSelect={() => handleSelect(status)}
              className="flex items-center gap-2"
              disabled={isUpdating}
            >
              {getIconForStatus(status)}
              Mark as {status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
