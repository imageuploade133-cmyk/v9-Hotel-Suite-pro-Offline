'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Printer } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import type { Booking, Bill, Payment, StockReturn } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { GuestFolio } from '@/components/bookings/guest-folio';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SettingsProvider } from '@/contexts/settings-context';

function GuestViewBill() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const roomNumber = searchParams.get('room');

    const [booking, setBooking] = React.useState<Booking | null>(null);
    const [loadingBooking, setLoadingBooking] = React.useState(true);
    const [imageToView, setImageToView] = React.useState<string | null>(null);

    const billsQuery = React.useMemo(() => (firestore && booking) ? query(collection(firestore, `bookings/${booking.id}/bills`), orderBy('createdAt', 'desc')) : null, [firestore, booking]);
    const { data: allBills, isLoading: areBillsLoading } = useCollection<Bill>(billsQuery);

    const paymentsQuery = React.useMemo(() => (firestore && booking) ? query(collection(firestore, 'payments'), where('bookingId', '==', booking.id), orderBy('transactionDate', 'desc')) : null, [firestore, booking]);
    const { data: allPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);

    const returnsQuery = React.useMemo(() => (firestore && booking) ? query(collection(firestore, 'stockReturns'), where('bookingId', '==', booking.id), orderBy('returnedAt', 'desc')) : null, [firestore, booking]);
    const { data: allReturns, isLoading: areReturnsLoading } = useCollection<StockReturn>(returnsQuery);

    React.useEffect(() => {
        const fetchBooking = async () => {
            if (!roomNumber || !firestore) {
                setLoadingBooking(false);
                return;
            }
            setLoadingBooking(true);
            try {
                const bookingsRef = collection(firestore, 'bookings');
                const q = query(bookingsRef, where('roomNumber', '==', roomNumber), where('status', 'in', ['Active', 'Checked-in']));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    toast({ variant: 'destructive', title: 'No Active Booking', description: `No active booking found for Room ${roomNumber}.` });
                    setBooking(null);
                } else {
                    const bookingDoc = querySnapshot.docs[0];
                    setBooking({ id: bookingDoc.id, ...bookingDoc.data() } as Booking);
                }
            } catch (error: any) {
                console.error('Error fetching booking data:', error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load booking data.' });
            } finally {
                setLoadingBooking(false);
            }
        };
        fetchBooking();
    }, [roomNumber, firestore, toast]);

    const isLoading = loadingBooking || areBillsLoading || arePaymentsLoading || areReturnsLoading;

    const handlePrint = () => {
        window.print();
    }

    if (isLoading && !booking) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md text-center p-6">
                    <CardHeader>
                        <CardTitle>Invalid Room or No Active Bill</CardTitle>
                        <CardDescription>The room number might be incorrect, or there is no active bill associated with it. Please check the details and try again.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => window.history.back()}>Go Back</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 10mm 8mm 10mm 8mm !important;
                        size: auto;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print\\:block {
                        display: block !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    /* Ensure tables don't overflow */
                    table {
                        width: 100% !important;
                        max-width: 100% !important;
                        font-size: 11px !important;
                    }
                    td, th {
                        padding: 4px 6px !important;
                        word-wrap: break-word !important;
                    }
                    /* Prevent content from being cut off */
                    .overflow-x-auto {
                        overflow: visible !important;
                    }
                    /* Page break controls */
                    .print\\:break-inside-avoid {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    section {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    /* Ensure cards display properly */
                    .rounded-lg, .rounded-md {
                        border-radius: 4px !important;
                    }
                    /* Reduce font sizes for print */
                    h1 { font-size: 20px !important; }
                    h2 { font-size: 16px !important; }
                    h3 { font-size: 14px !important; }
                    .text-2xl { font-size: 18px !important; }
                    .text-3xl { font-size: 22px !important; }
                }
            `}</style>
            <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 print:bg-white print:p-0">
                <div className="w-full max-w-5xl">
                    <div className="flex justify-end mb-4 print:hidden">
                        <Button onClick={handlePrint} variant="outline">
                            <Printer className="mr-2 h-4 w-4" />
                            Print Bill
                        </Button>
                    </div>
                    <main className="w-full bg-white rounded-lg shadow-md p-6 print:shadow-none print:border-0 print:p-0 print:rounded-none">
                        {isLoading ?
                            <Skeleton className="h-96 w-full" /> :
                            <GuestFolio
                                booking={booking}
                                allBills={allBills}
                                allPayments={allPayments}
                                allReturns={allReturns}
                                onViewImage={setImageToView}
                                readOnly={true}
                            />
                        }
                    </main>
                </div>
            </div>

            {imageToView && (
                <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
                    <DialogContent className="max-w-3xl"><img src={imageToView} alt="Guest Photo" className="w-full h-auto rounded-md" /></DialogContent>
                </Dialog>
            )}
        </>
    );
}

function GuestViewBillPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
             <GuestViewBill />
        </Suspense>
    )
}

export default GuestViewBillPage;
