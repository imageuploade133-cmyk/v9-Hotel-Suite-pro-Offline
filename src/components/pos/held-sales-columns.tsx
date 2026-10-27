
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
    const cartItems = sale.cart || []; // Safely default to an empty array

    const unprintedItems = cartItems.filter(item => (item.printedQuantity || 0) < item.sellQuantity);

    return (
        <div className="p-4 bg-muted/50">
            <style>{rowAnimation}</style>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">Items in "{sale.name}"</h4>
              {unprintedItems.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
                  <Bell className="h-3 w-3 mr-1" />
                  {unprintedItems.length} Unprinted
                </Badge>
              )}
            </div>
            <div className="space-y-2">
                {cartItems.map((item: CartItem, index: number) => {
                   const printedQty = item.printedQuantity || 0;
                   const sellQty = Number(item.sellQuantity);
                   const needsPrinting = sellQty > printedQty;
                   return (
                    <motion.div
                      key={`${item.id}-${index}`}
                      className={cn(
                        "flex items-center justify-between gap-2 p-2 rounded-md bg-background border transition-all",
                        needsPrinting && "border-blue-300 dark:border-blue-700"
                      )}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.price || item.sellingPrice)} ea.</p>
                        </div>
                        <div className="font-semibold text-center w-20">
                            Qty: {item.sellQuantity}
                        </div>
                        <div className="w-28 text-right font-bold">
                            {formatCurrency((item.price || item.sellingPrice) * sellQty)}
                        </div>
                        <div className="w-32 text-right flex items-center justify-end gap-2">
                            <motion.div
                              animate={needsPrinting ? { scale: [1, 1.05, 1] } : {}}
                              transition={{ duration: 1.5, repeat: needsPrinting ? Infinity : 0, repeatDelay: 1 }}
                            >
                              <Badge variant={needsPrinting ? 'destructive' : 'success'} className={cn(needsPrinting && "animate-pulse")}>
                                  {printedQty} Printed, {sellQty - printedQty} Unprinted
                              </Badge>
                            </motion.div>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onPrintItem(sale, item)} disabled={!needsPrinting}>
                                <Printer className="h-3 w-3" />
                            </Button>
                        </div>
                    </motion.div>
                   )
                })}
            </div>
            {unprintedItems.length > 1 && (
                <motion.div
                  className="mt-4 flex justify-end"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                    <Button variant="destructive" size="sm" onClick={() => onPrintAllUnprinted(sale)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print All Unprinted ({unprintedItems.length})
                    </Button>
                </motion.div>
            )}
        </div>
    )
}

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
      accessorKey: 'name',
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
