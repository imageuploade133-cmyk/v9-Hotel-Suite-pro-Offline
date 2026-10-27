'use client';

import * as React from 'react';
import type { LaundryOrder, Bill } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getLaundryHistoryColumns } from './laundry-history-columns';
import { EmptyState } from '@/components/ui/empty-state';
import { History } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, QueryConstraint, Timestamp } from 'firebase/firestore';
import type { DateRange } from 'react-day-picker';
import { Skeleton } from '../ui/skeleton';
import { RowSelectionState } from '@tanstack/react-table';

interface LaundryHistoryTableProps {
  dateRange?: DateRange;
  staffId: string;
  onPrintReceipt: (order: LaundryOrder) => void;
  currency: string;
  allBills: Bill[];
}

export function LaundryHistoryTable({ dateRange, staffId, onPrintReceipt, currency, allBills }: LaundryHistoryTableProps) {
  const firestore = useFirestore();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});


  const historyQuery = React.useMemo(() => {
    if (!firestore) return null;

    const constraints: QueryConstraint[] = [
      where('status', 'in', ['Completed', 'Delivered']),
      orderBy('createdAt', 'desc')
    ];

    if (dateRange?.from) constraints.push(where('createdAt', '>=', Timestamp.fromDate(dateRange.from)));
    if (dateRange?.to) constraints.push(where('createdAt', '<=', Timestamp.fromDate(dateRange.to)));
    if (staffId !== 'all') constraints.push(where('staffId', '==', staffId));

    return query(collection(firestore, 'laundry'), ...constraints);
  }, [firestore, dateRange, staffId]);

  const { data: orders, isLoading: areOrdersLoading } = useCollection<LaundryOrder>(historyQuery);

  const columns = React.useMemo(
    () => getLaundryHistoryColumns({ onPrintReceipt, currency, allBills }),
    [onPrintReceipt, currency, allBills]
  );

  if (areOrdersLoading) {
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
        description="Completed and delivered laundry orders will appear here."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={orders}
      filterColumn="guestName"
      filterPlaceholder="Filter by guest or room..."
      tableId="laundry-history"
      isPaginated
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
    />
  );
}
