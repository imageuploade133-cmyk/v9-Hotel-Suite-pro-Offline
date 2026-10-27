'use client';

import * as React from 'react';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

interface BulkStockActionsProps<TData> {
  table: Table<TData>;
}

export function BulkStockActions<TData>({
  table,
}: BulkStockActionsProps<TData>) {
  const numSelected = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[100px] text-sm font-medium text-muted-foreground">
        {numSelected > 0 ? `${numSelected} selected` : 'Select items'}
      </span>
      {/* Bulk actions can be added here if needed */}
    </div>
  );
}
