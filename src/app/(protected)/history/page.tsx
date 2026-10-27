'use client';

import * as React from 'react';
import { History } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { GlobalHistory } from '@/components/history/global-history';
import type { Booking } from '@/lib/types';


function HistoryPage() {
  const [reassignBooking, setReassignBooking] = React.useState<Booking | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const handleReassign = (booking: Booking) => {
    setReassignBooking(booking);
  };

  const handleSuccess = () => {
    setReloadCounter(prev => prev + 1);
  };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <History className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Global Booking Records</h1>
              <p className="text-muted-foreground">
                View, filter, and export a complete record of all guest bookings.
              </p>
            </div>
        </div>
        <GlobalHistory onReassign={handleReassign} reloadCounter={reloadCounter} />
    </div>
  );
}

export default withAuth(HistoryPage, PagePermission.VIEW_BOOKINGS_PAGE);
