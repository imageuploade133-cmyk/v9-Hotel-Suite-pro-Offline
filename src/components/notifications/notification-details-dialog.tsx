
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Calendar, MessageSquare, Info, DollarSign, Ban, AlertTriangle, MessageSquareWarning, Bell } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import { DynamicIcon } from '@/components/ui/dynamic-icon';

interface NotificationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
    <div className="flex items-start gap-4">
        <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
        <div className="flex-1">
            <p className="font-semibold text-foreground">{label}</p>
            <div className="text-muted-foreground">{value}</div>
        </div>
    </div>
);


export function NotificationDetailsDialog({ open, onOpenChange, notification }: NotificationDetailsDialogProps) {
    const { settings } = useSettings();

    if (!notification) return null;

    const createdAt = getSafeDate(notification.createdAt);
    const isReversed = notification.status === 'Reversed';

    const getIcon = () => {
        if (isReversed) return <Ban className="text-destructive" />;
        switch (notification.type) {
            case 'SALARY_DEDUCTION': return <DollarSign className="text-destructive" />;
            case 'SALARY_PAYMENT': return <DollarSign className="text-success" />;
            case 'STOCK_ALERT': return <AlertTriangle className="text-warning" />;
            case 'GUEST_REPORT': return <MessageSquareWarning className="text-destructive" />;
            default: return <Bell className="text-primary" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        {getIcon()}
                        <span className="flex-1">Notification Details</span>
                    </DialogTitle>
                    <DialogDescription
                      className={cn(isReversed && 'text-destructive font-semibold')}
                    >
                        {isReversed ? 'This transaction was reversed.' : 'Full details about this notification.'}
                    </DialogDescription>
                </DialogHeader>
                <div className={cn("space-y-4 py-4", isReversed && "text-muted-foreground line-through")}>
                    <DetailRow
                        icon={Calendar}
                        label="Date"
                        value={createdAt ? format(createdAt, 'EEEE, PPPp') : 'N/A'}
                    />
                     <Separator />
                     <DetailRow
                        icon={MessageSquare}
                        label="Message"
                        value={<p className="whitespace-pre-wrap">{notification.message}</p>}
                    />
                    {notification.notes && (
                        <>
                         <Separator />
                         <DetailRow
                            icon={Info}
                            label="Additional Notes"
                            value={<p className="whitespace-pre-wrap italic">"{notification.notes}"</p>}
                        />
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
