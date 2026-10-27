'use client';

import * as React from 'react';
import type { Booking } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { getInitials, getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TimeRemaining } from '@/components/bookings/time-remaining';
import { Bed, LogIn, LogOut, Phone, Mail, MoreHorizontal, Globe } from 'lucide-react';
import Link from 'next/link';


interface ReservationCardProps {
    booking: Booking;
    checkoutTime: string;
    onCheckIn: (booking: Booking) => void;
    onOpenActions: (booking: Booking) => void;
}

export function ReservationCard({
  booking,
  checkoutTime,
  onCheckIn,
  onOpenActions,
}: ReservationCardProps) {
  const isPaid = booking.status === 'Reserved';

  const scheduledCheckoutDate = booking.checkOutDate ? getCheckoutDateTime(getSafeDate(booking.checkOutDate)!, checkoutTime) : null;
  const checkInDate = getSafeDate(booking.checkInDate);

  const isCheckinDue = React.useMemo(() => {
    if (!checkInDate) return false;
    // Blink if the check-in is scheduled for today.
    return isToday(checkInDate);
  }, [checkInDate]);


  return (
    <Card className={cn("flex flex-col", isCheckinDue && "border-primary animate-pulse")}>
      <CardHeader className="items-center text-center p-6 space-y-3">
          <button onClick={() => onOpenActions(booking)}>
            <Avatar className="h-20 w-20 cursor-pointer border-4 border-primary transition-opacity hover:opacity-80">
                <AvatarImage src={booking.guestPhotoURL || ''} />
                <AvatarFallback className="text-2xl">{getInitials(booking.guestName)}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex flex-col items-center gap-2">
            <CardTitle className="text-2xl">{booking.guestName}</CardTitle>
            {booking.source === 'website' && (
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                    <Globe className="mr-1.5 h-3.5 w-3.5" />
                    Website Reservation
                </Badge>
            )}
          </div>
          {checkInDate && (
            <TimeRemaining
              date={checkInDate}
              prefix="Check-in"
              className="text-sm"
            />
          )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-grow p-6 space-y-4 flex flex-col">
          <div className="space-y-3 text-sm flex-1">
               <div className="font-semibold text-muted-foreground">Stay Details</div>
               <div className="flex items-start gap-3">
                  <Bed className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium">Room {booking.roomNumber}</p>
                  </div>
              </div>
              <div className="flex items-start gap-3">
                  <LogIn className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                      <p className="font-medium">Check-in</p>
                      <p className="text-muted-foreground">
                          {checkInDate ? format(checkInDate, 'EEEE, dd-MM-yyyy, p') : 'N/A'}
                      </p>
                  </div>
              </div>
               <div className="flex items-start gap-3">
                  <LogOut className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                      <p className="font-medium">Check-out</p>
                      <p className="text-muted-foreground">
                          {scheduledCheckoutDate ? format(scheduledCheckoutDate, 'EEEE, dd-MM-yyyy, p') : 'N/A'}
                      </p>
                  </div>
              </div>
          </div>
           <Button className="w-full mt-4" onClick={() => onCheckIn(booking)} disabled={!isCheckinDue}>
            <LogIn className="mr-2 h-4 w-4" /> Check In Guest
          </Button>
      </CardContent>

      <CardFooter className="flex items-center gap-2 bg-muted/50 p-2">
          <Button className="w-full" variant="outline" onClick={() => onOpenActions(booking)}>
            Actions <MoreHorizontal className="ml-2 h-4 w-4"/>
          </Button>
      </CardFooter>
    </Card>
  );
}
