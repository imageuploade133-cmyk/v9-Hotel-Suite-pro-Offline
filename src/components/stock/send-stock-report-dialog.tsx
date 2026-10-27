
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquareText, Phone } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DateRangePicker } from '../ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { startOfToday, endOfToday, subDays, startOfDay, endOfDay } from 'date-fns';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { useToast } from '@/hooks/use-toast';

type ReportPeriod = 'today' | 'yesterday' | '24hrs' | 'custom';

interface SendStockReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (phone: string, dateRange: DateRange | undefined) => Promise<void>;
  defaultPhoneNumber?: string;
}

export function SendStockReportDialog({
  isOpen,
  onClose,
  onSend,
  defaultPhoneNumber,
}: SendStockReportDialogProps) {
  const [phoneNumber, setPhoneNumber] = React.useState(defaultPhoneNumber || '');
  const [isSending, setIsSending] = React.useState(false);
  const { settings } = useSettings();
  const { toast } = useToast();
  const countryCode = settings?.countryCode || '';
  const [period, setPeriod] = React.useState<ReportPeriod>('today');
  const [customDateRange, setCustomDateRange] = React.useState<DateRange | undefined>();

  React.useEffect(() => {
    if (isOpen) {
      setPhoneNumber(defaultPhoneNumber || '');
      setPeriod('today');
      setCustomDateRange(undefined);
    }
  }, [isOpen, defaultPhoneNumber]);

  const handleSend = async () => {
    setIsSending(true);
    const fullPhoneNumber = phoneNumber.startsWith(countryCode) ? phoneNumber : `${countryCode}${phoneNumber}`;

    let reportDateRange: DateRange | undefined;
    const now = new Date();

    switch(period) {
        case 'today':
            reportDateRange = { from: startOfToday(), to: endOfToday() };
            break;
        case 'yesterday':
            const yesterday = subDays(now, 1);
            reportDateRange = { from: startOfDay(yesterday), to: endOfDay(yesterday) };
            break;
        case '24hrs':
            reportDateRange = { from: subDays(now, 1), to: now };
            break;
        case 'custom':
            reportDateRange = customDateRange;
            break;
    }

    try {
        await onSend(fullPhoneNumber, reportDateRange);
    } catch (e: any) {
        toast({
            title: "Error Sending Report",
            description: e.message || "An unknown error occurred.",
            variant: 'destructive',
        });
    } finally {
        setIsSending(false);
        onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Stock & Sales Report</DialogTitle>
          <DialogDescription>
            Select a period and send a summary report via WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label>Report Period</Label>
                 <ToggleGroup
                    type="single"
                    value={period}
                    onValueChange={(value: ReportPeriod) => value && setPeriod(value)}
                    className="grid grid-cols-4"
                >
                    <ToggleGroupItem value="today">Today</ToggleGroupItem>
                    <ToggleGroupItem value="yesterday">Yesterday</ToggleGroupItem>
                    <ToggleGroupItem value="24hrs">24 Hours</ToggleGroupItem>
                    <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
                </ToggleGroup>
            </div>

            {period === 'custom' && (
                <div className="space-y-2">
                    <Label>Custom Date Range</Label>
                    <DateRangePicker date={customDateRange} onDateChange={setCustomDateRange} />
                </div>
            )}

          <div className="space-y-2">
            <Label htmlFor="report-phone-number">Recipient WhatsApp Number</Label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-muted-foreground sm:text-sm">{countryCode}</span>
                </div>
                <Input
                    id="report-phone-number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="pl-10"
                />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!phoneNumber || isSending} loading={isSending}>
            <MessageSquareText className="mr-2 h-4 w-4" />
            Send Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
