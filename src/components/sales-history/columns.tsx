
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Eye, MoreHorizontal, Printer, Undo2, User } from 'lucide-react';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { StockSale, StockReturn, UserProfile, Payment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { CreditCard } from 'lucide-react';

export type Transaction = (StockSale | StockReturn) & {
    type: 'Sale' | 'Return';
    amountPaid?: number;
};

type UseSalesHistoryColumnsProps = {
  currency: string;
  onViewDetails?: (sale: StockSale) => void;
  onReprintReceipt?: (sale: StockSale) => void;
  onRefund?: (sale: StockSale) => void;
  onRecordPayment?: (sale: StockSale) => void;
  onActions?: (transaction: Transaction) => void;
  userMap: Map<string, UserProfile>;
  sales?: StockSale[];
  creditPayments?: Payment[];
  returns?: any[];
  dateRange?: any;
  searchTerm?: string;
  activeTab?: 'all' | 'credit';
  [key: string]: any;
};

export const useSalesHistoryColumns = ({
  currency,
  onViewDetails,
  onReprintReceipt,
  onRefund,
  onRecordPayment,
  onActions,
  userMap,
  sales,
  creditPayments,
  activeTab
}: UseSalesHistoryColumnsProps): ColumnDef<Transaction>[] => {
  const { hasPermission } = usePermissions();
  const canProcessRefunds = hasPermission(PagePermission.PROCESS_SALE_REFUNDS);

  return React.useMemo(() => {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
    };

    return [
      {
        id: 'transactionId',
        header: 'ID',
        accessorFn: row => (row as StockSale).saleId || (row as StockReturn).refundId || row.id.substring(0, 8),
        cell: ({ row }) => <span className="font-mono text-xs">{(row.original as StockSale).saleId || (row.original as StockReturn).refundId || `${row.original.id.substring(0,8)}...`}</span>
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
      },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => {
          const items = row.original.items;
          return (
            <ul className="list-disc pl-4 text-xs">
              {items.map((item: any, index: number) => (
                <li key={index}>{(item as any).itemName || (item as any).name} (x{item.quantity}) - {formatCurrency((item as any).sellingPrice || item.refundAmount || 0)} each</li>
              ))}
            </ul>
          );
        },
      },
      {
        id: 'totalAmount',
        header: ({ column }) => (
          <div className="text-right">
              <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
          </div>
        ),
        accessorFn: row => row.type === 'Sale'
            ? (row as StockSale).totalAmount
            : (row as StockReturn).totalRefundAmount,
        cell: ({ row }) => {
          const isReturn = row.original.type === 'Return';
          if (isReturn) return <div className="text-right text-muted-foreground">—</div>;
          const amount = (row.original as StockSale).totalAmount;
          return (
            <div className="font-semibold text-right text-green-600">
              {formatCurrency(amount)}
            </div>
          );
        },
      },
      {
          id: 'paymentStatus',
          header: 'Payment Status',
          accessorFn: row => {
              if (row.type !== 'Sale') return 'N/A';
              const sale = row as StockSale;
              if (sale.status === 'Refunded') return 'Refunded';
              if (sale.status === 'Partially Refunded') return 'Partially Refunded';
              if (sale.paymentMethod !== 'Credit') return 'Paid';

              if (!(row as any).amountPaid) return 'Credit';
              const totalPaid = (row as any).amountPaid;

              if (totalPaid >= sale.totalAmount) return 'Fully Settled';
              if (totalPaid > 0) return 'Partially Paid';
              return 'Credit';
          },
          cell: ({ row }) => {
              const status = row.getValue('paymentStatus') as string;
              if (status === 'N/A') return <span className="text-muted-foreground text-xs">{status}</span>;

              let variant: 'success' | 'warning' | 'destructive' | 'secondary' = 'secondary';
              if (status === 'Paid' || status === 'Fully Settled') variant = 'success';
              else if (status === 'Partially Paid' || status === 'Partially Refunded') variant = 'warning';
              else if (status === 'Credit' || status === 'Refunded') variant = 'destructive';

              return <Badge variant={variant}>{status}</Badge>;
          }
      },
      {
        id: 'date',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorFn: row => getSafeDate((row as StockSale).soldAt || (row as StockReturn).returnedAt),
        cell: ({ row }) => {
          const date = getSafeDate((row.original as StockSale).soldAt || (row.original as StockReturn).returnedAt);
          return date ? format(date, 'PPpp') : 'N/A';
        },
      },
       {
          id: 'soldByName',
          header: 'Processed By',
          accessorFn: row => (row as StockSale).soldByName || (row as StockReturn).returnedByName,
          cell: ({ row }) => {
              const staffName = (row.original as StockSale).soldByName || (row.original as StockReturn).returnedByName || 'N/A';
              const staffId = (row.original as StockSale).soldByUid || (row.original as StockReturn).returnedByUid;
              const staffProfile = staffId ? userMap.get(staffId) : null;

              return (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={staffProfile?.photoURL || undefined} alt={staffName} />
                    <AvatarFallback>{staffProfile ? getInitials(staffProfile.name) : <User />}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{staffName}</p>
                    {staffProfile && <p className="text-xs text-muted-foreground">{staffProfile.email}</p>}
                  </div>
                </div>
              )
          }
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const transaction = row.original;

          // For credit sales tab, show detailed actions
          if (activeTab === 'credit' && transaction.type === 'Sale') {
            const sale = transaction as StockSale;
            const repayments = (creditPayments || []).filter(p => p.bookingId === sale.id);
            const totalRepaid = repayments.reduce((sum, p) => sum + p.amount, 0) + (sale.initialPaymentAmount || 0);
            const outstandingBalance = sale.totalAmount - totalRepaid;
            const isFullyPaid = totalRepaid >= sale.totalAmount;

            return (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewDetails?.(sale)}
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onReprintReceipt?.(sale)}
                  title="Reprint Receipt"
                >
                  <Printer className="h-4 w-4" />
                </Button>
                {!isFullyPaid && onRecordPayment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRecordPayment(sale)}
                    title="Record Payment"
                    className="text-green-600 hover:text-green-700"
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                )}
                {canProcessRefunds && onRefund && sale.status !== 'Refunded' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRefund(sale)}
                    title="Process Refund"
                    className="text-destructive hover:text-destructive/90"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          }

          // Default actions dropdown for all tab
          if (onActions) {
            return (
              <div className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onActions(transaction)}>
                      Actions
                  </Button>
              </div>
            )
          }

          // Fallback with individual action buttons
          if (transaction.type === 'Sale') {
            const sale = transaction as StockSale;
            return (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewDetails?.(sale)}
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onReprintReceipt?.(sale)}
                  title="Reprint Receipt"
                >
                  <Printer className="h-4 w-4" />
                </Button>
                {sale.paymentMethod === 'Credit' && onRecordPayment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRecordPayment(sale)}
                    title="Record Payment"
                    className="text-green-600 hover:text-green-700"
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                )}
                {canProcessRefunds && onRefund && sale.status !== 'Refunded' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRefund(sale)}
                    title="Process Refund"
                    className="text-destructive hover:text-destructive/90"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          }

          return null;
        },
      },
    ];
  }, [currency, onActions, onViewDetails, onReprintReceipt, onRefund, onRecordPayment, userMap, canProcessRefunds, creditPayments, activeTab]);
};
