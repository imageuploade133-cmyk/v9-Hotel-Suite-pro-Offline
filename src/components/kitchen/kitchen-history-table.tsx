
'use client';

import * as React from 'react';
import type { Order, Bill } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getKitchenHistoryColumns } from './order-history-columns';
import { EmptyState } from '@/components/ui/empty-state';
import { History } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, QueryConstraint, Timestamp } from 'firebase/firestore';
import type { DateRange } from 'react-day-picker';
import { Skeleton } from '../ui/skeleton';
import { RowSelectionState } from '@tanstack/react-table';
import { useSettings } from '@/contexts/settings-context';

interface KitchenHistoryTableProps {
  onPrintReceipt: (order: Order) => void;
  allBills: Bill[];
}

export function KitchenHistoryTable({ onPrintReceipt, allBills }: KitchenHistoryTableProps) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const firestore = useFirestore();

  const historyQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', 'in', ['Completed', 'Billed']),
        orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(historyQuery);

  const columns = React.useMemo(
    () => getKitchenHistoryColumns({ onPrintReceipt, currency, allBills }),
    [onPrintReceipt, currency, allBills]
  );

  const isLoading = areOrdersLoading;

  if (isLoading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No Order History"
        description="Completed and billed orders will appear here."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={orders}
      filterColumn="guestName"
      filterPlaceholder="Filter by guest or room..."
      tableId="kitchen-history"
      isPaginated
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
    />
  );
}
