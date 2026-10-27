
'use client';

import * as React from 'react';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore } from '@/firebase';
import { notFound, useParams } from 'next/navigation';
import type { Booking } from '@/lib/types';
import ReservationActionClientPage from './client-page';
import ReservationActionLoading from './loading';

export default function ReservationActionPageClient() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();

  const bookingRef = React.useMemo(() => {
    if (!firestore || !id || id === 'view') return null;
    return doc(firestore, 'bookings', id);
  }, [firestore, id]);

  const { data: booking, isLoading } = useDoc<Booking>(bookingRef);

  if (id === 'view') {
      return <div className="p-8 text-center">Select a reservation to view details.</div>;
  }

  if (isLoading) {
    return <ReservationActionLoading />;
  }

  if (!booking) {
    notFound();
  }

  return <ReservationActionClientPage bookingData={booking} />;
}
