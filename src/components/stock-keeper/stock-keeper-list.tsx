

'use client';

import * as React from 'react';
import type { StockItem } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getStockKeeperColumns } from './stock-keeper-columns';
import { EmptyState } from '../ui/empty-state';
import { Archive, Send, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { useSettings } from '@/contexts/settings-context';
import type { RowSelectionState } from '@tanstack/react-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StockKeeperListProps {
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  onTransfer: (items: StockItem[]) => void;
  onTransferToBranch: (items: StockItem[]) => void;
  stockItems: StockItem[];
  isLoading: boolean;
  searchTerm: string;
}

const TABLE_ID = 'stock-keeper';

export function StockKeeperList({ onEdit, onDelete, onTransfer, onTransferToBranch, stockItems, isLoading, searchTerm }: StockKeeperListProps) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { hasPermission } = usePermissions();

  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const globalStockImageUrl = settings?.globalStockImageUrl;
  const useGlobalStockImage = settings?.useGlobalStockImage;

  const canManage = hasPermission(PagePermission.MANAGE_STOCK_ITEMS);
  const canTransfer = hasPermission(PagePermission.TRANSFER_STOCK) || canManage;
  const canTransferToBranch = hasPermission(PagePermission.TRANSFER_STOCK_TO_BRANCH) || canManage;

  const filteredItems = React.useMemo(() => {
    if (!stockItems) return [];
    if (!searchTerm) return stockItems;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return stockItems.filter(item =>
      item.name.toLowerCase().includes(lowerCaseSearch) ||
      (item.barcode && item.barcode.toLowerCase().includes(lowerCaseSearch))
    );
  }, [stockItems, searchTerm]);

  const columns = React.useMemo(
    () => getStockKeeperColumns({
      onEdit,
      onDelete,
      onTransfer,
      onTransferToBranch,
      currency,
      globalStockImageUrl,
      useGlobalStockImage,
      canManage,
      canTransfer,
      canTransferToBranch
    }),
    [onEdit, onDelete, onTransfer, onTransferToBranch, currency, globalStockImageUrl, useGlobalStockImage, canManage, canTransfer, canTransferToBranch]
  );

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

  if (!filteredItems || filteredItems.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title={searchTerm ? "No Items Found" : "Staging Area is Empty"}
        description={searchTerm ? "No items match your search term." : "Add items to the staging area to see them here."}
        className="h-full"
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={filteredItems}
      tableId={TABLE_ID}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      filterColumn="name"
    >
      {(table) => (
        <div className="flex items-center gap-2">
          {canTransfer && (
              <Button
              size="sm"
              disabled={table.getFilteredSelectedRowModel().rows.length === 0}
              onClick={() => onTransfer(table.getFilteredSelectedRowModel().rows.map(row => row.original))}
              >
              <Send className="mr-2 h-4 w-4" />
              Transfer to Inventory ({table.getFilteredSelectedRowModel().rows.length})
              </Button>
          )}
          {canTransferToBranch && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Transfer to Branch ({table.getFilteredSelectedRowModel().rows.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => onTransferToBranch(table.getFilteredSelectedRowModel().rows.map(row => row.original))}
                  className="text-primary"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Transfer to Another Branch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </DataTable>
  );
}
