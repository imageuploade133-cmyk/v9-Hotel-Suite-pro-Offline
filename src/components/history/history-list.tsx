'use client';

import * as React from 'react';
import type { Booking, UserProfile, StockAuditLog, Bill } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useHistoryColumns } from './columns';
import { EmptyState } from '../ui/empty-state';
import { History } from 'lucide-react';
import { useBillColumns } from './bill-columns';
import { useSettings } from '@/contexts/settings-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { getSafeDate } from '@/lib/helpers';

interface HistoryListProps {
  history: (Booking | StockAuditLog | Bill)[];
  isLoading: boolean;
  isPrintView?: boolean;
  onViewDetails: (booking: Booking) => void;
  onReprintReceipt: (booking: Booking) => void;
  onReprintCancellation: (booking: Booking) => void;
  onReprintBill: (bill: Bill) => void;
  activeTab: 'checkouts' | 'checkins' | 'reservations' | 'cancellations' | 'logins' | 'bills';
  userMap: Map<string, UserProfile>;
}

export function HistoryList({
  history,
  isLoading,
  isPrintView = false,
  onViewDetails,
  onReprintReceipt,
  onReprintCancellation,
  onReprintBill,
  activeTab,
  userMap,
}: HistoryListProps) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const bookingColumns = useHistoryColumns({
    onViewDetails,
    onReprintReceipt,
    onReprintCancellation,
    activeTab: activeTab as any, // Cast because it could be 'logins'
    userMap,
  });

  const billColumns = useBillColumns({ currency, onReprint: onReprintBill, userMap });

  const columns = activeTab === 'bills' ? billColumns : bookingColumns;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!history || history.length === 0) {
      return (
        <div className="p-6">
            <EmptyState
                icon={History}
                title="No Records Found"
                description="There are no records that match your current filters."
                className="h-96"
            />
        </div>
      )
  }

  // Simplified print view for now
  if (isPrintView) {
      return (
        <div className="p-6">
            <table className="w-full text-sm border-collapse border">
                <thead>
                    <tr className="border-b">
                        <th className="p-2 text-left font-semibold border">Guest</th>
                        <th className="p-2 text-left font-semibold border">Room</th>
                        <th className="p-2 text-left font-semibold border">Date</th>
                        <th className="p-2 text-left font-semibold border">Processed By</th>
                        <th className="p-2 text-left font-semibold border">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map(item => {
                        const booking = item as Booking; // Treat all as booking for this simple view
                        return (
                            <tr key={booking.id} className="border-b">
                                <td className="p-2 border">{booking.guestName}</td>
                                <td className="p-2 border">{booking.roomNumber}</td>
                                <td className="p-2 border">{ (booking.createdAt || booking.checkInDate || booking.actualCheckOutDate || (booking as any).cancelledAt as Date).toLocaleDateString()}</td>
                                <td className="p-2 border">{booking.createdByName || booking.checkedOutByName || (booking as any).cancelledByName || 'N/A'}</td>
                                <td className="p-2 border">{booking.status}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      )
  }

  return (
    <DataTable
      columns={columns as any}
      data={history || []}
      filterColumn={activeTab === 'bills' ? 'guestInfo' : 'guestName'}
      filterPlaceholder={activeTab === 'bills' ? "Filter by guest..." : "Filter by guest name..."}
      isPaginated={false}
      className="border-0"
      tableId="global-history"
    />
  );
}
