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

  const formatDisplayDate = () => {
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
  };

  return (
    <div className={cn('page-responsive-actions flex min-w-0 max-w-full flex-wrap items-center gap-2', className)}>
      {isMobile ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="min-h-0 overflow-hidden p-0 sm:max-h-[90dvh] sm:max-w-2xl">
            <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left">
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-5 w-5 text-primary" /> Select Date Range
              </DialogTitle>
              <DialogDescription>Choose the dates to filter your records.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {presetOptions.map(preset => (
                  <Button key={preset.label} type="button" variant="outline" size="sm" className="justify-start" onClick={() => handlePresetSelect(preset)}>
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border bg-background p-1">
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
              {showTimePicker && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
                  <div className="space-y-2">
                    <Label htmlFor="start-time-mobile" className="text-xs text-muted-foreground">Start Time</Label>
                    <Input id="start-time-mobile" type="time" value={startTime} onChange={e => handleTimeChange('start',e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time-mobile" className="text-xs text-muted-foreground">End Time</Label>
                    <Input id="end-time-mobile" type="time" value={endTime} onChange={e => handleTimeChange('end',e.target.value)} />
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <span className="font-medium">{tempDateRange?.from ? format(tempDateRange.from,'MMM dd, yyyy') : 'No start date'}</span>
                {tempDateRange?.to && <span> – {format(tempDateRange.to,'MMM dd, yyyy')}</span>}
                {showTimePicker && <p className="mt-1 text-xs text-muted-foreground">{startTime} – {endTime}</p>}
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t p-4">
              <div className="flex w-full flex-col-reverse gap-2">
                <Button type="button" variant="ghost" onClick={handleClear}>Clear Dates</Button>
                <Button type="button" onClick={handleApply} disabled={!tempDateRange?.from}>Apply Date Range</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>{button}</PopoverTrigger>
          <PopoverContent className="max-h-[min(85dvh,42rem)] max-w-[calc(100vw-1rem)] overflow-auto p-0" align="start" sideOffset={4}>
            <div className="flex max-w-full overflow-x-auto">
              <div className="hidden flex-col border-r bg-muted/30 sm:flex">
                <div className="border-b p-3"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Select</span></div>
                <ScrollArea className="h-[320px] w-[140px]">
                  <div className="space-y-1 p-2">
                    {presetOptions.map(preset => (
                      <Button key={preset.label} variant="ghost" size="sm" className="w-full justify-start text-left text-sm font-normal" onClick={() => handlePresetSelect(preset)}>{preset.label}</Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex min-w-0 flex-col">
                <Calendar initialFocus mode="range" defaultMonth={tempDateRange?.from || new Date()} selected={tempDateRange} onSelect={handleDateSelect} numberOfMonths={2} />
                <div className="border-t">
                  {showTimePicker && (
                    <div className="grid grid-cols-2 gap-4 border-b bg-muted/20 p-4">
                      <div className="space-y-2"><Label htmlFor="start-time" className="text-xs text-muted-foreground">Start Time</Label><Input id="start-time" type="time" value={startTime} onChange={e => handleTimeChange('start',e.target.value)} className="h-9 text-sm" /></div>
                      <div className="space-y-2"><Label htmlFor="end-time" className="text-xs text-muted-foreground">End Time</Label><Input id="end-time" type="time" value={endTime} onChange={e => handleTimeChange('end',e.target.value)} className="h-9 text-sm" /></div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-background p-3">
                    <div className="text-sm">{tempDateRange?.from ? <span className="font-medium">{format(tempDateRange.from,'MMM dd, yyyy')}{tempDateRange.to && ` - ${format(tempDateRange.to,'MMM dd, yyyy')}`}</span> : <span className="text-muted-foreground">No date selected</span>}</div>
                    <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={handleClear}>Clear</Button><Button size="sm" onClick={handleApply} disabled={!tempDateRange?.from}>Apply</Button></div>
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
