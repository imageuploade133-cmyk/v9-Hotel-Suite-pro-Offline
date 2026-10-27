
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '../ui/input';
import { useSettings } from '@/contexts/settings-context';
import { EmptyState } from '../ui/empty-state';
import { BookUser } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import type { ProcessedFolioData } from '@/app/(protected)/guest-folio/page';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { DataTable } from '../ui/data-table';

const LoadingSkeleton = () => (
    <div className="p-4">
        <div className="space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-96 w-full" />
        </div>
    </div>
)

const statusVariantMap: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' } = {
  'Active': 'success',
  'Checked-in': 'success',
  'Checked-out': 'secondary',
  'Cancelled': 'destructive',
  'Refunded': 'destructive',
  'Booked': 'outline',
  'Reserved': 'outline'
};


export const getGuestFolioColumns = (currency: string, checkoutTime: string): ColumnDef<ProcessedFolioData>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <div className="font-mono text-xs">{row.original.id.substring(0, 8)}...</div>,
    },
    {
      accessorKey: 'guestName',
      header: 'Guest',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.guestName}</div>
          <div className="text-xs text-muted-foreground">{row.original.phoneNumber}</div>
        </div>
      ),
    },
    {
      accessorKey: 'roomNumber',
      header: 'Room',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">Room {row.original.roomNumber}</div>
          <div className="text-xs text-muted-foreground">{row.original.roomType}</div>
        </div>
      ),
    },
    {
        accessorKey: 'checkInDate',
        header: 'Check-in',
        cell: ({ row }) => {
            const checkInDate = getSafeDate(row.original.checkInDate);
            const staffName = row.original.checkedInByName;
            return (
              <div>
                <div>{checkInDate ? format(checkInDate, 'MMM d, yyyy, p') : 'N/A'}</div>
                {staffName && <div className="text-xs text-muted-foreground">by {staffName}</div>}
              </div>
            )
        }
    },
    {
        accessorKey: 'checkOutDate',
        header: 'Check-out',
        cell: ({ row }) => {
            const checkOutDate = getSafeDate(row.original.checkOutDate);
            const staffName = row.original.checkedOutByName;
            return (
                <div>
                    <div>{checkOutDate ? format(getCheckoutDateTime(checkOutDate, checkoutTime), 'MMM d, yyyy, p') : 'N/A'}</div>
                    {staffName && <div className="text-xs text-muted-foreground">by {staffName}</div>}
                </div>
            )
        }
    },
    {
      accessorKey: 'guestBill',
      header: 'Guest Bill / Payments / Returns',
      cell: ({ row }) => {
        const roomPayment = row.original.payments.find(p => p.type === 'Booking');
        return (
            <div className="text-xs">
            <p>
                <b>Room Fee:</b> {formatCurrency(row.original.roomFee)}
                {roomPayment && (
                    <span className="text-muted-foreground text-[11px] ml-2">
                        = Payment ({roomPayment.paymentMethod}) by {roomPayment.staffName}
                    </span>
                )}
            </p>
            {row.original.guestBill.length > 0 && (
                <div className="mt-1">
                <p><b>Added Bills:</b></p>
                <ul className="list-disc pl-4">
                    {row.original.guestBill.map((item, index) => (
                        <li key={index}>
                            {item.name} (x{item.quantity}) - {formatCurrency(item.total)}
                            {item.createdByName && (
                                <span className="text-muted-foreground text-[11px] ml-1">
                                    by {item.createdByName}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                <p className="font-semibold">Sub-total: {formatCurrency(row.original.guestBillTotal)}</p>
                </div>
            )}
            {row.original.returns.length > 0 && (
                <div className="mt-1 text-destructive">
                    <p><b>Returns/Voided:</b></p>
                    <ul className="list-disc pl-4">
                        {row.original.returns.flatMap((returnItem, returnIndex) =>
                            returnItem.items.map((item, itemIndex) => (
                                <li key={`${returnIndex}-${itemIndex}`}>
                                    {item.itemName} (x{item.quantity}) - {formatCurrency(item.refundAmount)}
                                </li>
                            ))
                        )}
                    </ul>
                    <p className="font-semibold">Sub-total: {formatCurrency(row.original.totalReturns)}</p>
                </div>
            )}
            {row.original.payments.filter(p => p.type !== 'Booking').map((p, i) => (
                <div key={i} className="text-green-600 mt-1"><b>Payment ({p.paymentMethod}) by {p.staffName}:</b> {formatCurrency(p.amount)}</div>
            ))}
            </div>
        );
      },
    },
    {
      accessorKey: 'totalBill',
      header: 'Total Bill',
      cell: ({ row }) => <div className="text-right font-semibold">{formatCurrency(row.original.totalBill)}</div>,
    },
    {
        accessorKey: 'totalPaid',
        header: 'Total Paid',
        cell: ({ row }) => <div className="text-right font-semibold text-green-600">{formatCurrency(row.original.totalPaid)}</div>
    },
    {
      accessorKey: 'balanceDue',
      header: 'Balance Due',
      cell: ({ row }) => {
        const balance = row.original.balanceDue;
        return (
          <div className={`text-right font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
            {formatCurrency(balance)}
          </div>
        );
      },
    },
     {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status as string;
        const variant = statusVariantMap[status] || 'secondary';
        return <Badge variant={variant} className="capitalize">{status}</Badge>;
      }
    }
  ];
};


export function GuestFolioTable({ data, isLoading }: { data: ProcessedFolioData[], isLoading: boolean }) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const checkoutTime = settings?.checkoutTime || '11:00';

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])


  const columns = React.useMemo(() => getGuestFolioColumns(currency, checkoutTime), [currency, checkoutTime]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  if (isLoading) {
      return <LoadingSkeleton />;
  }

  if (data.length === 0) {
      return (
        <EmptyState
            icon={BookUser}
            title="No Guest Folios Found"
            description="There is no data to display for the selected filters."
        />
      )
  }

  return (
    <DataTable
        columns={columns}
        data={data}
        filterColumn="guestName"
        filterPlaceholder="Search by guest, room, or ID..."
        tableId="guest-folio-accounting"
        isPaginated={true}
    />
  );
}