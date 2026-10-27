'use client';

import * as React from 'react';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

interface BulkActionsProps<TData> {
  table: Table<TData>;
  onBulkDelete: (items: TData[]) => void;
  onBulkEdit: (items: TData[]) => void;
}

export function BulkActions<TData>({
  table,
  onBulkDelete,
  onBulkEdit,
}: BulkActionsProps<TData>) {
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const numSelected = selectedRows.length;

  const handleBulkDelete = () => {
    const selectedData = selectedRows.map((row) => row.original);
    onBulkDelete(selectedData);
  };

  const handleBulkEdit = () => {
    const selectedData = selectedRows.map((row) => row.original);
    onBulkEdit(selectedData);
  };

  const areActionsDisabled = numSelected < 2;

  return (
    <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
            {numSelected > 0
                ? `${numSelected} selected`
                : "Select items"
            }
        </span>
        <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleBulkEdit}
            disabled={areActionsDisabled}
        >
            <Edit className="mr-2 h-4 w-4" />
            Edit Selected
        </Button>
        <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:text-destructive/50 disabled:bg-transparent"
            onClick={handleBulkDelete}
            disabled={areActionsDisabled}
        >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
        </Button>
    </div>
  );
}
