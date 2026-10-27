
'use client';

import * as React from 'react';
import {
  Bed,
  Phone,
  Printer,
  FileText,
  DollarSign,
  MoreVertical,
  AlertCircle,
  Wallet,
  User,
  LogOut,
  UserCheck
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';

import type { Booking, Room } from '@/lib/types';
import { getInitials, getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TimeRemaining } from '@/components/bookings/time-remaining';

interface ActiveBookingCardProps {
  booking: Booking;
  onCheckOut: (booking: Booking) => void;
  onViewDetails: (booking: Booking) => void;
  checkoutTime: string;
  onAddBill: (booking: Booking) => void;
  onViewBill: (booking: Booking) => void;
  onPayBills: (booking: Booking) => void;
  rooms?: Room[];
  onToggleCollectPayment: (booking: Booking, collect: boolean) => void;
  onActionsClick: (booking: Booking) => void;
}

export function ActiveBookingCard({
  booking,
  onCheckOut,
  onViewDetails,
  checkoutTime,
  onAddBill,
  onViewBill,
  onPayBills,
  rooms,
  onToggleCollectPayment,
  onActionsClick,
}: ActiveBookingCardProps) {
  const checkInDate = getSafeDate(booking.checkInDate);
  const checkOutDate = getSafeDate(booking.checkOutDate);

  const scheduledCheckoutDate = checkOutDate
    ? getCheckoutDateTime(checkOutDate, checkoutTime)
    : null;

  const isOverdue = scheduledCheckoutDate
    ? isPast(scheduledCheckoutDate)
    : false;
  const totalDays =
    checkInDate && checkOutDate
      ? differenceInDays(checkOutDate, checkInDate)
      : 0;
  const room = rooms?.find((r) => r.id === booking.roomId);

  return (
    <Card
      className={cn('flex flex-col', {
        'border-red-500 bg-red-50 dark:bg-red-900/10': isOverdue,
        'border-green-500 bg-green-50 dark:bg-green-900/10': booking.collectPayment,
      })}
    >
        <CardHeader className="flex-row items-start gap-4 space-y-0">
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12 border-2 border-muted transition-opacity">
              <AvatarImage src={booking.guestPhotoURL} />
              <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
            </Avatar>
            {isOverdue && (
              <div className="absolute -right-1 -top-1 rounded-full bg-destructive p-1">
                <AlertCircle className="h-4 w-4 text-destructive-foreground" />
              </div>
            )}
          </div>
          <div className="flex-grow">
            <CardTitle className="text-xl">{booking.guestName}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Bed className="h-4 w-4" /> Room {booking.roomNumber}
            </CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => onActionsClick(booking)}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>More Actions</TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="flex-grow space-y-4">
          <TimeRemaining
            checkoutDate={scheduledCheckoutDate}
            isOverdue={isOverdue}
          />

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Check-in:</span>
              <span className="font-medium">
                {checkInDate ? format(checkInDate, 'dd-MM-yyyy') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. Check-out:</span>
              <span className="font-medium">
                {checkOutDate ? format(checkOutDate, 'dd-MM-yyyy') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stay:</span>
              <span className="font-medium">
                {totalDays} night{totalDays === 1 ? '' : 's'}
              </span>
            </div>
             {room && (
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Room Type:</span>
                    <span className="font-medium">{room.name}</span>
                </div>
            )}
          </div>

           <div className='flex items-center justify-between rounded-lg border bg-background p-2'>
                <Label htmlFor={`collect-payment-${booking.id}`} className='flex flex-col gap-1'>
                    <span className='font-semibold'>Collect Final Payment?</span>
                    <span className='text-xs text-muted-foreground'>Turn on to notify front-desk to collect payment on checkout.</span>
                </Label>
                <Switch
                    id={`collect-payment-${booking.id}`}
                    checked={!!booking.collectPayment}
                    onCheckedChange={(checked) => onToggleCollectPayment(booking, checked)}
                />
            </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 bg-muted/50 p-2">
          <div className="flex w-full items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onViewDetails(booking)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onAddBill(booking)}
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add to Bill</TooltipContent>
            </Tooltip>
             <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onViewBill(booking)}
                >
                  <Wallet className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Guest Bill</TooltipContent>
            </Tooltip>
             <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onPayBills(booking)}
                >
                 <User className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pay Bills</TooltipContent>
            </Tooltip>
          </div>
          <Button className="w-full" onClick={() => onCheckOut(booking)}>
            <LogOut className="mr-2 h-4 w-4" /> Check Out
          </Button>
        </CardFooter>
    </Card>
  );
}
