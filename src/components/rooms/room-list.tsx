'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy as firestoreOrderBy,
  getDocs,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { getColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Bed, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Room, Payment } from '@/lib/types';
import { BulkActions } from './bulk-actions';
import { useSettings } from '@/contexts/settings-context';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';

const PAGE_SIZE = 10;
const TABLE_ID = 'rooms';

interface RoomListProps {
  onAddRoom: () => void;
  onViewRoom: (room: Room) => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onBulkDelete: (rooms: Room[]) => void;
  onBulkEdit: (rooms: Room[]) => void;
  onResetInventory: (room: Room) => void;
  setAllRooms: (rooms: Room[]) => void;
  onUpdateRoomStatus: (room: Room, status: string) => void;
  rooms: Room[];
  isLoading: boolean;
  bills: any[];
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

export function RoomList({
  onAddRoom,
  onViewRoom,
  onEditRoom,
  onDeleteRoom,
  onBulkDelete,
  onBulkEdit,
  onResetInventory,
  setAllRooms,
  onUpdateRoomStatus,
  rooms,
  isLoading,
  bills,
}: RoomListProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const [firstVisible, setFirstVisible] =
    React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] =
    React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !user) return;
    const configDocId = `${user.uid}_${TABLE_ID}`;
    const configDocRef = doc(firestore, 'table-configurations', configDocId);

    getDoc(configDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        setColumnVisibility(docSnap.data().visibility || {});
      }
    });
  }, [firestore, user]);

  const handleColumnVisibilityChange = async (updater: React.SetStateAction<VisibilityState>) => {
    if (!firestore || !user) return;

    const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
    setColumnVisibility(newVisibility);

    const configDocId = `${user.uid}_${TABLE_ID}`;
    const configDocRef = doc(firestore, 'table-configurations', configDocId);
    try {
      await setDoc(configDocRef, { visibility: newVisibility }, { merge: true });
    } catch (error) {
      console.error("Failed to save column visibility:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save column preferences.',
      });
    }
  };

  const handleNextPage = () => {
    if (!hasMore) return;
    // This would trigger a re-fetch in a paginated setup
  };

  const handlePrevPage = () => {
    if (page <= 1) return;
    // This would trigger a re-fetch in a paginated setup
  };

  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';

  const roomsWithTotals = React.useMemo(() => {
    return rooms.map(room => {
      const roomPayments = allPayments.filter(p => p.bookingDetails?.roomId === room.id);
      const totalSpent = roomPayments.reduce((sum, p) => sum + p.amount, 0);
      return { ...room, totalSpent };
    })
  }, [rooms, allPayments])

  const columns = React.useMemo(
    () => getColumns(onViewRoom, onEditRoom, onDeleteRoom, onResetInventory, userCurrency, onUpdateRoomStatus),
    [onViewRoom, onEditRoom, onDeleteRoom, onResetInventory, userCurrency, onUpdateRoomStatus]
  );

  const isDataLoading = isLoading;

  if (isDataLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!roomsWithTotals || roomsWithTotals.length === 0) {
    return (
      <EmptyState
        icon={Bed}
        title="No Rooms Found"
        description="You haven't added any rooms yet. Get started by creating your first one."
        className="h-full"
      >
        <Button onClick={onAddRoom} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Add New Room
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DataTable
        columns={columns}
        data={roomsWithTotals}
        filterColumn="name"
        filterPlaceholder="Filter rooms by name..."
        tableId={TABLE_ID}
        isPaginated={false}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      >
        {table => (
          <BulkActions
            table={table}
            onBulkDelete={onBulkDelete}
            onBulkEdit={onBulkEdit}
          />
        )}
      </DataTable>
       <div className="mt-auto flex items-center justify-end px-4 py-4 border-t">
        <PaginationControls
          canPrev={page > 1}
          canNext={hasMore}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
        />
      </div>
    </div>
  );
}
