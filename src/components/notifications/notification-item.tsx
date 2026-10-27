
'use client';

import * as React from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import type { Notification } from '@/lib/types';
import { DynamicIcon } from '@/components/ui/dynamic-icon';

const getIconInfo = (notification: Notification): { icon: string; className: string } => {
    if (notification.status === 'Reversed') {
        return { icon: 'Ban', className: 'text-destructive' };
    }
    switch (notification.type) {
        case 'SALARY_DEDUCTION':
            return { icon: 'DollarSign', className: 'text-destructive' };
        case 'SALARY_PAYMENT':
            return { icon: 'DollarSign', className: 'text-success' };
        case 'STOCK_ALERT':
            return { icon: 'AlertTriangle', className: 'text-warning' };
        case 'GUEST_REPORT':
            return { icon: 'MessageSquareWarning', className: 'text-destructive' };
        default:
            return { icon: 'Bell', className: 'text-primary' };
    }
};

interface NotificationItemProps {
    notification: Notification;
    onSelect: (notification: Notification) => void;
}

export function NotificationItem({ notification, onSelect }: NotificationItemProps) {
    const { icon, className } = getIconInfo(notification);
    const createdAt = getSafeDate(notification.createdAt);

    return (
        <DropdownMenuItem
            className="flex items-start gap-3 whitespace-normal data-[highlighted]:bg-accent cursor-pointer"
            onSelect={() => onSelect(notification)}
        >
            <div className="mt-1">
                <DynamicIcon iconName={icon} className={cn("h-4 w-4", className)} />
            </div>
            <div className={cn("flex-1", notification.status === 'Reversed' && "text-muted-foreground line-through")}>
                <p className="text-sm font-medium">{notification.message}</p>
                {notification.notes && <p className="text-xs text-muted-foreground italic">"{notification.notes}"</p>}
                <p className="text-xs text-muted-foreground mt-1">
                    {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
                </p>
            </div>
            {!notification.read && notification.status !== 'Reversed' && (
                <div className="h-2 w-2 rounded-full bg-primary mt-2 self-center" />
            )}
        </DropdownMenuItem>
    );
}
