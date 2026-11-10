
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { HeldSale, StockItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ChevronDown, ChevronRight, Bell, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Checkbox } from '../ui/checkbox';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Animation styles for row updates
const rowAnimation = `
  @keyframes row-pulse {
    0%, 100% {
      background-color: transparent;
    }
    50% {
      background-color: rgba(59, 130, 246, 0.1);
    }
  }
  @keyframes badge-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;


interface CartItem extends StockItem {
  sellQuantity: number;
  printedQuantity?: number;
  name: string;
  sellingPrice: number;
}

interface GetHeldSalesColumnsProps {
  currency: string;
  onRestore: (sale: HeldSale) => void;
  onDelete: (sale: HeldSale) => void;
  onPrint: (sale: HeldSale) => void;
  onPrintItem: (sale: HeldSale, item: CartItem) => void;
  onPrintAllUnprinted: (sale: HeldSale) => void;
  onOpenActions?: (sale: HeldSale) => void;
}

interface RenderSubComponentProps {
    row: any;
    currency: string;
    onPrintItem: (sale: HeldSale, item: CartItem) => void;
    onPrintAllUnprinted: (sale: HeldSale) => void;
}


export const renderHeldSaleSubComponent = ({ row, currency, onPrintItem, onPrintAllUnprinted }: RenderSubComponentProps) => {
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
    const sale = row.original as HeldSale;
    const cartItems = sale.cart || [];
    const unprintedItems = cartItems.filter(item => Number(item.sellQuantity || 0) > Number(item.printedQuantity || 0));
    const totalQuantity = cartItems.reduce((sum, item) => sum + Number(item.sellQuantity || 0), 0);
    const pendingQuantity = unprintedItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item.sellQuantity || 0) - Number(item.printedQuantity || 0)),
      0
    );

    return (
      <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-muted/30 p-3 sm:p-5">
        <style>{rowAnimation}</style>

        <div className="mb-4 flex min-w-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-primary shadow-sm">
              <Printer className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h4 className="truncate text-sm font-semibold sm:text-base">{sale.name}</h4>
                <Badge variant="outline" className="shrink-0">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Review docket items and print any quantities that are still pending
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total quantity</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{totalQuantity}</p>
            </div>
            <div className={cn("rounded-lg border px-3 py-2", pendingQuantity > 0 ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30" : "bg-background")}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pending print</p>
              <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", pendingQuantity > 0 && "text-amber-700 dark:text-amber-300")}>{pendingQuantity}</p>
            </div>
          </div>
        </div>

        {cartItems.length > 0 ? (
          <div className="space-y-2">
            {cartItems.map((item: CartItem, index: number) => {
              const printedQty = Math.max(0, Number(item.printedQuantity || 0));
              const sellQty = Math.max(0, Number(item.sellQuantity || 0));
              const remainingQty = Math.max(0, sellQty - printedQty);
              const needsPrinting = remainingQty > 0;
              const unitPrice = Number(item.price || item.sellingPrice || 0);
              return (
                <motion.div
                  key={`${item.id || item.name}-${index}`}
                  className={cn(
                    "grid min-w-0 grid-cols-1 gap-3 rounded-lg border bg-background p-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4",
                    needsPrinting && "border-l-4 border-l-amber-400"
                  )}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.035, 0.2) }}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(unitPrice)} <span aria-hidden="true">/</span> unit</p>
                    </div>
                    <div className="shrink-0 text-right sm:hidden">
                      <p className="text-[10px] text-muted-foreground">Line total</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(unitPrice * sellQty)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:min-w-[7.5rem] sm:flex-col sm:items-end sm:justify-center">
                    <div className="text-xs text-muted-foreground">
                      Qty <span className="ml-1 font-semibold text-foreground tabular-nums">{sellQty}</span>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-[10px] text-muted-foreground">Line total</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(unitPrice * sellQty)}</p>
                    </div>
                    <Badge
                      variant={needsPrinting ? 'outline' : 'success'}
                      className={cn(
                        "whitespace-nowrap",
                        needsPrinting
                          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                      )}
                    >
                      {needsPrinting ? `${remainingQty} pending` : 'Fully printed'}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground sm:text-right">{printedQty} of {sellQty} printed</p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={needsPrinting ? "outline" : "ghost"}
                    className="h-9 w-full gap-2 sm:w-auto"
                    onClick={() => onPrintItem(sale, item)}
                    disabled={!needsPrinting}
                    aria-label={`Print ${item.name}`}
                  >
                    <Printer className="h-4 w-4" />
                    {needsPrinting ? "Print item" : "Printed"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-background px-4 py-8 text-center">
            <p className="text-sm font-medium">No items in this running table</p>
            <p className="mt-1 text-xs text-muted-foreground">Items added to this table will appear here</p>
          </div>
        )}

        {unprintedItems.length > 0 && (
          <motion.div
            className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {pendingQuantity} {pendingQuantity === 1 ? 'quantity' : 'quantities'} waiting to print
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
                Print all remaining docket items for this table
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-10 w-full shrink-0 gap-2 sm:w-auto"
              onClick={() => onPrintAllUnprinted(sale)}
            >
              <Printer className="h-4 w-4" />
              Print all unprinted ({unprintedItems.length})
            </Button>
          </motion.div>
        )}

        {cartItems.length > 0 && unprintedItems.length === 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
            <Badge variant="success" className="shrink-0">Complete</Badge>
            All docket quantities have been printed
          </div>
        )}
      </div>
    );
};

export const getHeldSalesColumns = ({ currency, onRestore, onDelete, onPrint, onPrintItem, onPrintAllUnprinted, onOpenActions }: GetHeldSalesColumnsProps): ColumnDef<HeldSale>[] => {

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => {
              const allRows = table.getFilteredRowModel().rows; // Use filtered rows
              const unprintedRows = allRows.filter(row =>
                  !(row.original.cart || []).some(item => (item.printedQuantity || 0) > 0) &&
                  !row.original.linkedBillId
              );
              const newSelection = unprintedRows.reduce((acc, row) => ({...acc, [row.id]: true}), {});
              table.setRowSelection(value ? newSelection : {});
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => {
        const hasPrintedItems = (row.original.cart || []).some(item => (item.printedQuantity || 0) > 0);
        const isBilledToRoom = !!row.original.linkedBillId;
        const isDisabled = hasPrintedItems || isBilledToRoom;

        const checkbox = (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              disabled={isDisabled}
            />
        );

        if (isDisabled) {
          const tooltipContent = isBilledToRoom
            ? "Cannot select a sale that has been billed to a room."
            : "Cannot select a sale with printed items for bulk deletion.";
          return (

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-full items-center">{checkbox}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltipContent}</p>
                </TooltipContent>
              </Tooltip>

          );
        }

        return checkbox;
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            size="icon"
            onClick={row.getToggleExpandedHandler()}
            className="h-8 w-8"
          >
            {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        );
      },
    },
    {
      id: 'name',
      accessorFn: (sale) => [
        sale.name,
        sale.customer?.name,
        sale.customer?.id,
        sale.heldByName,
        sale.heldByUid,
        sale.linkedBillId,
        ...(sale.cart || []).map(item => item.name),
      ].filter(Boolean).join(' '),
      header: 'Table Name',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      ),
    },
    {
      accessorKey: 'heldAt',
      header: 'Date Started',
      cell: ({ row }) => {
        const date = getSafeDate(row.original.heldAt);
        return date ? format(date, 'PPpp') : 'N/A';
      }
    },
    {
      accessorKey: 'heldByName',
      header: 'Started By',
      cell: ({ row }) => <Badge>{row.original.heldByName}</Badge>,
    },
    {
      accessorKey: 'customer.name',
      header: 'Customer',
      cell: ({ row }) => row.original.customer?.name || 'Walk-in Customer',
    },
    {
        id: 'totalItems',
        header: 'Total Items',
        accessorFn: row => (row.cart || []).reduce((sum, item) => sum + Number(item.sellQuantity), 0),
        cell: ({ row }) => <div className="text-center">{(row.original.cart || []).reduce((sum, item) => sum + Number(item.sellQuantity), 0)}</div>,
    },
    {
      id: 'totalAmount',
      header: () => <div className="text-right">Total Amount</div>,
      accessorFn: row => (row.cart || []).reduce((sum, item) => sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0),
      cell: ({ row }) => {
        const total = (row.original.cart || []).reduce((sum, item) => sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0);
        return <div className="text-right font-semibold">{formatCurrency(total)}</div>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <div className="text-right">
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => onOpenActions?.(sale)}>
                <span className="sr-only">Open actions</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
};
