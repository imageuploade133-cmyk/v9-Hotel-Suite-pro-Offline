'use client';

import * as React from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useBranch } from '@/contexts/branch-context';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { getColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Truck, Plus } from 'lucide-react';
import type { StockSupplier, StockItem } from '@/lib/types';
import { Button } from '../ui/button';

interface SupplierListProps {
  onEdit: (supplier: StockSupplier) => void;
  onDelete: (supplier: StockSupplier) => void;
  reloadCounter: number;
}

const TABLE_ID = 'suppliers';

export function SupplierList({ onEdit, onDelete, reloadCounter }: SupplierListProps) {
  const firestore = useFirestore();
  const { getCollectionPath, isGlobalMode } = useBranch();

  const suppliersConstraints = React.useMemo(() => [orderBy('name')], []);

  // Branch mode queries
  const branchSuppliersQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('suppliers')), ...suppliersConstraints) : null, [firestore, isGlobalMode, getCollectionPath, suppliersConstraints]);
  const branchStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock'))) : null, [firestore, isGlobalMode, getCollectionPath]);

  const branchSuppliersResult = useCollection<StockSupplier>(branchSuppliersQuery);
  const branchStockResult = useCollection<StockItem>(branchStockQuery);

  // Global mode queries
  const globalSuppliersResult = useGlobalCollectionData<StockSupplier>('suppliers', suppliersConstraints);
  const globalStockResult = useGlobalCollectionData<StockItem>('stock', []);

  // Use appropriate result based on mode
  const { data: suppliers, isLoading: areSuppliersLoading } = isGlobalMode ? globalSuppliersResult : branchSuppliersResult;
  const { data: stockItems, isLoading: areStockItemsLoading } = isGlobalMode ? globalStockResult : branchStockResult;

  const suppliersWithItemCount = React.useMemo(() => {
    if (!suppliers || !stockItems) return [];

    const itemCounts = new Map<string, number>();
    stockItems.forEach(item => {
        // Assuming supplier is stored by name. If it's by ID, this logic needs adjustment.
        if (item.supplierId) {
            const supplierName = suppliers.find(s => s.id === item.supplierId)?.name;
            if (supplierName) {
                itemCounts.set(supplierName, (itemCounts.get(supplierName) || 0) + 1);
            }
        }
    });

    return suppliers.map(supplier => ({
        ...supplier,
        itemCount: itemCounts.get(supplier.name) || 0,
    }));
  }, [suppliers, stockItems]);


  const columns = React.useMemo(() => getColumns({ onEdit, onDelete }), [onEdit, onDelete]);

  const isLoading = areSuppliersLoading || areStockItemsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suppliersWithItemCount || suppliersWithItemCount.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No Suppliers Found"
        description="You haven't added any suppliers yet. Get started by creating one."
        className="h-full"
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={suppliersWithItemCount}
      filterColumn="name"
      filterPlaceholder="Filter by supplier name..."
      tableId={TABLE_ID}
      isPaginated
    />
  );
}
