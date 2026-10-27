
'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { HeldSale, StockItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, RotateCcw, Trash2, Printer, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';


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
            <h4 className="font-semibold mb-3 text-sm">Items in "{sale.name}"</h4>
            <div className="space-y-2">
                {cartItems.map((item: CartItem, index: number) => {
                   const printedQty = item.printedQuantity || 0;
                   const sellQty = Number(item.sellQuantity);
                   const needsPrinting = sellQty > printedQty;
                   return (
                    <div key={`${item.id}-${index}`} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background border">
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.sellingPrice)} ea.</p>
                        </div>
                        <div className="font-semibold text-center w-20">
                            Qty: {item.sellQuantity}
                        </div>
                        <div className="w-28 text-right font-bold">
                            {formatCurrency(item.sellingPrice * sellQty)}
                        </div>
                        <div className="w-32 text-right flex items-center justify-end gap-2">
                            <Badge variant={needsPrinting ? 'destructive' : 'success'}>
                                {printedQty}/{sellQty} Printed
                            </Badge>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onPrintItem(sale, item)} disabled={!needsPrinting}>
                                <Printer className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                   )
                })}
            </div>
            {unprintedItems.length > 1 && (
                <div className="mt-4 flex justify-end">
                    <Button variant="destructive" size="sm" onClick={() => onPrintAllUnprinted(sale)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print All Unprinted ({unprintedItems.length})
                    </Button>
                </div>
            )}
        </div>
    )
}

export const getHeldSalesColumns = ({ currency, onRestore, onDelete, onPrint, onPrintItem, onPrintAllUnprinted }: GetHeldSalesColumnsProps): ColumnDef<HeldSale>[] => {

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
              const allRows = table.getCoreRowModel().rows;
              const unprintedRows = allRows.filter(row =>
                  !(row.original.cart || []).some(item => (item.printedQuantity || 0) > 0)
              );
              if (value) {
                  table.setRowSelection(unprintedRows.reduce((acc, row) => ({...acc, [row.id]: true}), {}));
              } else {
                  table.resetRowSelection();
              }
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => {
        const hasPrintedItems = (row.original.cart || []).some(item => (item.printedQuantity || 0) > 0);

        const checkbox = (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              disabled={hasPrintedItems}
            />
        );

        if (hasPrintedItems) {
          return (

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-full items-center">{checkbox}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cannot select a sale with printed items for bulk deletion.</p>
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
        <div className="font-medium flex items-center gap-2">
          {row.original.name}
          {row.original.isCreditSale && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Credit
            </Badge>
          )}
        </div>
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
      accessorFn: row => (row.cart || []).reduce((sum, item) => sum + (item.sellingPrice * Number(item.sellQuantity)), 0),
      cell: ({ row }) => {
        const total = (row.original.cart || []).reduce((sum, item) => sum + (item.sellingPrice * Number(item.sellQuantity)), 0);
        return <div className="text-right font-semibold">{formatCurrency(total)}</div>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const sale = row.original;
        const hasPrintedItems = (sale.cart || []).some(item => (item.printedQuantity || 0) > 0);

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRestore(sale)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restore
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPrint(sale)}>
                  <Printer className="mr-2 h-4 w-4" /> Print Full Docket
                </DropdownMenuItem>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                          <DropdownMenuItem
                            onSelect={(e) => {
                              if (hasPrintedItems) e.preventDefault();
                              else onDelete(sale);
                            }}
                            disabled={hasPrintedItems}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                      </div>
                    </TooltipTrigger>
                     {hasPrintedItems && (
                      <TooltipContent>
                        <p className="flex items-center gap-2">
                           <Info className="h-4 w-4" /> Cannot delete a sale with printed items.
                        </p>
                      </TooltipContent>
                     )}
                  </Tooltip>

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
};
