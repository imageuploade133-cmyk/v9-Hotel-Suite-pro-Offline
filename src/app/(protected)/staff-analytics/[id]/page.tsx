
import * as React from 'react';
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import StaffAnalyticsDetailsPage from './client-page';
import type { Payment, Booking, StockSale, SalonService, UserProfile } from '@/lib/types';
import { notFound } from 'next/navigation';


async function getAllData() {
    try {
        const [bookingsSnap, paymentsSnap, stockSalesSnap, salonServicesSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'bookings'))),
            getDocs(query(collection(firestore, 'payments'))),
            getDocs(query(collection(firestore, 'stockSales'))),
            getDocs(query(collection(firestore, 'salonServices'))),
        ]);

        return {
            bookings: bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)),
            payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)),
            stockSales: stockSalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockSale)),
            salonServices: salonServicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalonService)),
        };
    } catch (error) {
        console.error("Failed to fetch all data for staff analytics:", error);
        return null;
    }
}

async function getStaffData(id: string): Promise<UserProfile | null> {
    try {
        const docRef = doc(firestore, 'users', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return { id: docSnap.id, ...data } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch staff data:", error);
        return null;
    }
}

export default async function Page({ params }: { params: { id: string } }) {
  if (params.id === 'placeholder') {
    return <div>Loading staff data...</div>;
  }

  const allData = await getAllData();
  const staffData = await getStaffData(params.id);

  if (!staffData || !allData) {
    notFound();
  }

  return <StaffAnalyticsDetailsPage staffId={params.id} initialAllData={allData} initialStaffData={staffData} />;
}

export function generateStaticParams() {
  return [{ id: 'view' }];
}
