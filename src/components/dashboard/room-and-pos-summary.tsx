
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { BedDouble, CalendarCheck, DollarSign, ShoppingCart, ChevronDown, FileWarning } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function RoomAndPosSummary({ data, posIncomeFilter, setPosIncomeFilter }: any) {
  const { totalRoomIncome, totalRoomOutstanding, totalReservations, activeReservations, todaysHotelPosIncome, todaysMainPosIncome, posIncomeLabel, userCurrency, isLoading, totalOutstandingBill } = data;

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room & POS Summary</CardTitle>
        <CardDescription>A high-level overview of room booking revenue and daily point of sale income.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Room Income"
            value={formatCurrency(totalRoomIncome)}
            icon={DollarSign}
            description="All-time revenue from completed & active bookings."
            isLoading={isLoading}
            className="border-primary text-primary"
          />
          <StatCard
            title="Outstanding Bills (Active Guests)"
            value={formatCurrency(totalOutstandingBill)}
            icon={FileWarning}
            description="Total amount of all unpaid bills from active guests."
            isLoading={isLoading}
            className="text-yellow-600 border-yellow-500"
          />
           <StatCard
            title="Reservations"
            value={
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{activeReservations?.toLocaleString() || '0'}</span>
                <span className="text-sm text-muted-foreground">/ {totalReservations?.toLocaleString() || '0'} Total</span>
              </div>
            }
            icon={CalendarCheck}
            description="Active reservations vs. all-time bookings."
            isLoading={isLoading}
          />
          <Card className="border-2 border-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 text-sm font-medium -ml-2">
                        {posIncomeLabel}
                        <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => setPosIncomeFilter('today')}>Today</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPosIncomeFilter('yesterday')}>Yesterday</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPosIncomeFilter('lastWeek')}>Last 7 Days</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              <ShoppingCart className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{formatCurrency(todaysHotelPosIncome + todaysMainPosIncome)}</div>
              <p className="text-xs text-green-600">Hotel POS: {formatCurrency(todaysHotelPosIncome)} | Main POS: {formatCurrency(todaysMainPosIncome)}</p>
            </CardContent>
        </Card>
        </div>
      </CardContent>
    </Card>
  );
}
