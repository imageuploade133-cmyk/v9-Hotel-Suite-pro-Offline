'use client';

import * as React from 'react';
import { formatDistanceToNow, differenceInMinutes, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';

interface TimeRemainingProps {
  date: Date | string | null | undefined;
  prefix: 'Check-in' | 'Checkout';
  className?: string;
  initialDurationMinutes?: number;
}

export function TimeRemaining({ date, prefix, className, initialDurationMinutes = 24 * 60 }: TimeRemainingProps) {
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // New guard clause to prevent crash on invalid date
  if (!date) {
    return null;
  }

  const dateObj = new Date(date);

  if (!isValid(dateObj)) {
    // console.warn(`Invalid date prop passed to TimeRemaining: ${date}`);
    return null;
  }

  const distance = formatDistanceToNow(dateObj, { addSuffix: true });
  const minutesRemaining = differenceInMinutes(dateObj, now);
  const totalMinutes = initialDurationMinutes;

  const progress = Math.max(0, Math.min(100, (minutesRemaining / totalMinutes) * 100));

  const isPast = minutesRemaining < 0;
  const isSoon = !isPast && minutesRemaining < 60; // Less than 1 hour

  const progressColorClass = isPast ? 'bg-destructive' : isSoon ? 'bg-yellow-500' : 'bg-primary';

  return (
    <div className={cn("space-y-1", className)}>
        <p className={cn(
            "text-sm font-medium",
            isPast && "text-destructive",
            isSoon && "text-yellow-600"
        )}>
            {prefix} {distance}
        </p>
         <Progress value={progress} indicatorClassName={progressColorClass} />
    </div>
  );
}
