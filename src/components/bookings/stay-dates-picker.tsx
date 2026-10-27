
'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Info } from 'lucide-react';
import { format, isBefore, startOfDay, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/settings-context';
import { DateRange, DayPicker, DayProps, useDayPicker } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '../ui/calendar';

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface StayDatesPickerProps {
    date: DateRange | undefined;
    onDateChange: (date: DateRange | undefined) => void;
    disabled?: boolean;
    disabledDates: { from: Date; to: Date }[];
}

export function StayDatesPicker({ date, onDateChange, disabled, disabledDates }: StayDatesPickerProps) {
    const { settings } = useSettings();
    const { toast } = useToast();
    const today = startOfDay(new Date());

    const bookedDays = React.useMemo(() =>
        disabledDates.flatMap(range => {
            const dates = [];
            let currentDate = startOfDay(range.from);
            while (currentDate < startOfDay(range.to)) {
                dates.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return dates;
        }),
        [disabledDates]
    );

    const checkoutDays = React.useMemo(() =>
        disabledDates.map(range => startOfDay(range.to)),
        [disabledDates]
    );

    const modifiers = {
        booked: bookedDays,
        checkout: checkoutDays,
    };

    const opacity = settings?.calendarColorOpacity ?? 0.2;

    const modifiersStyles = {
        booked: {
            backgroundColor: hexToRgba(settings?.calendarCheckinColor || '#3B82F6', opacity),
            color: settings?.calendarCheckinTextColor || '#000000',
        },
        checkout: {
            backgroundColor: hexToRgba(settings?.calendarCheckoutColor || '#EF4444', opacity),
            color: settings?.calendarCheckoutTextColor || '#000000',
        },
    };

    function CustomDay(props: DayProps) {
        const buttonRef = React.useRef<HTMLButtonElement>(null);
        const dayRender = useDayPicker(props.date, props.displayMonth, buttonRef);

        if (!dayRender) return null;
        const {buttonProps, ...otherDayRender} = dayRender;
        const { activeModifiers } = otherDayRender;

        const isBooked = activeModifiers.booked;
        const isCheckout = activeModifiers.checkout;

        let tooltipText = 'Available for booking';
        if (isBooked) tooltipText = 'Occupied';
        else if (isCheckout) tooltipText = 'Checkout Day (Check-in Unavailable)';
        else if (isBefore(props.date, today)) tooltipText = 'Past date';

        return (

                <Tooltip>
                    <TooltipTrigger asChild>
                         <button
                            {...buttonProps}
                            ref={buttonRef}
                            type="button"
                        >
                            {props.date.getDate()}
                         </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltipText}</p>
                    </TooltipContent>
                </Tooltip>

        );
    }

    return (
        <div className={cn(disabled && 'cursor-not-allowed opacity-70')}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={'outline'}
                        className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                        disabled={disabled}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                                </>
                            ) : (
                                format(date.from, 'LLL dd, y')
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={onDateChange}
                        numberOfMonths={2}
                        disabled={(day) =>
                            isBefore(day, today) ||
                            isSameDay(day, today) ||
                            bookedDays.some(bookedDay => isSameDay(day, bookedDay)) ||
                            checkoutDays.some(checkoutDay => isSameDay(day, checkoutDay))
                        }
                        modifiers={modifiers}
                        modifiersStyles={modifiersStyles}
                        components={{
                            Day: CustomDay
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
