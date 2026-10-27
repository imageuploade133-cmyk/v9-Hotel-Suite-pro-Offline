
'use client';

import * as React from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button, buttonVariants } from '../ui/button';
import { Calendar as CalendarIcon, LayoutGrid, Rows, LogIn, CalendarPlus, CalendarCheck, User as UserIcon, Wallet, DollarSign, Clock, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Booking, Room, BookingType, Bill } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { BookingDetailsDialog } from './booking-details-dialog';
import { BookingTimeline } from './booking-timeline';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isSameDay, startOfDay, isBefore, format, isWithinInterval, setHours, setMinutes, parse, addDays, eachDayOfInterval, getYear, getMonth, setYear, setMonth } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { useDayPicker, type DayProps, type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSettings } from '@/contexts/settings-context';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeRemaining } from './time-remaining';
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { CalendarBookingUI2 } from '../ui/calendar-booking-ui2';

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};


function CalendarView({ rooms, bookings, onDateClick, onRangeSelect, onEventClick }: { rooms: Room[], bookings: Booking[], onDateClick: (date: Date | undefined, type: BookingType) => void, onRangeSelect: (range: DateRange) => void, onEventClick: (booking: Booking) => void }) {
    const { settings } = useSettings();
    const checkoutTime = settings?.checkoutTime || '11:00';
    const firestore = useFirestore();
    const [selectedVacantDate, setSelectedVacantDate] = React.useState<Date | null>(null);

    const formatCurrency = (value: number | undefined) => {
      const currency = settings?.currency || 'USD';
      if (value === undefined) return '...';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(value);
    };

    const getCheckoutDateTime = (date: Date, time: string): Date => {
      try {
          const dateString = format(date, 'yyyy-MM-dd');
          const parsedDate = parse(`${dateString} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
          if (isNaN(parsedDate.getTime())) {
            console.warn(`Invalid time string provided: "${time}". Falling back to 12:00.`);
            return setMinutes(setHours(new Date(date), 12), 0);
          }
          return parsedDate;
      } catch {
          console.warn(`Error parsing date or time. Falling back to 12:00.`);
          return setMinutes(setHours(new Date(date), 12), 0);
      }
    };


    const { bookedDates, checkoutDates } = React.useMemo(() => {
        if (!bookings) return { bookedDates: [], checkoutDates: [] };
        let dates: { date: Date, status: string, booking: Booking }[] = [];
        let checkouts: { date: Date, booking: Booking }[] = [];
        bookings.forEach(booking => {
            const start = getSafeDate(booking.checkInDate);
            const end = getSafeDate(booking.checkOutDate);
            if (!start || !end) return;

            checkouts.push({ date: end, booking });

            let currentDate = new Date(start);
            while (currentDate < end) {
                dates.push({ date: new Date(currentDate), status: booking.status, booking });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });
        return { bookedDates: dates, checkoutDates: checkouts };
    }, [bookings]);


    function DayWithDot(props: DayProps) {
        const { date, displayMonth } = props;
        const dayRender = useDayPicker();

        const buttonRef = React.useRef<HTMLButtonElement>(null);

        if (!dayRender) {
            return <div/>
        }

        if (dayRender.isHidden) {
            return <td />;
        }
        const {buttonProps, ...otherDayRender} = dayRender;

        if (!date) return <td />;

        const bookedDateInfo = bookedDates.find(d => isSameDay(d.date, date));
        const checkoutDateInfo = checkoutDates.find(d => isSameDay(d.date, date));
        const isPast = isBefore(date, startOfDay(new Date()));
        const isBooked = !!bookedDateInfo;
        const isCheckoutDay = !!checkoutDateInfo && !isBooked;

        const isVacant = !isBooked && !isCheckoutDay && !isPast;

        const opacity = settings?.calendarColorOpacity ?? 0.2;
        const quickBookEnabled = settings?.enableCalendarQuickBook ?? true;

        let tooltipContent = "✅ Available for Booking";
        let statusClass = `cursor-pointer`;
        let statusStyle: React.CSSProperties = {};

        if (otherDayRender.selected && !otherDayRender.modifiers?.range_middle) {
             // Let react-day-picker handle selected styles for from/to
        } else if (otherDayRender.modifiers?.range_middle) {
            statusStyle.backgroundColor = hexToRgba(settings?.calendarReservationColor || '#A855F7', 0.5);
            statusStyle.color = settings?.calendarReservationTextColor || '#FFFFFF';
        } else if (isPast) {
            tooltipContent = "Past date";
            statusClass = "opacity-50 cursor-not-allowed bg-muted";
        } else if (isBooked) {
            statusClass += ' cursor-pointer';
            let bgColor: string;

            if (bookedDateInfo.status === 'Booked' || bookedDateInfo.status === 'Reserved') {
                bgColor = settings?.calendarReservationColor || '#A855F7';
                statusStyle.color = settings?.calendarReservationTextColor || '#FFFFFF';
                tooltipContent = "Booked/Reservation";
            } else { // Active stay or Check-in day
                bgColor = settings?.calendarCheckinColor || '#3B82F6';
                statusStyle.color = settings?.calendarCheckinTextColor || '#FFFFFF';
                tooltipContent = "Active / Check-in";
            }
            statusStyle.backgroundColor = hexToRgba(bgColor, opacity);

        } else if (isCheckoutDay) {
            const checkoutBgColor = settings?.calendarCheckoutColor || '#EF4444';
            statusStyle.backgroundColor = hexToRgba(checkoutBgColor, opacity);
            statusStyle.color = settings?.calendarCheckoutTextColor || '#FFFFFF';
            tooltipContent = `👋 Check-out: ${checkoutDateInfo.booking.guestName}`;

        } else { // Vacant
             const vacantBgColor = settings?.calendarVacantColor || '#22C55E';
             statusStyle.backgroundColor = hexToRgba(vacantBgColor, opacity);
             statusStyle.color = settings?.calendarVacantTextColor || '#166534';
        }

        const billsQuery = React.useMemo(() => {
            if (!firestore || !bookedDateInfo) return null;
            return query(collection(firestore, `bookings/${bookedDateInfo.booking.id}/bills`), where('paid', '==', false));
        }, [firestore, bookedDateInfo]);

        const { data: unpaidBills } = useCollection<Bill>(billsQuery);

        const isRoomPaid = bookedDateInfo?.booking?.status === 'Reserved' || !!bookedDateInfo?.booking?.paymentMethod;

        const totalAddedBills = (unpaidBills || []).reduce((acc, bill) => acc + bill.total, 0);

        const totalBillAmount = isRoomPaid
            ? totalAddedBills
            : (bookedDateInfo?.booking?.totalAmount || 0) + totalAddedBills;

        const roomType = rooms.find(r => r.id === bookedDateInfo?.booking.roomId);

        const dayButton = (
             <button {...buttonProps} type="button" ref={buttonRef} className={cn(buttonProps.className, statusClass)} style={statusStyle}>
                {date.getDate()}
             </button>
        );

        const bookingTooltipContent = (
            <TooltipContent className="p-4 w-80">
                {bookedDateInfo?.booking && (
                     <div className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={bookedDateInfo.booking.guestPhotoURL} />
                                    <AvatarFallback>{getInitials(bookedDateInfo.booking.guestName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-base font-semibold">{bookedDateInfo.booking.guestName}</p>
                                     <p className="text-xs text-muted-foreground">{roomType?.name} - Room {bookedDateInfo.booking.roomNumber}</p>
                                    <Badge variant={bookedDateInfo.booking.status === 'Active' || bookedDateInfo.booking.status === 'Checked-in' ? 'success' : 'secondary'} className="text-xs mt-1">{bookedDateInfo.booking.status}</Badge>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => onEventClick(bookedDateInfo.booking)}>
                                Details
                            </Button>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-2"><LogIn className="h-4 w-4"/>Check-in</span>
                                <span className="font-semibold">{format(getSafeDate(bookedDateInfo.booking.checkInDate)!, 'EEEE, PPp')}</span>
                            </div>
                             <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-2"><LogOut className="h-4 w-4"/>Check-out</span>
                                <span className="font-semibold">{format(getCheckoutDateTime(getSafeDate(bookedDateInfo.booking.checkOutDate)!, checkoutTime), 'EEEE, PPp')}</span>
                            </div>
                        </div>
                        <Separator />
                         <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4"/>Total Bill</span>
                                <span className="font-semibold">{formatCurrency(totalBillAmount)}</span>
                         </div>
                         { (bookedDateInfo.booking.status === 'Active' || bookedDateInfo.booking.status === 'Checked-in') && (
                            <TimeRemaining date={getCheckoutDateTime(getSafeDate(bookedDateInfo.booking.checkOutDate)!, checkoutTime)} prefix="Checkout" className="pt-2" />
                         )}
                    </div>
                )}
            </TooltipContent>
        );

        const bookingActionsPopoverContent = (
             <PopoverContent className="w-auto p-1">
                <div className="flex flex-col">
                    <Button variant="ghost" className="justify-start" onClick={() => {onDateClick(date, 'checkin'); setSelectedVacantDate(date);}}>
                        <LogIn className="mr-2 h-4 w-4" /> Check In Now
                    </Button>
                    <Button variant="ghost" className="justify-start" onClick={() => {onDateClick(undefined, 'reservation-and-pay'); setSelectedVacantDate(date);}}>
                        <CalendarPlus className="mr-2 h-4 w-4" /> Paid Reservation
                    </Button>
                    <Button variant="ghost" className="justify-start" onClick={() => {onDateClick(undefined, 'reservation'); setSelectedVacantDate(date);}}>
                        <CalendarCheck className="mr-2 h-4 w-4" /> Unpaid Reservation
                    </Button>
                </div>
            </PopoverContent>
        );

        let cellContent;

        if (isBooked) {
          cellContent = (
              <Tooltip>
                <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
                {bookingTooltipContent}
              </Tooltip>
          );
        } else if (isCheckoutDay) {
          cellContent = (
            <Tooltip>
              <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
              <TooltipContent><p>{tooltipContent}</p></TooltipContent>
            </Tooltip>
          );
        } else if (isVacant && quickBookEnabled) {
          cellContent = (
            <Popover onOpenChange={(open) => { if (!open) setSelectedVacantDate(null)}}>
              <PopoverTrigger asChild>{dayButton}</PopoverTrigger>
              {bookingActionsPopoverContent}
            </Popover>
          );
        } else {
            cellContent = (
                <Tooltip>
                  <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
                  <TooltipContent>
                    <p>{tooltipContent}</p>
                  </TooltipContent>
                </Tooltip>
            );
        }

        return <td {...otherDayRender}>{cellContent}</td>
    }

    return (

            <CalendarBookingUI2
                mode="range"
                numberOfMonths={2}
                onSelect={(range) => range && onRangeSelect(range)}
                components={{ Day: DayWithDot }}
            />

    )
}

function CalendarLegend({ settings }: { settings: any }) {
    const vacantColor = settings?.calendarVacantColor || '#22C55E';
    const checkinColor = settings?.calendarCheckinColor || '#3B82F6';
    const checkoutColor = settings?.calendarCheckoutColor || '#EF4444';
    const reservationColor = settings?.calendarReservationColor || '#A855F7';
    const opacity = settings?.calendarColorOpacity ?? 0.2;

    const legendItems = [
      { label: 'Vacant', color: vacantColor },
      { label: 'Reservation', color: reservationColor },
      { label: 'Check-in / Active Stay', color: checkinColor },
      { label: 'Check-out', color: checkoutColor },
      { label: 'Past Date', color: '#A0A0A0' },
    ];

    return (
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 px-4 py-2 border-t">
        {legendItems.map(item => (
          <div key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className='h-4 w-4 rounded-sm border' style={{ backgroundColor: hexToRgba(item.color, opacity) }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

export function BookingCalendar({ bookings, onDateClick, onRangeSelect }: { bookings: Booking[], onDateClick: (date: Date | undefined, type: BookingType, room?: Room) => void, onRangeSelect: (range: DateRange) => void }) {
  const [viewMode, setViewMode] = React.useState<'timeline' | 'calendar'>('timeline');
  const firestore = useFirestore();
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const { settings } = useSettings();

  const roomsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);

  const { data: rooms, isLoading: areRoomsLoading } = useCollection<Room>(roomsQuery);

  const isLoading = areRoomsLoading;

  const activeGuests = React.useMemo(() => {
    if (!bookings) return [];
    return bookings.filter(b => b.status === 'Active' || b.status === 'Checked-in');
  }, [bookings]);


  return (
    <>
      <Collapsible open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <div
            className="w-full rounded-lg border bg-card p-4 shadow-sm"
            style={{
                backgroundColor: 'hsl(var(--booking-calendar-tab-background))',
                color: 'hsl(var(--booking-calendar-tab-foreground))'
            }}
        >
            <CollapsibleTrigger asChild>
                <div className="flex-1 cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-4">
                    <CalendarIcon className="mr-3 h-5 w-5" />
                    <div>
                        <h4 className="flex items-center text-lg font-semibold">
                        Booking Availability Calendar
                        </h4>
                        <p className="mt-1 text-sm opacity-80">
                        A timeline view of all room bookings.
                        </p>
                    </div>
                    {activeGuests.length > 0 && (
                        <div className="flex items-center -space-x-2">

                            {activeGuests.slice(0, 5).map((guest, i) => (
                                <Tooltip key={guest.id}>
                                    <TooltipTrigger>
                                    <Avatar className="h-8 w-8 border-2 border-background">
                                            <AvatarImage src={guest.guestPhotoURL} alt={guest.guestName} />
                                            <AvatarFallback>{getInitials(guest.guestName)}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{guest.guestName}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                            {activeGuests.length > 5 && (
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Avatar className="h-8 w-8 border-2 border-background">
                                            <AvatarFallback>+{activeGuests.length - 5}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>...and {activeGuests.length - 5} more guests</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                        </div>
                    )}
                    </div>
                    <Button>
                        {isCalendarOpen ? 'Hide Calendar' : 'Show Calendar'}
                    </Button>
                </div>
            </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
            <Card className="mt-2">
            <CardContent className="p-0 sm:p-2">
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'timeline' | 'calendar')} className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="timeline"><Rows className="mr-2 h-4 w-4" />Timeline</TabsTrigger>
                        <TabsTrigger value="calendar"><LayoutGrid className="mr-2 h-4 w-4" />Calendar</TabsTrigger>
                    </TabsList>
                    <TabsContent value="timeline">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4 p-4">
                                <Skeleton className="h-[400px] w-full" />
                            </div>
                            ) : (
                            <BookingTimeline
                                rooms={rooms || []}
                                bookings={bookings || []}
                                onEventClick={(booking) => setSelectedBooking(booking)}
                                onDateClick={onDateClick}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="calendar">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4 p-4">
                                <Skeleton className="h-[400px] w-full" />
                            </div>
                            ) : (
                            <div className="flex justify-center">
                                <CalendarView
                                    rooms={rooms || []}
                                    bookings={bookings}
                                    onDateClick={onDateClick as any}
                                    onRangeSelect={onRangeSelect}
                                    onEventClick={setSelectedBooking}
                                />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CalendarLegend settings={settings} />
            </Card>
        </CollapsibleContent>
      </Collapsible>
      <BookingDetailsDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={() => setSelectedBooking(null)}
        onReassign={onDateClick as any} // Re-using onDateClick for reassign to open dialog
      />
    </>
  );
}
