
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format, differenceInDays } from 'date-fns';
import { User, Mail, Phone, Calendar, Bed, DollarSign, ArrowLeft, Landmark, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import type { BookingFormValues } from './BookingFormFields';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface BookingConfirmationDialogProps {
  bookingData: BookingFormValues & { roomName: string, nightlyRate: number, totalAmount: number, bookingId?: string };
  onBack: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | undefined }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        <div className="flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-semibold">{value || 'Not provided'}</p>
        </div>
    </div>
)

export function BookingConfirmationContent({
  bookingData,
  onBack,
  onConfirm,
  isProcessing,
}: BookingConfirmationDialogProps) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const [confirmationStep, setConfirmationStep] = React.useState<'review' | 'finalConfirm'>('review');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const checkIn = getSafeDate(bookingData.dateRange.from);
  const checkOut = getSafeDate(bookingData.dateRange.to);

  const totalNights = React.useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = differenceInDays(checkOut, checkIn);
    return Math.max(1, diff); // Ensure at least 1 night for same-day checkout scenarios if applicable
  }, [checkIn, checkOut]);

  const totalAmount = totalNights * bookingData.nightlyRate;

  if (confirmationStep === 'finalConfirm') {
    return (
        <div className="space-y-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-2xl font-bold">Have you made your payment?</h3>
            <p className="text-muted-foreground">
                Please confirm that you have completed the bank transfer of <span className="font-bold">{formatCurrency(totalAmount)}</span> using the transaction code <span className="font-bold text-primary">{bookingData.bookingId}</span>.
            </p>
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important!</AlertTitle>
                <AlertDescription>
                    Confirming without payment will still create a reservation, but it may be cancelled if payment is not received.
                </AlertDescription>
            </Alert>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
                <Button variant="outline" onClick={() => setConfirmationStep('review')} disabled={isProcessing} className="w-full sm:w-auto">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
                <Button onClick={onConfirm} loading={isProcessing} className="w-full sm:w-auto flex-1">
                    Yes, I Have Paid
                </Button>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="rounded-lg border bg-muted p-4 space-y-4">
            <h4 className="font-semibold">Your Details</h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow icon={User} label="Full Name" value={bookingData.guestName} />
                <DetailRow icon={Mail} label="Email Address" value={bookingData.guestEmail} />
                <DetailRow icon={Phone} label="Phone Number" value={bookingData.guestPhoneNumber} />
                <DetailRow icon={Users} label="Number of Guests" value={String(bookingData.numberOfGuests)} />
            </div>
        </div>

         <div className="rounded-lg border bg-muted p-4 space-y-4">
            <h4 className="font-semibold">Your Stay</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow icon={Bed} label="Accommodation" value={bookingData.roomName} />
                <DetailRow icon={Calendar} label="Check-in" value={checkIn ? format(checkIn, 'PPP') : ''} />
                <DetailRow icon={Calendar} label="Check-out" value={checkOut ? format(checkOut, 'PPP') : ''} />
                <DetailRow icon={Calendar} label="Total Nights" value={String(totalNights)} />
            </div>
        </div>

        <Separator />

        <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 space-y-4">
             <div className="text-center">
                <p className="text-sm font-bold text-red-600 uppercase tracking-wider">Important Payment Instruction</p>
                <p className="text-destructive text-sm">Please use the code below as the payment reference/memo for your bank transfer.</p>
                <div className="my-2 p-3 bg-white/50 dark:bg-black/20 rounded-lg inline-block">
                    <p className="text-2xl font-mono font-bold tracking-widest text-primary">{bookingData.bookingId}</p>
                </div>
            </div>

            <Separator className="border-primary/20" />

            <h4 className="font-semibold text-primary flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Bank Details for Payment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pl-7">
                <div>
                    <p className="text-xs text-muted-foreground">Bank Name</p>
                    <p className="font-bold">{settings?.websiteData?.footer?.publicBankName || 'Not Configured'}</p>
                </div>
                 <div>
                    <p className="text-xs text-muted-foreground">Account Name</p>
                    <p className="font-bold">{settings?.websiteData?.footer?.publicAccountName || 'Not Configured'}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Account Number</p>
                    <p className="font-bold text-lg tracking-wider">{settings?.websiteData?.footer?.publicAccountNumber || 'Not Configured'}</p>
                </div>
                 {settings?.websiteData?.footer?.publicBankLogoUrl && (
                    <div className="flex items-center gap-2">
                        <div className="relative w-12 h-12">
                            <Image src={settings.websiteData.footer.publicBankLogoUrl} alt="Bank Logo" layout="fill" objectFit="contain" />
                        </div>
                    </div>
                 )}
            </div>
        </div>

        <div className="flex justify-between items-center text-xl font-bold">
            <span>Total to Pay:</span>
            <span>{formatCurrency(totalAmount)}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <Button variant="outline" onClick={onBack} disabled={isProcessing} className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
            <Button onClick={() => setConfirmationStep('finalConfirm')} loading={isProcessing} className="w-full sm:w-auto flex-1">
                Proceed to Final Confirmation
            </Button>
        </div>
    </div>
  );
}
