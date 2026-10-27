'use client';

import * as React from 'react';
import { Wallet } from 'lucide-react';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { StatCard } from '@/components/ui/stat-card';
import type { Booking, Bill } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';

interface TotalActiveGuestBillCardProps {
  bills?: Bill[];
  isLoadingBills?: boolean;
}

export function TotalActiveGuestBillCard({
  bills: providedBills,
  isLoadingBills: isParentLoadingBills,
}: TotalActiveGuestBillCardProps) {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      value
    );

  // Fetch ALL active bookings to filter bills correctly, ensuring we get the true total
  // regardless of pagination on the dashboard.
  const activeBookingsQuery = React.useMemo(
    () =>
      firestore
        ? query(
            collection(firestore, 'bookings'),
            where('status', 'in', ['Checked-in', 'Active'])
          )
        : null,
    [firestore]
  );

  const { data: activeBookings, isLoading: isLoadingBookings } =
    useCollection<Booking>(activeBookingsQuery);

  // Fetch bills if not provided by parent
  const billsQuery = React.useMemo(
    () =>
      !providedBills && firestore
        ? query(collectionGroup(firestore, 'bills'))
        : null,
    [firestore, providedBills]
  );

  const { data: fetchedBills, isLoading: isFetchingBills } =
    useCollection<Bill>(billsQuery);

  const allBills = providedBills || fetchedBills || [];
  const isLoading =
    isLoadingBookings || (providedBills ? !!isParentLoadingBills : isFetchingBills);

  const { totalUnpaidBill, totalPaidBill, allPaid } = React.useMemo(() => {
    if (!activeBookings || !allBills) return { totalUnpaidBill: 0, totalPaidBill: 0, allPaid: false };

    const activeBookingIds = new Set(activeBookings.map((b) => b.id));

    const activeBills = allBills.filter((bill) => activeBookingIds.has(bill.bookingId));

    const totalUnpaid = activeBills
      .filter((bill) => !bill.paid)
      .reduce((sum, bill) => sum + (bill.total || 0), 0);

    const totalPaid = activeBills
      .filter((bill) => bill.paid)
      .reduce((sum, bill) => sum + (bill.total || 0), 0);

    const allSettled = activeBills.length > 0 && activeBills.every((bill) => bill.paid);

    return { totalUnpaidBill: totalUnpaid, totalPaidBill: totalPaid, allPaid: allSettled };
  }, [activeBookings, allBills]);

  // Determine the description based on payment status
  const description = allPaid
    ? "All guest bills are settled"
    : `Outstanding amount from active guest bills`;

  return (
    <StatCard
      title="Total Unpaid Guest Bill"
      value={formatCurrency(totalUnpaidBill)}
      icon={Wallet}
      description={description}
      isLoading={isLoading}
      className={allPaid ? "border-green-500" : "border-red-500"}
    />
  );
}
