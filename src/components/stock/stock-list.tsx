
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StockItem } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getStockColumns } from './stock-columns';
import { BulkStockActions } from './bulk-stock-actions';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Package, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';

interface StockListProps {
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  reloadCounter: number;
  stockCollection?: string;
  globalData?: StockItem[]; // Pre-fetched global data from useGlobalCollectionData
  globalLoading?: boolean; // Loading state for global data
}

const TABLE_ID = 'stock_management';

export function StockList({ onEdit, onDelete, reloadCounter, stockCollection = 'stock', globalData, globalLoading }: StockListProps) {
  const firestore = useFirestore();
  const { getCollectionPath, isGlobalMode } = useBranch();
  const { settings } = useSettings();

  // Query from the current branch (only used if globalData not provided)
  const stockQuery = useMemoFirebase(() => {
    if (!firestore || globalData !== undefined) return null;
    const collectionPath = getCollectionPath(stockCollection);
    return query(collection(firestore, collectionPath), orderBy('name', 'asc'));
  }, [firestore, reloadCounter, stockCollection, getCollectionPath, globalData]);

  const { data: branchStockItems, isLoading: branchLoading } = useCollection<StockItem>(stockQuery);

  // Use either global data or branch data
  const stockItems = globalData !== undefined ? globalData : (branchStockItems || []);
  const isLoading = globalLoading !== undefined ? globalLoading : branchLoading;

  const columns = React.useMemo(
    () => getStockColumns({ onEdit, onDelete, settings }),
    [onEdit, onDelete, settings]
  );

  if (isLoading) {
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

  if (!stockItems || stockItems.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No Stock Items Found"
        description="You haven't added any items to your inventory yet. Add one to get started."
        className="h-full"
      >
        <Button onClick={() => onEdit(null as any)} className="mt-4">
          <Plus className="mr-2 h-4 w-4" /> Add New Item
        </Button>
      </EmptyState>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={stockItems}
      filterColumn="name"
      filterPlaceholder="Filter by item name..."
      tableId={TABLE_ID}
      isPaginated
    />
  );
}
