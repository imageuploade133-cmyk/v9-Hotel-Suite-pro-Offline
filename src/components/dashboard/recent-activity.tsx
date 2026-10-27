'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { Mail, Phone, Bed, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Booking } from '@/lib/types';

const PAGE_SIZE = 5;

const RecentActivityList = React.memo(
  ({
    bookings,
    currency,
    emptyMessage,
    type,
    isLoading,
    currentPage,
    onPageChange,
    onReprint,
  }: {
    bookings: any[];
    currency: string;
    emptyMessage: string;
    type: 'paid' | 'reservation' | 'cancelled';
    isLoading: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    onReprint: (booking: Booking) => void;
  }) => {

    const paginatedBookings = React.useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        return bookings.slice(startIndex, endIndex);
    }, [bookings, currentPage]);

    const totalPages = Math.ceil(bookings.length / PAGE_SIZE);

    const formatCurrency = (value: number | undefined) => {
      if (value === undefined) return '...';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(value);
    };

    if (isLoading) {
      return (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="grid gap-1 w-full">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
          ))}
        </div>
      );
    }

    if (paginatedBookings.length === 0) {
      return (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      );
    }

    return (
        <>
            <div className="flex flex-col gap-4">
                {paginatedBookings.map(booking => {
                let detail, amount;
                if (type === 'paid') {
                    detail = `Room ${booking.roomNumber}`;
                    amount = formatCurrency(booking.amount);
                } else if (type === 'reservation') {
                    detail = `For Room ${booking.roomNumber}`;
                    amount = formatCurrency(booking.totalAmount);
                } else {
                    detail = `Room ${booking.roomNumber}`;
                }

                const cancelledDate = type === 'cancelled' ? getSafeDate(booking.cancelledAt) : null;

                return (
                    <button
                        key={booking.id}
                        className="flex w-full items-center gap-4 text-left p-2 rounded-lg hover:bg-muted"
                        onClick={() => onReprint(booking)}
                    >
                     <div
                        className="relative flex-shrink-0"
                      >
                        <Avatar className="h-10 w-10 cursor-pointer transition-opacity hover:opacity-80">
                            <AvatarImage src={booking.guestPhotoURL} alt={booking.guestName} />
                            <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                        </Avatar>
                     </div>
                    <div className="grid gap-1.5 flex-1">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold leading-none">
                            {booking.guestName}
                            </p>
                            {amount && (
                                <div className="font-medium text-sm text-right">{amount}</div>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            {booking.guestEmail && (
                                <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <span>{booking.guestEmail}</span>
                                </div>
                            )}
                            {booking.guestPhoneNumber && (
                                <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <span>{booking.guestPhoneNumber}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Bed className="h-3 w-3"/>
                                <span>{detail}</span>
                            </div>
                        </div>
                    </div>
                    {type === 'cancelled' && cancelledDate && (
                        <div className="ml-auto text-right text-xs text-muted-foreground self-start">
                            {format(cancelledDate, 'PP')}
                        </div>
                    )}
                    </button>
                );
                })}
            </div>
             {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                     <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </>
    );
  }
);
RecentActivityList.displayName = 'RecentActivityList';


export function RecentActivity({ data, onReprint }: { data: any, onReprint: (booking: Booking) => void }) {
    const { recentPaidBookings, recentReservations, recentCancellations, userCurrency, isLoading } = data;
    const [paidPage, setPaidPage] = React.useState(1);
    const [reservationsPage, setReservationsPage] = React.useState(1);
    const [cancellationsPage, setCancellationsPage] = React.useState(1);

    return (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>A log of the most recent transactions.</CardDescription>
          </CardHeader>
          <Tabs defaultValue="paid" className="w-full">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="paid" className="flex gap-2">
                  Paid
                  <Badge variant={'secondary'} className="rounded-full px-2">
                    {recentPaidBookings?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="reservations" className="flex gap-2">
                  Reservations
                  <Badge variant={'secondary'} className="rounded-full px-2">
                    {recentReservations?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="cancellations" className="flex gap-2">
                  Cancellations
                  <Badge variant={'secondary'} className="rounded-full px-2">
                    {recentCancellations?.length || 0}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>
            <CardContent className="mt-4">
              <TabsContent value="paid">
                <RecentActivityList
                  bookings={recentPaidBookings || []}
                  currency={userCurrency}
                  emptyMessage="No recent paid bookings found."
                  type="paid"
                  isLoading={isLoading}
                  currentPage={paidPage}
                  onPageChange={setPaidPage}
                  onReprint={onReprint}
                />
              </TabsContent>
              <TabsContent value="reservations">
                <RecentActivityList
                  bookings={recentReservations || []}
                  currency={userCurrency}
                  emptyMessage="No recent unpaid reservations."
                  type="reservation"
                  isLoading={isLoading}
                  currentPage={reservationsPage}
                  onPageChange={setReservationsPage}
                  onReprint={onReprint}
                />
              </TabsContent>
              <TabsContent value="cancellations">
                <RecentActivityList
                  bookings={recentCancellations || []}
                  currency={userCurrency}
                  emptyMessage="No recent cancellations."
                  type="cancelled"
                  isLoading={isLoading}
                  currentPage={cancellationsPage}
                  onPageChange={setCancellationsPage}
                  onReprint={onReprint}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
    )
}
