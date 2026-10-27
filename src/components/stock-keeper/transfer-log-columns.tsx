
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ArrowUpDown, Printer, Undo2, TrendingUp } from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import type { TransferLog } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';

type GetColumnsProps = {
  currency: string;
  onPrintReceipt?: (log: TransferLog) => void;
  onReverse?: (log: TransferLog) => void;
  onViewSales?: (log: TransferLog) => void;
};

export const getTransferReportColumns = ({ currency, onViewSales, onPrintReceipt, onReverse }: GetColumnsProps): ColumnDef<TransferLog>[] => {

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
        id: 'details',
        header: 'Transfer Details',
        cell: ({ row }) => {
            const log = row.original;
            const date = getSafeDate(log.transferredAt);
            return (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{date ? format(date, 'PPp') : 'N/A'}</span>
                    <span className="text-xs text-muted-foreground">ID: {log.id.substring(0, 8)}...</span>
                </div>
            )
        }
    },
    {
      accessorKey: 'transferredBy',
      header: 'Transferred By',
    },
    {
        id: 'items',
        header: 'Items Breakdown',
        cell: ({ row }) => {
            const log = row.original;
            const displayedItems = log.items.slice(0, 3);
            const remainingCount = log.items.length - 3;
            return (
                <div className="text-xs space-y-1">
                    {displayedItems.map((item, index) => (
                        <div key={`${item.id}-${index}`} className="flex justify-between">
                            <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
                            <span className="font-medium">x{item.quantity}</span>
                        </div>
                    ))}
                    {remainingCount > 0 && <span className="text-xs text-muted-foreground">...and {remainingCount} more.</span>}
                </div>
            )
        }
    },
    {
        accessorKey: 'totalValue',
        header: 'Total Cost',
        cell: ({ row }) => <div className="font-semibold">{formatCurrency(row.original.totalValue)}</div>
    },
    {
        accessorKey: 'valueSold',
        header: 'Value Sold (Cost)',
        cell: ({ row }) => <div className="text-green-600 font-semibold">{formatCurrency(row.original.valueSold || 0)}</div>
    },
    {
        accessorKey: 'remainingValue',
        header: 'Remaining Value',
        cell: ({ row }) => <div className="text-yellow-600 font-semibold">{formatCurrency(row.original.remainingValue || 0)}</div>
    },
    {
        id: 'sellThrough',
        header: 'Sell-Through Rate',
        cell: ({ row }) => {
            const log = row.original;
            const rate = log.totalValue > 0 ? ((log.valueSold || 0) / log.totalValue) * 100 : 0;
            return (
                <div className="flex items-center gap-2">
                    <Progress value={rate} className="w-24 h-2" indicatorClassName="bg-green-500" />
                    <span className="text-xs font-semibold">{rate.toFixed(1)}%</span>
                </div>
            )
        }
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.status;
            let variant: 'success' | 'warning' | 'destructive' | 'secondary' = 'success';
            if (status === 'Reversed') variant = 'destructive';
            if (status === 'Partially Reversed') variant = 'warning';

            return <Badge variant={variant}>{status || 'Completed'}</Badge>;
        }
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <div className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {onViewSales && (
                            <DropdownMenuItem onClick={() => onViewSales(row.original)}>
                                <TrendingUp className="mr-2 h-4 w-4"/> View Sales
                            </DropdownMenuItem>
                        )}
                        {onPrintReceipt && (
                            <DropdownMenuItem onClick={() => onPrintReceipt(row.original)}>
                                <Printer className="mr-2 h-4 w-4"/> Print Receipt
                            </DropdownMenuItem>
                        )}
                        {onReverse && (
                            <DropdownMenuItem onClick={() => onReverse(row.original)} className="text-destructive">
                                <Undo2 className="mr-2 h-4 w-4"/> Reverse Transfer
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )
    }
];
};
