
'use client';

import * as React from 'react';
import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { format, subDays, eachDayOfInterval, startOfDay, isAfter, isToday, parseISO, addDays, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Loader2, Send, FileText, X, Minimize } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

const LAST_SENT_DATE_KEY = 'dailyReportLastSent';

export const DailyReportTrigger = () => {
    const { settings } = useSettings();
    const { userProfile } = useUser();
    const { toast } = useToast();
    const [isSending, setIsSending] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isMinimized, setIsMinimized] = React.useState(false);
    const [unsentDates, setUnsentDates] = React.useState<Date[]>([]);
    const pathname = usePathname();

    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        // Position the button in the bottom right on initial render
        const initialX = window.innerWidth - 220; // Approx button width + padding
        const initialY = window.innerHeight - 80; // Approx button height + padding
        setPosition({ x: initialX, y: initialY });
    }, []);


    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (buttonRef.current) {
            setIsDragging(true);
            const rect = buttonRef.current.getBoundingClientRect();
            dragStartRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    };

    const handleMouseMove = React.useCallback((e: MouseEvent) => {
        if (isDragging && dragStartRef.current) {
            e.preventDefault();
            let newX = e.clientX - dragStartRef.current.x;
            let newY = e.clientY - dragStartRef.current.y;

            // Constrain movement within the viewport
            newX = Math.max(0, Math.min(newX, window.innerWidth - (buttonRef.current?.offsetWidth || 0)));
            newY = Math.max(0, Math.min(newY, window.innerHeight - (buttonRef.current?.offsetHeight || 0)));

            setPosition({ x: newX, y: newY });
        }
    }, [isDragging]);

    const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
    };

    React.useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);


    const handleSendReport = React.useCallback(async () => {
        setIsSending(true);
        toast({
            title: 'Sending Daily Reports...',
            description: `Sending ${unsentDates.length} report(s). Please wait.`,
        });

        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/send-daily-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: unsentDates.map(d => format(d, 'yyyy-MM-dd')) })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'An unknown server error occurred.');
            }
             toast({
                variant: 'success',
                title: 'Reports Sent Successfully',
                description: `${unsentDates.length} daily income report(s) were sent.`,
            });

            setIsModalOpen(false);
            setUnsentDates([]);
            setIsMinimized(false);
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error Sending Reports',
                description: error.message,
            });
        } finally {
            setIsSending(false);
        }
    }, [toast, unsentDates]);


    const checkAndNotify = React.useCallback(() => {
        if (isModalOpen || isMinimized || !settings?.enableDailyReport || !settings.dailyReportTime || !settings.dailyReportPhoneNumber || userProfile?.role !== 'Admin') {
            return;
        }

        const lastSentDateStr = settings?.dailyReportLastSent;
        const today = new Date();

        const [reportHours, reportMinutes] = settings.dailyReportTime.split(':').map(Number);
        const reportTimeToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), reportHours, reportMinutes);

        // Check if current time is after the specified report time
        if (isAfter(today, reportTimeToday)) {
            if (lastSentDateStr === format(today, 'yyyy-MM-dd')) {
                return; // Already sent today for this period
            }

            const startDate = lastSentDateStr ? startOfDay(addDays(parseISO(lastSentDateStr), 1)) : startOfDay(subDays(today, 30));

            const datesToReport = eachDayOfInterval({
                start: startDate,
                end: startOfDay(today)
            });

            if (datesToReport.length > 0) {
                setUnsentDates(datesToReport);
                if (!isModalOpen && !isMinimized) {
                    setIsModalOpen(true);
                }
            }
        }
    }, [settings, userProfile, isModalOpen, isMinimized]);

    React.useEffect(() => {
        // This check runs on every page navigation within the protected layout
        checkAndNotify();
    }, [checkAndNotify, pathname]); // Depend on pathname to re-run on navigation

    const handleMinimize = () => {
        setIsModalOpen(false);
        setIsMinimized(true);
    };

    const handleRestore = () => {
        setIsModalOpen(true);
        setIsMinimized(false);
    };

    return (
        <>
            <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleMinimize() }}>
                 <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-2xl">
                            <FileText className="h-7 w-7 text-primary" />
                            Daily Report(s) Ready
                        </DialogTitle>
                        <DialogDescription>
                            You have {unsentDates.length} pending daily report(s) to send. Review the dates below and send them all.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm font-medium mb-2">Unsent Reports:</p>
                        <ScrollArea className="h-64 rounded-md border">
                            <div className="p-4 space-y-2 text-sm">
                                {unsentDates.map(date => (
                                    <div key={date.toISOString()} className="flex justify-between items-center p-2 bg-muted rounded-md">
                                        <span className="font-semibold">{format(date, 'EEEE, MMMM d, yyyy')}</span>
                                        <Badge variant="warning">Pending</Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <Button variant="ghost" onClick={handleMinimize} disabled={isSending}>
                            Minimize
                        </Button>
                        <Button onClick={handleSendReport} disabled={isSending}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Send All ({unsentDates.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isMinimized && unsentDates.length > 0 && (
                <Button
                    ref={buttonRef}
                    onMouseDown={handleMouseDown}
                    onClick={handleRestore}
                    style={{
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        userSelect: 'none',
                    }}
                    className={cn(
                        "z-50 shadow-lg",
                        "animate-pulse"
                    )}
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Show Daily Report ({unsentDates.length})
                </Button>
            )}
        </>
    );
};
