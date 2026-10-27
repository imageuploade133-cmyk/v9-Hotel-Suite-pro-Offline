'use client';

import * as React from 'react';
import type { Booking, Room, BookingType, Bill } from '@/lib/types';
import { eachDayOfInterval, addDays, format, differenceInDays, isSameDay, startOfDay, getYear, getMonth, setYear, setMonth, isBefore, setHours, setMinutes, parse } from 'date-fns';
import { Button, buttonVariants } from '../ui/button';
import { ChevronLeft, ChevronRight, BedDouble, CalendarCheck, CalendarPlus, Wallet, ChevronDown, User as UserIcon, Mail, Phone, LogIn, LogOut, DollarSign, Clock } from 'lucide-react';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSettings } from '@/contexts/settings-context';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getSafeDate, getInitials, getCheckoutDateTime } from '@/lib/helpers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TimeRemaining } from './time-remaining';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import * as TooltipPrimitive from "@radix-ui/react-tooltip"


const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface BookingTimelineProps {
  rooms: Room[];
  bookings: Booking[];
  onEventClick: (booking: Booking) => void;
  onDateClick: (date: Date | undefined, type: BookingType, room?: Room) => void;
}

const BookingEvent = ({ booking, onEventClick, day, roomType }: { booking: Booking, onEventClick: (booking: Booking) => void, day: Date, roomType: Room | undefined }) => {
    const { settings } = useSettings();
    const checkoutTime = settings?.checkoutTime || '12:00';
    const firestore = useFirestore();

    const billsQuery = React.useMemo(() => {
        if (!firestore || !booking) return null;
        return query(collection(firestore, `bookings/${booking.id}/bills`), where('paid', '==', false));
    }, [firestore, booking]);
    const { data: unpaidBills } = useCollection<Bill>(billsQuery);

    const isRoomPaid = booking?.status === 'Reserved' || !!booking?.paymentMethod;

    const totalAddedBills = (unpaidBills || []).reduce((acc, bill) => acc + bill.total, 0);

    const totalBillAmount = isRoomPaid
        ? totalAddedBills
        : (booking?.amount || 0) + totalAddedBills;

    const formatCurrency = (value: number | undefined, currency: string = 'USD') => {
      if (value === undefined) return '...';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(value);
    };

    const guestName = booking.guestName;

    const isCheckout = isSameDay(getSafeDate(booking.checkOutDate)!, day);

    const { color, textColor } = React.useMemo(() => {
        let hexColor: string;
        let hexTextColor: string;

        if (booking.status === 'Booked' || booking.status === 'Reserved') {
            hexColor = settings?.calendarReservationColor || '#A855F7';
            hexTextColor = settings?.calendarReservationTextColor || '#FFFFFF';
        } else if (booking.status === 'Active' || booking.status === 'Checked-in') {
            hexColor = settings?.calendarCheckinColor || '#3B82F6';
            hexTextColor = settings?.calendarCheckinTextColor || '#FFFFFF';
        } else if (isCheckout) {
            hexColor = settings?.calendarCheckoutColor || '#EF4444';
            hexTextColor = settings?.calendarCheckoutTextColor || '#FFFFFF';
        } else {
            hexColor = settings?.calendarCheckinColor || '#3B82F6';
            hexTextColor = settings?.calendarCheckinTextColor || '#FFFFFF';
        }
        return {
            color: hexColor,
            textColor: hexTextColor,
        }
    }, [booking.status, settings, isCheckout]);


    return (
        <Tooltip>
            <TooltipTrigger asChild>
                 <button onClick={() => onEventClick(booking)} className="flex items-center gap-2 w-full h-full px-2" style={{ backgroundColor: color, color: textColor }}>
                    <Avatar className="h-8 w-8 border-2" style={{ borderColor: hexToRgba(textColor, 0.5)}}>
                        <AvatarImage src={booking.guestPhotoURL} alt={booking.guestName} />
                        <AvatarFallback style={{backgroundColor: color, color: textColor}}><UserIcon /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-xs font-bold break-words text-left">
                          {guestName}
                        </p>
                        <div className="flex items-center gap-1 text-xs opacity-80 whitespace-nowrap">
                            {(booking.status === 'Booked' || booking.status === 'Reserved') && <CalendarCheck className="h-3 w-3" />}
                            {(booking.status === 'Active' || booking.status === 'Checked-in') && <LogIn className="h-3 w-3" />}
                            <span>
                                {(booking.status === 'Booked' || booking.status === 'Reserved') ? 'Booked' : 'Active'}
                            </span>
                        </div>
                    </div>
                </button>
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
                <TooltipContent className="p-4 w-80">
                <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={booking.guestPhotoURL} />
                                <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-base font-semibold">{booking.guestName}</p>
                                {roomType && <p className="text-xs text-muted-foreground">{roomType.name} - Room {booking.roomNumber}</p>}
                                <Badge variant={booking.status === 'Active' || booking.status === 'Checked-in' ? 'success' : 'secondary'} className="text-xs mt-1">{booking.status}</Badge>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onEventClick(booking)}>
                            Details
                        </Button>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2"><LogIn className="h-4 w-4"/>Check-in</span>
                            <span className="font-semibold">{format(getSafeDate(booking.checkInDate)!, 'EEEE, dd-MM-yyyy, p')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2"><LogOut className="h-4 w-4"/>Check-out</span>
                            <span className="font-semibold">{format(getCheckoutDateTime(getSafeDate(booking.checkOutDate)!, checkoutTime), 'EEEE, dd-MM-yyyy, p')}</span>
                        </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4"/>Total Bill</span>
                        <span className="font-semibold">{formatCurrency(totalBillAmount, settings?.currency)}</span>
                    </div>
                    { (booking.status === 'Active' || booking.status === 'Checked-in') && (
                        <TimeRemaining date={getCheckoutDateTime(getSafeDate(booking.checkOutDate)!, checkoutTime)} prefix="Checkout" className="pt-2" />
                    )}
                </div>
                </TooltipContent>
            </TooltipPrimitive.Portal>
        </Tooltip>
    )
}

