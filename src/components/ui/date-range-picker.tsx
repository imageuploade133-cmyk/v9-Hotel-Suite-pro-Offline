'use client';

import * as React from 'react';
import { format, setHours, setMinutes, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar as CalendarIcon, X, ChevronDown } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Input } from './input';
import { Label } from './label';
import { ScrollArea } from './scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  disabled?: boolean;
  showTimePicker?: boolean;
}

type PresetOption = {
  label: string;
  value: () => DateRange;
};

export function DateRangePicker({
  className,
  date,
  onDateChange,
  disabled,
  showTimePicker = true
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const [startTime, setStartTime] = React.useState('00:00');
  const [endTime, setEndTime] = React.useState('23:59');
  const [tempDateRange, setTempDateRange] = React.useState<DateRange | undefined>(date);

  // Sync temp date with prop date when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setTempDateRange(date);
      if (date?.from) {
        setStartTime(format(date.from, 'HH:mm'));
      }
      if (date?.to) {
        setEndTime(format(date.to, 'HH:mm'));
      }
    }
  }, [isOpen, date]);

  const presetOptions: PresetOption[] = [
    {
      label: 'Today',
      value: () => ({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Yesterday',
      value: () => ({
        from: startOfDay(subDays(new Date(), 1)),
        to: endOfDay(subDays(new Date(), 1)),
      }),
    },
    {
      label: 'Last 7 days',
      value: () => ({
        from: startOfDay(subDays(new Date(), 6)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 30 days',
      value: () => ({
        from: startOfDay(subDays(new Date(), 29)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'This week',
      value: () => ({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
      }),
    },
    {
      label: 'This month',
      value: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
  ];

  const handlePresetSelect = (preset: PresetOption) => {
    const range = preset.value();
    setTempDateRange(range);

    // Apply current time settings to the preset range
    let { from, to } = range;
    if (from && showTimePicker) {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      from = setMinutes(setHours(from, startHours), startMinutes);
    }
    if (to && showTimePicker) {
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      to = setMinutes(setHours(to, endHours), endMinutes);
    }

    onDateChange({ from, to });
    setIsOpen(false);
  };

  const handleDateSelect = (selectedDate: DateRange | undefined) => {
    if (!selectedDate) {
      setTempDateRange(undefined);
      return;
    }

    let { from, to } = selectedDate;

    if (from && showTimePicker) {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      from = setMinutes(setHours(from, startHours), startMinutes);
    }
    if (to && showTimePicker) {
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      to = setMinutes(setHours(to, endHours), endMinutes);
    } else if (from && showTimePicker && !to) {
      // If only 'from' is selected, set 'to' to end of that day
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      to = setMinutes(setHours(from, endHours), endMinutes);
    }

    const newRange = { from, to };
    setTempDateRange(newRange);
  };

  const handleTimeChange = (type: 'start' | 'end', time: string) => {
    const parts = time.split(':').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      if (type === 'start') {
        setStartTime(time);
      } else {
        setEndTime(time);
      }
      return;
    }

    const [hours, minutes] = parts;

    if (type === 'start') {
      setStartTime(time);
      if (tempDateRange?.from) {
        const newFrom = setMinutes(setHours(tempDateRange.from, hours), minutes);
        setTempDateRange({ ...tempDateRange, from: newFrom });
      }
    } else {
      setEndTime(time);
      if (tempDateRange?.to) {
        const newTo = setMinutes(setHours(tempDateRange.to, hours), minutes);
        setTempDateRange({ ...tempDateRange, to: newTo });
      }
    }
  };

  const handleApply = () => {
    onDateChange(tempDateRange);
    setIsOpen(false);
  };

  const handleClear = () => {
    onDateChange(undefined);
    setTempDateRange(undefined);
    setStartTime('00:00');
    setEndTime('23:59');
  };

  const button = (
    <Button
      id="date"
      type="button"
      variant="outline"
      className={cn(
        'h-10 w-full min-w-0 max-w-full justify-between rounded-lg border border-border/80 bg-background px-3.5 py-2 text-left font-normal shadow-sm transition-all hover:border-primary/50 hover:bg-muted/40 sm:min-w-[280px] sm:w-auto',
        !date && 'text-muted-foreground'
      )}
      disabled={disabled}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">{formatDisplayDate()}</span>
      </span>
      <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground opacity-60" />
    </Button>
  );

  function formatDisplayDate() {
    if (!date?.from) return 'Pick a date range';

    if (date.to) {
      const sameDay = format(date.from, 'yyyy-MM-dd') === format(date.to, 'yyyy-MM-dd');
      if (sameDay) {
        if (showTimePicker) {
          return `${format(date.from, 'MMM dd, yyyy')} (${format(date.from, 'HH:mm')} - ${format(date.to, 'HH:mm')})`;
        }
        return format(date.from, 'MMM dd, yyyy');
      }
      return `${format(date.from, 'MMM dd, yyyy')} - ${format(date.to, 'MMM dd, yyyy')}`;
    }

    return format(date.from, 'MMM dd, yyyy');
  }

  return (
    <div className={cn('page-responsive-actions flex min-w-0 max-w-full flex-wrap items-center gap-2', className)}>
      {isMobile ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            {button}
          </DialogTrigger>
          <DialogContent className="fixed inset-0 flex h-full w-full max-h-none max-w-none flex-col overflow-hidden border-0 p-0 sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl sm:border">
            <DialogHeader className="shrink-0 border-b bg-background/95 px-5 py-4 pr-12 text-left backdrop-blur-sm">
              <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <span>Select Date Range</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pick start and end dates or choose a quick preset.
              </DialogDescription>
            </DialogHeader>

            {/* Quick Horizontal Presets */}
            <div className="shrink-0 border-b bg-muted/20 px-4 py-2.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {presetOptions.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-full border-border/70 px-3.5 text-xs font-medium hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 overscroll-contain">
              {/* Calendar Container */}
              <div className="rounded-2xl border border-border/80 bg-background p-2 shadow-sm">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={tempDateRange?.from || new Date()}
                  selected={tempDateRange}
                  onSelect={handleDateSelect}
                  numberOfMonths={1}
                  className="mx-auto max-w-full"
                />
              </div>

              {/* Time Selection */}
              {showTimePicker && (
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/80 bg-muted/25 p-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="start-time-mobile" className="text-xs font-semibold text-muted-foreground">
                      Start Time
                    </Label>
                    <Input
                      id="start-time-mobile"
                      type="time"
                      value={startTime}
                      onChange={(e) => handleTimeChange('start', e.target.value)}
                      className="h-9 rounded-lg border-border/80 bg-background text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end-time-mobile" className="text-xs font-semibold text-muted-foreground">
                      End Time
                    </Label>
                    <Input
                      id="end-time-mobile"
                      type="time"
                      value={endTime}
                      onChange={(e) => handleTimeChange('end', e.target.value)}
                      className="h-9 rounded-lg border-border/80 bg-background text-sm font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Selection Summary Pill */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Selected Period</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {tempDateRange?.from ? format(tempDateRange.from, 'MMM dd, yyyy') : 'Pick start date'}
                    {tempDateRange?.to && ` → ${format(tempDateRange.to, 'MMM dd, yyyy')}`}
                  </span>
                  {showTimePicker && (
                    <span className="rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {startTime} - {endTime}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-background/95 p-4 backdrop-blur-sm">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  className="rounded-xl border-border/80 hover:bg-muted"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={!tempDateRange?.from}
                  className="rounded-xl font-medium shadow-sm"
                >
                  Apply Range
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>{button}</PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border border-border/80 p-0 shadow-2xl"
            align="start"
            sideOffset={6}
          >
            <div className="flex max-w-full">
              {/* Presets Sidebar */}
              <div className="hidden w-40 flex-col border-r border-border/80 bg-muted/20 sm:flex">
                <div className="border-b border-border/80 px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Quick Presets
                  </span>
                </div>
                <div className="flex-1 space-y-1 p-2">
                  {presetOptions.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start rounded-lg text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      onClick={() => handlePresetSelect(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Calendars & Bottom Bar */}
              <div className="flex min-w-0 flex-col">
                <div className="p-2">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={tempDateRange?.from || new Date()}
                    selected={tempDateRange}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                  />
                </div>

                <div className="border-t border-border/80 bg-muted/10">
                  {showTimePicker && (
                    <div className="grid grid-cols-2 gap-4 border-b border-border/80 bg-background/50 px-4 py-3">
                      <div className="space-y-1">
                        <Label htmlFor="start-time" className="text-xs font-medium text-muted-foreground">
                          Start Time
                        </Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={startTime}
                          onChange={(e) => handleTimeChange('start', e.target.value)}
                          className="h-8 rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="end-time" className="text-xs font-medium text-muted-foreground">
                          End Time
                        </Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={endTime}
                          onChange={(e) => handleTimeChange('end', e.target.value)}
                          className="h-8 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 bg-background px-4 py-3">
                    <div className="text-xs">
                      {tempDateRange?.from ? (
                        <span className="font-semibold text-foreground">
                          {format(tempDateRange.from, 'MMM dd, yyyy')}
                          {tempDateRange.to && ` → ${format(tempDateRange.to, 'MMM dd, yyyy')}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No range selected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-8 rounded-lg px-3 text-xs"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApply}
                        disabled={!tempDateRange?.from}
                        className="h-8 rounded-lg px-4 text-xs font-medium shadow-sm"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {date?.from && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleClear}
          title="Clear date filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
