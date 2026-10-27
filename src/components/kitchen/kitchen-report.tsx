'use client';

import * as React from 'react';
import type { Order, Bill, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow, TableFooter } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Logo } from '@/components/logo';
import { DateRange } from 'react-day-picker';

interface KitchenReportProps {
  orders: Order[];
  settings: any;
  dateRange?: DateRange;
  userProfile: UserProfile | null;
  allBills: Bill[];
}

export function KitchenReport({ orders, settings, dateRange, userProfile, allBills }: KitchenReportProps) {
  const currency = settings?.currency || 'USD';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);

  return (
    <div className="bg-white text-black p-8">
      <header className="flex justify-between items-start mb-8">
        <div>
          {settings?.businessLogoUrl ? (
            <img src={settings.businessLogoUrl} alt="Logo" style={{ height: `${settings.businessLogoSize || 48}px` }} />
          ) : (
            <Logo className="h-10 w-10" />
          )}
        </div>
        <div className="text-right text-xs">
          <h1 className="font-bold text-base">{settings?.businessName || 'Hotel Suite Pro'}</h1>
          <p>{settings?.businessAddress}</p>
          <p>{settings?.businessPhone}</p>
          <p>{settings?.businessEmail}</p>
        </div>
      </header>

      <div className="text-center mb-6">
        <h2 className="font-bold text-xl uppercase">Kitchen Sales Report</h2>
        <p className="text-sm">
          {dateRange?.from ?
            `${format(dateRange.from, 'PPP')} to ${dateRange.to ? format(dateRange.to, 'PPP') : ''}`
            : 'All Time'
          }
        </p>
      </div>

      <Separator className="my-4" />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(order => {
             const billForItem = allBills.find(b => b.items.some(i => i.id.startsWith(`order-${order.orderNumber}`)));
             const isPaid = billForItem?.paid ?? false;

            return (
                <TableRow key={order.id}>
                    <TableCell>{format(getSafeDate(order.createdAt)!, 'PP')}</TableCell>
                    <TableCell>#{order.orderNumber}</TableCell>
                    <TableCell>{order.roomNumber}</TableCell>
                    <TableCell>{order.guestName}</TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell>{isPaid ? 'Paid' : 'Billed'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalPrice)}</TableCell>
                </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
            <TableRow className="font-bold text-base">
                <TableCell colSpan={6} className="text-right">Total Revenue</TableCell>
                <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
            </TableRow>
        </TableFooter>
      </Table>

       <Separator className="my-4" />

        <div className="text-xs text-gray-500 mt-8">
            <p>Report generated on {format(new Date(), 'PPpp')} by {userProfile?.name || 'System'}.</p>
        </div>
    </div>
  );
}
