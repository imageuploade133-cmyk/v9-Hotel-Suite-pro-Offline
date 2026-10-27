'use client'

import { ColumnDef } from "@tanstack/react-table"
import type { StockAuditLog, UserProfile, Settings } from "@/lib/types";
import { format, parse, addMinutes, isAfter, setHours, setMinutes } from "date-fns"
import { getSafeDate } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import React from "react";

const getStatus = (log: StockAuditLog, user: UserProfile | undefined, settings: Settings | null): { status: 'On Time' | 'Late' | 'On Duty', variant: 'success' | 'destructive' | 'secondary' } => {
    const loginTime = getSafeDate(log.timestamp);
    if (!loginTime || !user) return { status: 'Late', variant: 'destructive' };

    const shift = user.shift;
    const shiftSettings = settings?.shiftSettings;

    if (!shift || !shiftSettings) {
        return { status: 'On Time', variant: 'success' };
    }

    let workStartTime: string;
    let gracePeriod: number;

    if (shift === 'Morning') {
        workStartTime = shiftSettings.morning.startTime || '09:00';
        gracePeriod = shiftSettings.morning.lateGracePeriod || 5;
    } else if (shift === 'Night') {
        workStartTime = shiftSettings.night.startTime || '21:00';
        gracePeriod = shiftSettings.night.lateGracePeriod || 5;
    } else { // 24hrs shift
        if (shiftSettings.twentyFourHours?.trackLateness && shiftSettings.twentyFourHours.lateAfterTime) {
            workStartTime = shiftSettings.twentyFourHours.lateAfterTime;
            gracePeriod = 0; // No grace period for this logic
        } else {
            return { status: 'On Duty', variant: 'secondary' };
        }
    }

    const [startHours, startMinutes] = workStartTime.split(':').map(Number);
    const workStartToday = setMinutes(setHours(new Date(loginTime), startHours), startMinutes);

    const deadline = addMinutes(workStartToday, gracePeriod);

    if (isAfter(loginTime, deadline)) {
        return { status: 'Late', variant: 'destructive' };
    } else {
        return { status: 'On Time', variant: 'success' };
    }
}

type UseColumnsProps = {
    settings: Settings | null;
    userMap: Map<string, UserProfile>;
}

export const useWorkingHrsColumns = ({ settings, userMap }: UseColumnsProps): ColumnDef<StockAuditLog>[] => React.useMemo(() => [
    {
        accessorKey: 'timestamp',
        header: 'Date & Time',
        cell: ({ row }) => {
            const date = getSafeDate(row.original.timestamp);
            if (!date) return 'N/A';
            return (
                <div className="flex flex-col">
                    <span>{format(date, "EEEE, MM-dd-yyyy")}</span>
                    <span className="text-lg font-semibold">{format(date, "h:mm:ss a")}</span>
                </div>
            )
        },
    },
    {
        accessorKey: 'userName',
        header: 'Staff Member',
    },
    {
        id: 'shift',
        header: 'Shift',
        cell: ({ row }) => {
            const userProfile = userMap.get(row.original.userId);
            return userProfile?.shift || 'N/A';
        }
    },
    {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const userProfile = userMap.get(row.original.userId);
            const { status, variant } = getStatus(row.original, userProfile, settings);
            return <Badge variant={variant}>{status}</Badge>;
        }
    },
], [settings, userMap]);