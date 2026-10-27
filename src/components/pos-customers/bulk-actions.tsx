
'use client';

import * as React from 'react';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, MessageSquareText } from 'lucide-react';
import type { Customer } from '@/lib/types';

interface BulkActionsProps<TData> {
  table: Table<TData>;
  onBulkDelete: (items: TData[]) => void;
  onBulkEdit: (items: TData[]) => void;
  onBulkMessage?: (items: TData[]) => void;
}

export function BulkActions<TData>({
  table,
  onBulkDelete,
  onBulkEdit,
  onBulkMessage,
}: BulkActionsProps<TData>) {
  if (!table || typeof table.getFilteredSelectedRowModel !== 'function') {
    return <div className="h-8" />; // Render nothing or a placeholder if table is not ready
  }

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

  const handleBulkMessage = () => {
    if (!onBulkMessage) return;
    const selectedData = selectedRows.map((row) => row.original as Customer);
    onBulkMessage(selectedData);
  };

  const areActionsDisabled = numSelected < 2;

  return (
    <div className="flex items-center gap-3">
        <span className="min-w-[100px] text-sm font-medium text-muted-foreground">
            {numSelected > 0
                ? `${numSelected} selected`
                : "Select items"
            }
        </span>
        {onBulkMessage && (
            <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleBulkMessage}
                disabled={numSelected === 0}
            >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Bulk Message
            </Button>
        )}
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
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={handleBulkDelete}
            disabled={numSelected === 0}
        >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
        </Button>
    </div>
  );
}
