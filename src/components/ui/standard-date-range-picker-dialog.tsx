'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CalendarIcon, X, Calendar as CalendarIconLarge, Check, ArrowRight, RotateCcw } from 'lucide-react';
import { format, isBefore, startOfDay, isSameDay, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-is-mobile';

export interface StandardDateRangePickerProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  disabled?: boolean;
  disabledDates?: { from: Date; to: Date }[];
  placeholder?: string;
  className?: string;
}

export function StandardDateRangePickerDialog({
  date,
  onDateChange,
  disabled = false,
  disabledDates = [],
  placeholder = 'Pick stay dates',
  className,
}: StandardDateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(date);
  const isMobile = useIsMobile();
  const today = startOfDay(new Date());

  React.useEffect(() => {
    setTempRange(date);
  }, [date, isOpen]);

  const bookedDays = React.useMemo(() => {
    return disabledDates.flatMap((range) => {
      const dates = [];
      let currentDate = startOfDay(range.from);
      const endDate = startOfDay(range.to);
      while (currentDate < endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return dates;
    });
  }, [disabledDates]);

  const nightsCount = React.useMemo(() => {
    if (tempRange?.from && tempRange?.to) {
      const diff = differenceInDays(tempRange.to, tempRange.from);
      return Math.max(1, diff);
    }
    return 0;
  }, [tempRange]);

  const handleQuickPreset = (nights: number) => {
    const from = tempRange?.from || today;
    const to = addDays(from, nights);
    setTempRange({ from, to });
  };

  const handleApply = () => {
    onDateChange(tempRange);
    setIsOpen(false);
  };

  const handleReset = () => {
    setTempRange(undefined);
  };

  const formattedLabel = React.useMemo(() => {
    if (!date?.from) return placeholder;
    if (!date.to) return `${format(date.from, 'MMM dd, yyyy')} → Select Check-out`;
    return `${format(date.from, 'MMM dd, yyyy')} - ${format(date.to, 'MMM dd, yyyy')}`;
  }, [date, placeholder]);

  const renderCalendarContent = () => (
    <div className="flex flex-col gap-4 p-1">
      {/* Date Range Overview Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 p-3 border">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Check-in</span>
            <span className="text-sm font-bold text-foreground">
              {tempRange?.from ? format(tempRange.from, 'EEE, MMM dd, yyyy') : 'Select Date'}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Check-out</span>
            <span className="text-sm font-bold text-foreground">
              {tempRange?.to ? format(tempRange.to, 'EEE, MMM dd, yyyy') : 'Select Date'}
            </span>
          </div>
        </div>

        {nightsCount > 0 && (
          <Badge variant="default" className="text-xs font-semibold px-2.5 py-1 bg-primary text-primary-foreground">
            {nightsCount} {nightsCount === 1 ? 'Night' : 'Nights'}
          </Badge>
        )}
      </div>

      {/* Quick Nights Pickers */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-xs text-muted-foreground font-medium shrink-0 mr-1">Quick:</span>
        {[1, 2, 3, 5, 7, 14].map((nights) => (
          <Button
            key={nights}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5 rounded-full shrink-0"
            onClick={() => handleQuickPreset(nights)}
          >
            {nights} {nights === 1 ? 'Night' : 'Nights'}
          </Button>
        ))}
      </div>

      {/* Calendar Picker */}
      <div className="flex justify-center border rounded-xl p-2 bg-background shadow-inner overflow-hidden">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={tempRange?.from || today}
          selected={tempRange}
          onSelect={setTempRange}
          numberOfMonths={isMobile ? 1 : 2}
          disabled={(day) =>
            isBefore(day, today) ||
            bookedDays.some((bookedDay) => isSameDay(day, bookedDay))
          }
          className="rounded-md"
        />
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t mt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Clear
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={!tempRange?.from}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            Apply Stay Dates
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('relative w-full', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={cn(
          'w-full justify-start text-left font-normal h-11 px-3.5 rounded-xl border-slate-300 dark:border-slate-700 hover:border-primary transition-all',
          !date?.from && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="mr-2.5 h-4 w-4 text-primary shrink-0" />
        <span className="truncate flex-1 font-medium text-sm">{formattedLabel}</span>
        {nightsCount > 0 && (
          <Badge variant="secondary" className="ml-2 text-[11px] font-semibold shrink-0">
            {nightsCount}N
          </Badge>
        )}
      </Button>

      {/* Responsive Modal Rendering: Bottom Sheet Drawer on Mobile, Popover/Dialog on Desktop */}
      {isMobile ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="p-4 max-w-lg rounded-t-2xl">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <CalendarIconLarge className="h-5 w-5 text-primary" />
                Select Check-in & Check-out Dates
              </DialogTitle>
            </DialogHeader>
            {renderCalendarContent()}
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 shadow-xl border rounded-2xl" align="start">
            {renderCalendarContent()}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
