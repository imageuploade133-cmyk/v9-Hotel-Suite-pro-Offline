
'use client';

import * as React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import type { Booking, Room } from '@/lib/types';
import {
  Bed,
  BedDouble,
  LogIn,
  LogOut,
  CalendarCheck,
  Wind,
  Wrench,
  AlarmClockOff,
  DollarSign,
  Undo2,
  Wallet,
} from 'lucide-react';
import { getSafeDate } from '@/lib/helpers';
import type { DateRange } from 'react-day-picker';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { CollapsibleContent } from '@/components/ui/collapsible';
import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { ALL_PERMISSIONS } from '@/lib/permissions';


interface StatCardsProps {
  allBookingsData: Booking[] | null;
  rooms: Room[] | null;
  cleaningQueueData: any[] | null;
  maintenanceQueueData: any[] | null;
  dateRange?: DateRange;
  overdueCheckoutsCount: number;
  todaysIncome: number;
  totalRefunds: number;
  myTodaysIncome: number;
}

export function StatCards({
  allBookingsData,
  rooms,
  cleaningQueueData,
  maintenanceQueueData,
  dateRange,
  overdueCheckoutsCount,
  todaysIncome,
  totalRefunds,
  myTodaysIncome,
}: StatCardsProps) {
  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';
  const { userProfile, permissions } = useUser();

  const isAdminOrFirebaseUser = React.useMemo(() => {
    const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
    const hasAllPermissions = ALL_PERMISSIONS.every(p => permissions.includes(p));
    return isAdmin || hasAllPermissions;
  }, [userProfile?.role, permissions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);
  }

  const stats = React.useMemo(() => {
    const from = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(new Date());
    const to = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date());
    const interval = { start: from, end: to };

    const filteredBookings = allBookingsData?.filter(b => {
        const checkIn = getSafeDate(b.checkInDate);
        return checkIn && isWithinInterval(checkIn, interval);
    }) || [];

    const checkIns = allBookingsData?.filter(b => {
        const checkIn = getSafeDate(b.checkInDate);
        return (b.status === 'Active' || b.status === 'Checked-in') && checkIn && isWithinInterval(checkIn, interval);
    }).length || 0;

    const checkOuts = allBookingsData?.filter(b => {
        const actualCheckOut = getSafeDate(b.actualCheckOutDate);
        return b.status === 'Checked-out' && actualCheckOut && isWithinInterval(actualCheckOut, interval);
    }).length || 0;

    const reservations = filteredBookings.filter(b => b.status === 'Reserved' || b.status === 'Booked').length;

    const vacantRooms = rooms?.reduce((acc, r) => acc + (r.availableRooms || 0), 0) || 0;
    const occupiedRooms = rooms?.reduce((acc, r) => acc + (r.bookedRooms || 0), 0) || 0;
    const cleaning = cleaningQueueData?.length || 0;
    const maintenance = maintenanceQueueData?.length || 0;

    return {
      checkIns,
      checkOuts,
      vacantRooms,
      occupiedRooms,
      reservations,
      cleaning,
      maintenance,
    };
  }, [allBookingsData, rooms, cleaningQueueData, maintenanceQueueData, dateRange]);

  const primaryStats = [
    { title: "Today's Income", value: formatCurrency(todaysIncome), icon: DollarSign, description: "Total payments received today.", className: "border-green-500 text-green-500", adminOnly: true },
    { title: 'Check-ins', value: stats.checkIns, icon: LogIn, description: 'Total check-ins for the period.' },
    { title: 'Check-outs', value: stats.checkOuts, icon: LogOut, description: 'Total check-outs for the period.' },
    { title: 'My Income Today', value: formatCurrency(myTodaysIncome), icon: Wallet, description: 'Your personal sales for today.', className: 'bg-primary/10' },
  ];

  const visiblePrimaryStats = primaryStats.filter(stat => !stat.adminOnly || isAdminOrFirebaseUser);

  const secondaryStats = [
    { title: 'Reservations', value: stats.reservations, icon: CalendarCheck, description: 'Upcoming reservations for the period.' },
    { title: 'Overdue Checkouts', value: overdueCheckoutsCount, icon: AlarmClockOff, description: 'Guests past their checkout time.', className: overdueCheckoutsCount > 0 ? "text-destructive border-destructive" : "" },
    { title: 'Vacant Rooms', value: stats.vacantRooms, icon: Bed, description: 'Currently available rooms.' },
    { title: 'Occupied Rooms', value: stats.occupiedRooms, icon: BedDouble, description: 'Currently occupied rooms.' },
    { title: 'Cleaning Queue', value: stats.cleaning, icon: Wind, description: 'Rooms needing cleaning.' },
    { title: 'Maintenance Queue', value: stats.maintenance, icon: Wrench, description: 'Rooms requiring maintenance.' },
    { title: "Total Refunds Today", value: formatCurrency(totalRefunds), icon: Undo2, description: "Total value of all refunds processed today.", className: "border-destructive text-destructive", adminOnly: true },
  ];

  const visibleSecondaryStats = secondaryStats.filter(stat => !stat.adminOnly || isAdminOrFirebaseUser);

  return (
    <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {visiblePrimaryStats.map(stat => <StatCard key={stat.title} {...stat} />)}
        </div>
        <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
            {visibleSecondaryStats.map(stat => <StatCard key={stat.title} {...stat} />)}
        </CollapsibleContent>
    </>
  );
}
