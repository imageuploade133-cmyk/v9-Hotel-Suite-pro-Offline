'use client';

import * as React from 'react';
import { format, setHours, setMinutes, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar as CalendarIcon, X, Clock, ChevronDown } from 'lucide-react';
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
    <div className={cn('flex min-w-0 max-w-full flex-wrap items-center gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full min-w-0 max-w-full justify-between text-left font-normal hover:bg-accent sm:min-w-[280px] sm:w-auto',
              !date && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{formatDisplayDate()}</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="max-h-[min(85dvh,42rem)] max-w-[calc(100vw-1rem)] overflow-auto p-0"
          align="start"
          sideOffset={4}
        >
          <div className="flex max-w-full overflow-x-auto">
            {/* Presets Sidebar */}
            <div className="hidden sm:flex flex-col border-r bg-muted/30">
              <div className="p-3 border-b">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Select
                </span>
              </div>
              <ScrollArea className="h-[320px] w-[140px]">
                <div className="p-2 space-y-1">
                  {presetOptions.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left text-sm font-normal hover:bg-accent"
                      onClick={() => handlePresetSelect(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Calendar Section */}
            <div className="flex min-w-0 flex-col">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={tempDateRange?.from || new Date()}
                selected={tempDateRange}
                onSelect={handleDateSelect}
                numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
                className="[&_.day-range-end]:rounded-r-md [&_.day-range-start]:rounded-l-md"
              />

              {/* Time and Actions Section */}
              <div className="border-t">
                {showTimePicker && (
                  <div className="p-4 border-b bg-muted/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Time Range</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                          Start Time
                        </Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={startTime}
                          onChange={(e) => handleTimeChange('start', e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                          End Time
                        </Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={endTime}
                          onChange={(e) => handleTimeChange('end', e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Range Display & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-background p-3">
                  <div className="text-sm">
                    {tempDateRange?.from ? (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {format(tempDateRange.from, 'MMM dd, yyyy')}
                          {tempDateRange.to && ` - ${format(tempDateRange.to, 'MMM dd, yyyy')}`}
                        </span>
                        {showTimePicker && (
                          <span className="text-xs text-muted-foreground">
                            {startTime} - {endTime}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No date selected</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClear}
                      disabled={!tempDateRange?.from}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApply}
                      disabled={!tempDateRange?.from}
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
