
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format, differenceInDays } from 'date-fns';
import { User, Mail, Phone, Calendar, Bed, DollarSign, ArrowLeft, Printer, Download, Share2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Booking } from '@/lib/types';
import { Logo } from '../logo';

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | undefined }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        <div className="flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-semibold">{value || 'Not provided'}</p>
        </div>
    </div>
)

export function BookingInvoice({ booking }: { booking: Booking }) {
    const { settings } = useSettings();
    const { toast } = useToast();
    const router = useRouter();
    const invoiceRef = React.useRef<HTMLDivElement>(null);
    const currency = settings?.currency || 'USD';
    const logoSize = settings?.businessLogoSize || 48;
    const businessName = settings?.businessName || 'Your Hotel';

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
    };

    const checkIn = getSafeDate(booking.checkInDate);
    const checkOut = getSafeDate(booking.checkOutDate);
    const totalNights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
    const totalAmount = booking.totalAmount || 0;

    const handlePrint = () => {
        const content = invoiceRef.current;
        if (content) {
            const printWindow = window.open('', '', 'height=800,width=800');
            if (printWindow) {
                printWindow.document.write('<html><head><title>Print Invoice</title>');
                printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
                printWindow.document.write('<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }</style>');
                printWindow.document.write('</head><body class="p-8">');
                printWindow.document.write(content.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }, 250);
            }
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: `Your Reservation at ${businessName}`,
            text: `Your booking for ${booking.roomNumber} from ${format(checkIn!, 'PP')} to ${format(checkOut!, 'PP')} is confirmed!`,
            url: window.location.href,
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast({
                title: "Link Copied!",
                description: "Your booking confirmation link has been copied to the clipboard.",
            });
        }
    };


    return (
        <div className="w-full max-w-2xl bg-white dark:bg-card shadow-lg rounded-xl flex flex-col">
            <div ref={invoiceRef} className="p-8">
                <header className="flex justify-between items-start mb-6">
                    <div>
                        {settings?.businessLogoUrl ? (
                            <Image src={settings.businessLogoUrl} alt={businessName} width={logoSize * 2} height={logoSize} className="object-contain" />
                        ) : (
                            <Logo className="h-10 w-10 text-primary" />
                        )}
                    </div>
                    <div className="text-right">
                        <h1 className="font-bold text-xl text-primary">{businessName}</h1>
                        <p className="text-muted-foreground text-xs">{settings?.businessAddress}</p>
                    </div>
                </header>
                <div className="text-center my-6">
                    <h2 className="text-3xl font-bold text-green-600">Reservation Confirmed</h2>
                    <p className="text-muted-foreground">Thank you for your payment. Your booking is confirmed.</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-primary">Guest Details</h3>
                        <DetailRow icon={User} label="Full Name" value={booking.guestName} />
                        <DetailRow icon={Mail} label="Email Address" value={booking.guestEmail} />
                        <DetailRow icon={Phone} label="Phone Number" value={booking.guestPhoneNumber} />
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-semibold text-primary">Stay Details</h3>
                        <DetailRow icon={Bed} label="Room" value={`Room ${booking.roomNumber}`} />
                        <DetailRow icon={Calendar} label="Check-in" value={checkIn ? format(checkIn, 'PPP') : 'N/A'} />
                        <DetailRow icon={Calendar} label="Check-out" value={checkOut ? format(checkOut, 'PPP') : 'N/A'} />
                    </div>
                </div>
                 <div className="rounded-lg border bg-muted p-4">
                    <h3 className="font-semibold mb-3">Payment Summary</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>{totalNights} night(s) at {formatCurrency(booking.amount / totalNights)}/night</span>
                            <span>{formatCurrency(booking.amount)}</span>
                        </div>
                        <Separator/>
                         <div className="flex justify-between font-bold text-base">
                            <span>Amount Paid ({booking.paymentMethod})</span>
                            <span>{formatCurrency(totalAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-muted/50 p-4 border-t rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                <Button variant="outline" onClick={() => router.push('/')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Website
                </Button>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleShare}>
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print / Download
                    </Button>
                </div>
            </div>
        </div>
    );
}
