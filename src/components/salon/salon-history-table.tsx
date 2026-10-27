
'use client';

import * as React from 'react';
import type { SalonService, UserProfile } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getSalonHistoryColumns } from './salon-history-columns';
import { EmptyState } from '@/components/ui/empty-state';
import { History } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';
import { RowSelectionState } from '@tanstack/react-table';

interface SalonHistoryTableProps {
  data: SalonService[];
  isLoading: boolean;
  onPrintReceipt: (order: SalonService) => void;
  onActions: (order: SalonService) => void;
}

export function SalonHistoryTable({ data, isLoading, onPrintReceipt, onActions }: SalonHistoryTableProps) {
  const firestore = useFirestore();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(u => [u.uid, u]));
  }, [users]);

  const columns = React.useMemo(
    () => getSalonHistoryColumns({ onPrintReceipt, userMap, currency, onActions }),
    [onPrintReceipt, userMap, currency, onActions]
  );

  if (isLoading || areUsersLoading) {
      return (
          <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
          </div>
      );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No Service History"
        description="Completed services will appear here."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      filterColumn="customerName"
      filterPlaceholder="Filter by customer name or room..."
      tableId="salon-history"
      isPaginated
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
    />
  );
}
