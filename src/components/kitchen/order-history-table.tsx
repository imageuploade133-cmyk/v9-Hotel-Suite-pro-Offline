
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
  orders: Order[];
  isLoading: boolean;
  onPrintReceipt: (order: Order) => void;
  currency: string;
  allBills: Bill[];
}

export function KitchenHistoryTable({ orders, isLoading, onPrintReceipt, currency, allBills }: KitchenHistoryTableProps) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const columns = React.useMemo(
    () => getKitchenHistoryColumns({ onPrintReceipt, currency, allBills }),
    [onPrintReceipt, currency, allBills]
  );

  if (isLoading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
    );
  }

  if (orders.length === 0) {
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
