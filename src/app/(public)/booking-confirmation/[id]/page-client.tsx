
'use client';

import * as React from 'react';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useParams, notFound, useRouter } from 'next/navigation';
import type { Booking } from '@/lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingInvoice } from '@/components/website/BookingInvoice';

function BookingConfirmationPage() {
    const params = useParams();
    const id = params.id as string;
    const firestore = useFirestore();
    const router = useRouter();

    const bookingRef = React.useMemo(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'bookings', id);
    }, [firestore, id]);

    const { data: booking, isLoading } = useDoc<Booking>(bookingRef);

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!booking) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-charcoal flex items-center justify-center p-4">
           <BookingInvoice booking={booking} />
        </div>
    );
}

export default function BookingConfirmationPageWrapper() {
    return (
        <React.Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <BookingConfirmationPage />
        </React.Suspense>
    )
}
