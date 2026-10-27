
'use client';

import * as React from 'react';
import type { Booking, Bill } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { getInitials, getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TimeRemaining } from '@/components/bookings/time-remaining';
import { Bed, DollarSign, FileText, LogIn, LogOut, Mail, MoreHorizontal, Phone, CircleX } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';


interface ActiveBookingSubCardProps {
  booking: Booking;
  onCheckOut: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  onAddBill: (booking: Booking) => void;
  onViewBill: (booking: Booking) => void;
  onPayBills: (booking: Booking) => void;
  setDetailsBooking: (booking: Booking | null) => void;
  onToggleCollectPayment: (booking: Booking, collect: boolean) => void;
  onOpenActions?: (booking: Booking) => void;
  onViewImage?: (url: string) => void;
}

export function ActiveBookingSubCard({
  booking,
  onCheckOut,
  onCancel,
  onAddBill,
  onViewBill,
  onPayBills,
  setDetailsBooking,
  onToggleCollectPayment,
  onOpenActions,
  onViewImage,
}: ActiveBookingSubCardProps) {
  const { settings } = useSettings();
  const firestore = useFirestore();
  const checkoutTime = settings?.checkoutTime || '12:00';

  const safeCheckOutDate = getSafeDate(booking.checkOutDate);
  const checkoutDateTime = safeCheckOutDate ? getCheckoutDateTime(safeCheckOutDate, checkoutTime) : null;

  const checkInDate = getSafeDate(booking.checkInDate);
  const staffName = booking.checkedInByName || booking.createdByName;

  const { data: unpaidBills } = useCollection<Bill>(
    React.useMemo(() => {
      if (!firestore || !booking) return null;
      return query(
        collection(firestore, `bookings/${booking.id}/bills`),
        where('paid', '==', false)
      );
    }, [firestore, booking.id])
  );
  const hasUnpaidBills = unpaidBills && unpaidBills.length > 0;

  const isOverdue = checkoutDateTime ? isPast(checkoutDateTime) : false;

  return (
    <Card className="flex flex-col">
        <CardHeader>
             <CardTitle className="flex items-center justify-between gap-2">
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity" onClick={() => setDetailsBooking(booking)}>
                    <Bed className="h-5 w-5 text-primary"/>
                    Room {booking.roomNumber}
                </button>
                {onOpenActions ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => onOpenActions(booking)}>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDetailsBooking(booking)}>View Details</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <button
                    onClick={() => booking.guestPhotoURL && onViewImage && onViewImage(booking.guestPhotoURL)}
                    disabled={!booking.guestPhotoURL}
                    className="disabled:cursor-default"
                >
                    <Avatar className="h-12 w-12 border">
                        <AvatarImage src={booking.guestPhotoURL} />
                        <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                    </Avatar>
                </button>
                <div className="flex-1">
                <p className="font-semibold">{booking.guestName}</p>
                {booking.guestPhoneNumber && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{booking.guestPhoneNumber}</p>}
                {booking.guestEmail && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{booking.guestEmail}</p>}
                </div>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                        <LogIn className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Checked-in: {checkInDate ? format(checkInDate, 'MMM d, yyyy, p') : 'N/A'}</p>
                            {staffName && <p className="text-xs text-muted-foreground">by {staffName}</p>}
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <LogOut className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div>
                            <p className="font-medium text-destructive">Scheduled Out: {checkoutDateTime ? format(checkoutDateTime, 'MMM d, yyyy, p') : 'N/A'}</p>
                        </div>
                    </div>
            </div>
            {checkoutDateTime && <TimeRemaining date={checkoutDateTime} prefix="Checkout" />}
        </CardContent>
         <CardFooter className="flex flex-col items-stretch gap-2 bg-muted/50 p-2">
             <div className="flex items-center space-x-2 p-2 justify-center">
                <Switch
                    id={`collect-payment-sub-${booking.id}`}
                    checked={!!booking.collectPayment}
                    onCheckedChange={(checked) => onToggleCollectPayment(booking, checked)}
                    className="data-[state=unchecked]:bg-[#8C8B8B]"
                />
                <Label htmlFor={`collect-payment-sub-${booking.id}`} className="font-semibold text-destructive">Collect Payment</Label>
            </div>
            <div className="flex w-full items-center gap-2">
                <Button
                size="sm"
                className={cn(
                    "w-full h-8",
                    isOverdue && "bg-destructive hover:bg-destructive/90 text-destructive-foreground blinking-red-bg"
                )}
                onClick={() => onCheckOut(booking)}
                >
                    <LogOut className="mr-2 h-4 w-4" /> Check Out
                </Button>
                <Button size="sm" variant="destructive" className="w-full h-8" onClick={() => onCancel(booking)}>
                    <CircleX className="mr-2 h-4 w-4" /> Cancel
                </Button>
            </div>
            <div className="flex w-full items-center gap-2">
                <Button size="sm" variant="secondary" className="flex-1 h-8" onClick={() => onViewBill(booking)}>
                    <FileText className="mr-2 h-4 w-4" /> View Bill
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 h-8"
                    onClick={() => onAddBill(booking)}
                    style={{ backgroundColor: '#DB9A00' }}
                >
                    <DollarSign className="mr-2 h-4 w-4" /> Add Bill
                </Button>
            </div>
            {hasUnpaidBills && (
                <Button size="sm" variant="default" className="w-full h-8 bg-green-600 hover:bg-green-700" onClick={() => onPayBills(booking)}>
                    Pay Bills
                </Button>
            )}
        </CardFooter>
    </Card>
  );
}
