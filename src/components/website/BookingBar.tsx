
'use client';

import * as React from 'react';
import { useBooking } from './booking-provider';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, User, Users, Minus, Plus, Search, ShieldCheck, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, eachDayOfInterval, isWithinInterval, startOfDay, endOfDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Room, Booking } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

export function BookingBar() {
  const { openBooking, setAvailableRooms, dateRange, setDateRange } = useBooking();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [guests, setGuests] = React.useState({ adults: 2, children: 0 });
  const [promoCode, setPromoCode] = React.useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const numberOfMonths = isMobile ? 1 : 2;
  const [hasMounted, setHasMounted] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);

  const roomsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'rooms')) : null, [firestore]);
  const { data: rooms, isLoading: areRoomsLoading } = useCollection<Room>(roomsQuery);

  const bookingsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'bookings')) : null, [firestore]);
  const { data: bookings, isLoading: areBookingsLoading } = useCollection<Booking>(bookingsQuery);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleGuestChange = (type: 'adults' | 'children', change: 1 | -1) => {
    setGuests(prev => ({
      ...prev,
      [type]: Math.max(type === 'adults' ? 1 : 0, prev[type] + change),
    }));
  };

  const isAvailabilityCheckLoading = areRoomsLoading || areBookingsLoading;

  const getAvailableRooms = () => {
    if (!dateRange?.from || !dateRange?.to || !rooms || !bookings) return [];

    const selectedRange = { start: startOfDay(dateRange.from), end: startOfDay(dateRange.to) };

    return rooms.filter(roomType => {
      const totalRoomsOfType = roomType.roomNumbers?.length || roomType.totalRooms || 0;
      if (totalRoomsOfType === 0) return false;

      const bookingsForThisRoomType = bookings.filter(b => b.roomId === roomType.id && ['Active', 'Checked-in', 'Booked', 'Reserved'].includes(b.status));

      const daysInSelectedRange = eachDayOfInterval(selectedRange);

      for (const day of daysInSelectedRange) {
        const bookingsOnThisDay = bookingsForThisRoomType.filter(b => {
          const checkIn = getSafeDate(b.checkInDate);
          const checkOut = getSafeDate(b.checkOutDate);
          if (!checkIn || !checkOut) return false;
          return day >= startOfDay(checkIn) && day < startOfDay(checkOut);
        }).length;

        if (bookingsOnThisDay >= totalRoomsOfType) {
          return false;
        }
      }

      return true;
    });
  }

  const handleCheckAvailability = () => {
      if (isAvailabilityCheckLoading || !dateRange?.from || !dateRange?.to) {
          toast({
              variant: 'destructive',
              title: 'Invalid Selection',
              description: 'Please select both a check-in and check-out date.'
          });
          return;
      }

      setIsChecking(true);

      // Simulate a quick search
      setTimeout(() => {
        const available = getAvailableRooms();
        setAvailableRooms(available);

        const resultsSection = document.getElementById('accommodations');
        if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
        setIsChecking(false);
      }, 500);
  }

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setIsDatePickerOpen(false);
    }
  };

  const totalGuests = guests.adults + guests.children;

  if (!hasMounted) {
    return (
        <section className="relative z-30 -mt-20 px-4 sm:px-8">
            <div className="max-w-[1440px] mx-auto bg-white dark:bg-charcoal shadow-2xl rounded-2xl overflow-hidden animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
                    <div className="p-6 md:p-8 border-r border-neutral-200 dark:border-white/10">
                        <Skeleton className="h-3 w-16 mb-3" />
                        <Skeleton className="h-7 w-48" />
                    </div>
                    <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-white/10">
                        <Skeleton className="h-3 w-16 mb-3" />
                        <Skeleton className="h-7 w-24" />
                    </div>
                    <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-white/10">
                        <Skeleton className="h-3 w-16 mb-3" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="md:col-span-2 lg:col-span-1">
                        <Skeleton className="h-full w-full min-h-[96px]" />
                    </div>
                </div>
                 <div className="px-6 py-3 bg-neutral-50 dark:bg-black/20 border-t border-neutral-200 dark:border-white/5">
                     <Skeleton className="h-4 w-48" />
                </div>
            </div>
        </section>
    );
  }

  return (
    <section className="relative z-30 -mt-20 px-4 sm:px-8">
      <div className="max-w-[1440px] mx-auto bg-white dark:bg-charcoal shadow-2xl rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <div className="p-6 md:p-8 group cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-r border-neutral-200 dark:border-white/10">
                <label className="block text-xs uppercase tracking-[0.2em] text-black dark:text-white font-website-display font-extrabold mb-3">Dates</label>
                <div className="flex items-center justify-between">
                  <span className="text-lg md:text-xl font-website-body font-medium tracking-tight">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Select your dates</span>
                    )}
                  </span>
                  <span className="material-symbols-outlined text-neutral-400 group-hover:text-accent-gold">calendar_month</span>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateSelect}
                numberOfMonths={numberOfMonths}
                disabled={{ before: startOfDay(new Date()) }}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <div className="p-6 md:p-8 group cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-t md:border-t-0 md:border-l border-neutral-200 dark:border-white/10">
                <label className="block text-xs uppercase tracking-[0.2em] text-black dark:text-white font-website-display font-extrabold mb-3">Guests</label>
                <div className="flex items-center justify-between">
                  <span className="text-lg md:text-xl font-website-body font-medium tracking-tight">{totalGuests} Guest(s)</span>
                  <span className="material-symbols-outlined text-neutral-400 group-hover:text-accent-gold">expand_more</span>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Adults</p>
                    <p className="text-xs text-muted-foreground">Ages 13 or above</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleGuestChange('adults', -1)}><Minus className="h-4 w-4" /></Button>
                    <span className="font-bold w-4 text-center">{guests.adults}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleGuestChange('adults', 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Children</p>
                    <p className="text-xs text-muted-foreground">Ages below 13</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleGuestChange('children', -1)}><Minus className="h-4 w-4" /></Button>
                    <span className="font-bold w-4 text-center">{guests.children}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleGuestChange('children', 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-white/10">
            <label className="block text-xs uppercase tracking-[0.2em] text-black dark:text-white font-website-display font-extrabold mb-3">Promo</label>
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Promo Code"
              className="bg-transparent border-0 border-b-2 border-neutral-200 dark:border-white/10 rounded-none px-0 focus-visible:ring-0 focus-visible:border-accent-gold text-lg md:text-xl font-website-body font-medium tracking-tight"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-1">
            <button onClick={handleCheckAvailability} disabled={isChecking} className="bg-primary text-white p-6 md:p-8 flex items-center justify-center gap-4 hover:bg-accent-gold transition-colors group w-full h-full disabled:bg-gray-400 disabled:cursor-not-allowed">
                <span className="text-sm font-bold uppercase tracking-widest font-website-display">
                    Check Availability
                </span>
                {isChecking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5 transition-transform group-hover:scale-110" />}
            </button>
          </div>
        </div>
        <div className="px-6 py-3 text-center md:text-left bg-neutral-50 dark:bg-black/20 border-t border-neutral-200 dark:border-white/5">
          <p className="text-sm text-neutral-400 font-bold flex items-center justify-center md:justify-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Terms & Conditions Apply.
          </p>
        </div>
      </div>
    </section>
  );
}
