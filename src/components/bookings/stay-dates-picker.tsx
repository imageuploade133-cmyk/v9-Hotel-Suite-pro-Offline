'use client';

import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { StandardDateRangePickerDialog } from '@/components/ui/standard-date-range-picker-dialog';

interface StayDatesPickerProps {
    date: DateRange | undefined;
    onDateChange: (date: DateRange | undefined) => void;
    disabled?: boolean;
    disabledDates: { from: Date; to: Date }[];
}

export function StayDatesPicker({ date, onDateChange, disabled, disabledDates }: StayDatesPickerProps) {
    return (
        <StandardDateRangePickerDialog
            date={date}
            onDateChange={onDateChange}
            disabled={disabled}
            disabledDates={disabledDates}
            placeholder="Select Check-in & Check-out Dates"
        />
    );
}