export function BookingTimeline({ rooms, bookings, onEventClick, onDateClick }: BookingTimelineProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [duration, setDuration] = React.useState<number>(7);
  const [yearToConfirm, setYearToConfirm] = React.useState<number | null>(null);
  const { settings } = useSettings();
  const [isMobile, setIsMobile] = React.useState(false);
  const quickBookEnabled = settings?.enableCalendarQuickBook ?? true;

  const { toast } = useToast();

  React.useEffect(() => {
    const handleResize = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (mobile) {
            setDuration(3);
        } else if (window.innerWidth < 1280) {
            setDuration(7);
        } else {
            setDuration(14);
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatCurrency = (value: number | undefined, currency: string = 'USD') => {
    if (value === undefined) return '...';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };


  const handlePrev = () => {
    setCurrentDate(prev => addDays(prev, -duration));
  };

  const handleNext = () => {
    setCurrentDate(prev => addDays(prev, duration));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  }

  const { startDate, endDate, days } = React.useMemo(() => {
    const start = startOfDay(currentDate);
    const end = addDays(start, duration - 1);

    const intervalDays = eachDayOfInterval({ start, end });
    return { startDate: start, endDate: end, days: intervalDays };
  }, [currentDate, duration]);

  const handleMonthChange = (monthValue: string) => {
      const monthIndex = parseInt(monthValue, 10);
      setCurrentDate(prevDate => setMonth(prevDate, monthIndex));
  };

  const handleYearChange = (yearValue: string) => {
      const year = parseInt(yearValue, 10);
      if (year !== getYear(currentDate)) {
        setYearToConfirm(year);
      }
  };

  const confirmYearChange = () => {
    if (yearToConfirm !== null) {
      setCurrentDate(prevDate => setYear(prevDate, yearToConfirm));
    }
    setYearToConfirm(null);
  };

  const handleDurationChange = (durationValue: string) => {
    setDuration(parseInt(durationValue, 10));
  };


  const currentYear = getYear(new Date());
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: format(new Date(2000, i, 1), 'MMMM'),
  }));

  const durationOptions = [
    { value: '7', label: '1 Week' },
    { value: '14', label: '2 Weeks' },
    { value: '30', label: '1 Month' },
  ];

  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));
   const activeGuests = React.useMemo(() => {
    if (!bookings) return [];
    return bookings.filter(b => b.status === 'Active' || b.status === 'Checked-in');
  }, [bookings]);

  const opacity = settings?.calendarColorOpacity ?? 0.2;

  return (

      <div className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={handleToday}>Today</Button>
                <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                <span className="font-semibold text-lg hidden sm:block ml-4">
                    {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
                </span>
            </div>
            {!isMobile && (
                <div className="flex items-center gap-2">
                    <Select value={String(getMonth(currentDate))} onValueChange={handleMonthChange}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {monthOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={String(getYear(currentDate))} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(year => (
                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={String(duration)} onValueChange={handleDurationChange}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="View" />
                        </SelectTrigger>
                        <SelectContent>
                            {durationOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
        <ScrollArea className="w-full">
          <div className="relative">
            <div style={{ gridTemplateColumns: `140px repeat(${days.length}, 1fr)` }} className="grid min-w-[1200px]">
              {/* Header row for dates */}
              <div className="sticky left-0 top-0 z-10 p-2 font-normal text-center border-b border-r bg-muted">Room Type</div>
              {days.map(day => (
                  <div key={day.toString()} className={cn("p-2 text-center border-b sticky top-0 z-10 bg-background", isSameDay(day, new Date()) && 'bg-primary/10 border-b-2 border-b-primary')}>
                  <div className="text-sm font-semibold">{format(day, 'E')}</div>
                  <div className="text-lg">{format(day, 'd')}</div>
                  </div>
              ))}
            </div>

            <div className="relative">
                {sortedRooms.map((roomType, index) => {
                    const bookingsForType = bookings.filter(b => b.roomId === roomType.id);
                    const roomNumbersForType = roomType.roomNumbers || [];
                    const activeGuestsForType = bookingsForType.filter(b => b.status === 'Active' || b.status === 'Checked-in');

                    return (
                    <Collapsible key={roomType.id} defaultOpen={index < 2}>
                        <div style={{ gridTemplateColumns: `140px repeat(${days.length}, 1fr)` }} className="grid min-w-[1200px]">
                            <CollapsibleTrigger asChild>
                                <div className="sticky left-0 z-10 flex items-center justify-between p-2 text-center border-b border-r bg-muted col-span-full cursor-pointer hover:bg-muted/80">
                                    <div className="flex items-center gap-2">
                                        <BedDouble className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-normal">{roomType.name}</span>
                                        {quickBookEnabled && (

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDateClick(undefined, 'reservation', roomType)}}>
                                                            <CalendarPlus className="h-4 w-4 text-primary" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Make Reservation</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                        )}
                                        {activeGuestsForType.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className={cn("flex items-center -space-x-2 ml-2", activeGuestsForType.length > 0 && "blinking-red-badge")}>

                                                        {activeGuestsForType.slice(0, 5).map((guest) => (
                                                            <Tooltip key={guest.id}>
                                                                <TooltipTrigger>
                                                                    <Avatar className="h-6 w-6 border-2 border-background">
                                                                        <AvatarImage src={guest.guestPhotoURL} alt={guest.guestName} />
                                                                        <AvatarFallback>{getInitials(guest.guestName)}</AvatarFallback>
                                                                    </Avatar>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{guest.guestName}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ))}
                                                        {activeGuestsForType.length > 5 && (
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <Avatar className="h-6 w-6 border-2 border-background">
                                                                        <AvatarFallback>+{activeGuestsForType.length - 5}</AvatarFallback>
                                                                    </Avatar>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>...and {activeGuestsForType.length - 5} more guests</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}

                                                </div>
                                                <span className="text-xs font-semibold animate-blink-text">
                                                    ({activeGuestsForType.length} Active)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </div>
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                            <div className="relative">
                                <div style={{ gridTemplateColumns: `140px repeat(${days.length}, 1fr)` }} className="grid min-w-[1200px]">
                                    {(roomNumbersForType).map((roomNumber, roomIndex) => {
                                      const bookingsForThisRoom = bookingsForType.filter(b => b.roomNumber === roomNumber);
                                      const hasActiveCheckoutToday = bookingsForThisRoom.some(b => (b.status === 'Active' || b.status === 'Checked-in') && isSameDay(getSafeDate(b.checkOutDate)!, new Date()));

                                      return (
                                        <React.Fragment key={roomNumber}>
                                            <div className={cn("sticky left-0 z-10 flex items-center justify-center p-2 font-semibold text-center border-b border-r", roomIndex % 2 === 0 ? 'bg-card' : 'bg-muted/50')}>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-sm">Room {roomNumber}</span>
                                                </div>
                                            </div>
                                            {days.map((day, dayIndex) => {
                                                const bookingOnThisDay = bookingsForThisRoom.find(b => {
                                                    const checkIn = getSafeDate(b.checkInDate);
                                                    const checkOut = getSafeDate(b.checkOutDate);
                                                    return checkIn && checkOut && day >= startOfDay(checkIn) && day < checkOut;
                                                });

                                                const checkoutOnThisDay = bookingsForThisRoom.find(b => {
                                                  const checkOut = getSafeDate(b.checkOutDate);
                                                  return checkOut && isSameDay(checkOut, day);
                                                });

                                                const isBooked = !!bookingOnThisDay;
                                                const isCheckoutDay = !!checkoutOnThisDay && !bookingOnThisDay;
                                                const isPast = isBefore(day, startOfDay(new Date()));

                                                let bgColor = 'transparent';
                                                let textColor = 'inherit';

                                                if (isCheckoutDay) {
                                                    bgColor = hexToRgba(settings?.calendarCheckoutColor || '#EF4444', opacity);
                                                    textColor = settings?.calendarCheckoutTextColor || '#FFFFFF';
                                                } else if (isBooked) {
                                                     const vacantBgColor = settings?.calendarVacantColor || '#22C55E';
                                                     bgColor = hexToRgba(vacantBgColor, opacity);
                                                     textColor = settings?.calendarVacantTextColor || '#166534';
                                                } else if (!isPast) {
                                                    const vacantBgColor = settings?.calendarVacantColor || '#22C55E';
                                                    bgColor = hexToRgba(vacantBgColor, opacity);
                                                    textColor = settings?.calendarVacantTextColor || '#166534';
                                                }

                                                const popoverContent = (
                                                  <PopoverContent className="w-auto p-1">
                                                    <div className="flex flex-col">
                                                      <Button variant="ghost" className="justify-start" onClick={() => onDateClick(day, 'checkin', { ...roomType, roomNumber } as Room)}>
                                                          <LogIn className="mr-2 h-4 w-4" /> Check In Now
                                                      </Button>
                                                      <Button variant="ghost" className="justify-start" onClick={() => onDateClick(undefined, 'reservation-and-pay', { ...roomType, roomNumber } as Room)}>
                                                          <CalendarPlus className="mr-2 h-4 w-4" /> Paid Reservation
                                                      </Button>
                                                      <Button variant="ghost" className="justify-start" onClick={() => onDateClick(undefined, 'reservation', { ...roomType, roomNumber } as Room)}>
                                                          <CalendarCheck className="mr-2 h-4 w-4" /> Unpaid Reservation
                                                      </Button>
                                                    </div>
                                                  </PopoverContent>
                                                );

                                                const isCellDisabled = isPast || isBooked || isCheckoutDay;


                                                return (
                                                  <Popover key={day.toISOString()}>
                                                    <PopoverTrigger asChild disabled={isCellDisabled || !quickBookEnabled}>
                                                      <div
                                                        onClick={(e) => {
                                                          if (isCellDisabled) {
                                                            e.preventDefault();
                                                            const message = isBooked ? 'This date is occupied.' : isCheckoutDay ? 'This is a checkout day and not available for check-in.' : 'Cannot book past dates.';
                                                            toast({ variant: 'destructive', title: 'Date Unavailable', description: message });
                                                          } else if (!quickBookEnabled) {
                                                            e.preventDefault();
                                                            onDateClick(undefined, 'reservation', { ...roomType, roomNumber } as Room);
                                                          }
                                                        }}
                                                        style={{ backgroundColor: bgColor, color: textColor }}
                                                        className={cn(
                                                          "border-b border-r h-16 transition-colors group flex items-center justify-center p-1 border-black/10 dark:border-white/10",
                                                          !isCellDisabled && `hover:opacity-70 cursor-pointer`,
                                                          isCellDisabled && 'cursor-not-allowed',
                                                          isBooked && 'cursor-pointer hover:opacity-80'
                                                        )}
                                                      >
                                                        {isBooked ? (
                                                            <BookingEvent booking={bookingOnThisDay} onEventClick={onEventClick} day={day} roomType={roomType} />
                                                        ) : !isPast && !isCheckoutDay && quickBookEnabled ? (
                                                          <div className="flex flex-col items-center transition-opacity">
                                                            <CalendarPlus className="h-5 w-5" />
                                                            <span className="text-xs font-semibold">Vacant</span>
                                                          </div>
                                                        ) : isCheckoutDay ? (
                                                            <div className="flex flex-col items-center transition-opacity text-xs font-semibold">
                                                              <LogOut className="h-4 w-4" />
                                                              <span>Checkout</span>
                                                            </div>
                                                        ) : null}
                                                      </div>
                                                    </PopoverTrigger>
                                                    {!isCellDisabled && quickBookEnabled && popoverContent}
                                                  </Popover>
                                                );
                                            })}
                                        </React.Fragment>
                                      );
                                    })}
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                    )
                })}
            </div>
        </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <AlertDialog open={!!yearToConfirm} onOpenChange={() => setYearToConfirm(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    You are about to jump to the year {yearToConfirm}. This will change
                    your current calendar view.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirmYearChange}
                        className={cn(buttonVariants({ variant: "destructive" }))}
                    >
                    Yes, change year
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>

  );
}
