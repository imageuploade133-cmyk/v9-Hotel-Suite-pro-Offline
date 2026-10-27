
'use client';

import * as React from 'react';
import type { Payment } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { usePaymentColumns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Wallet } from 'lucide-react';

interface PaymentListProps {
  payments: Payment[];
  isLoading: boolean;
  currency: string;
  onViewDetails: (payment: Payment) => void;
  onReprintReceipt: (payment: Payment) => void;
  onRefund: (payment: Payment) => void;
}

export function PaymentList({
  payments,
  isLoading,
  currency,
  onViewDetails,
  onReprintReceipt,
  onRefund,
}: PaymentListProps) {
  const columns = usePaymentColumns({
    onViewDetails,
    onReprintReceipt,
    onRefund,
    currency,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-24" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
      return (
        <Card>
            <CardContent>
                <EmptyState
                    icon={Wallet}
                    title="No Transactions Found"
                    description="There are no transactions that match the current filter."
                    className="h-96"
                />
            </CardContent>
        </Card>
      )
  }

  return (
    <Card>
        <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={payments || []}
              filterColumn="guestName"
              filterPlaceholder="Filter by guest name..."
              tableId="payments"
            />
        </CardContent>
    </Card>
  );
}
