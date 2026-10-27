
import * as React from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import type { Room, Amenity, Review, Settings } from '@/components/website/types';
import { WebsitePageClient } from './client-page';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TopHeader } from '@/components/ui/top-header';
import { ServerCrash } from 'lucide-react';
import { BookingProvider } from '@/components/website/booking-provider';

// Helper to recursively convert Firestore Timestamps to ISO strings
const serializeFirestoreData = (data: any): any => {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }

  // Firestore Timestamp check
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  // If it's an array, serialize each item
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }

  // If it's an object, serialize each value
  const newObj: { [key: string]: any } = {};
  for (const key in data) {
    newObj[key] = serializeFirestoreData(data[key]);
  }
  return newObj;
};


async function getPageData() {
  try {
    const signatureRoomsQuery = query(collection(firestore, 'signatureRooms'), orderBy('order'));
    const allRoomsQuery = query(collection(firestore, 'rooms'), orderBy('name'));
    const reviewsQuery = query(collection(firestore, 'websiteReviews'), orderBy('order'));
    const settingsDocRef = doc(firestore, 'settings', 'global');
    const amenitiesQuery = query(collection(firestore, 'websiteAmenities'), orderBy('order'));

    const [signatureRoomsSnapshot, allRoomsSnapshot, reviewsSnapshot, settingsSnapshot, amenitiesSnapshot] = await Promise.all([
      getDocs(signatureRoomsQuery),
      getDocs(allRoomsQuery),
      getDocs(reviewsQuery),
      getDoc(settingsDocRef),
      getDocs(amenitiesQuery),
    ]);

    const signatureRooms = signatureRoomsSnapshot.docs.map(doc => serializeFirestoreData({ id: doc.id, ...doc.data() })) as Room[];
    const allRooms = allRoomsSnapshot.docs.map(doc => serializeFirestoreData({ id: doc.id, ...doc.data() })) as Room[];
    const reviews = reviewsSnapshot.docs.map(doc => serializeFirestoreData({ id: doc.id, ...doc.data() })) as Review[];
    const settings = settingsSnapshot.exists() ? serializeFirestoreData(settingsSnapshot.data()) as Settings : null;
    const amenities = amenitiesSnapshot.docs.map(doc => serializeFirestoreData({ id: doc.id, ...doc.data() })) as Amenity[];

    return { signatureRooms, allRooms, reviews, settings, amenities };
  } catch (err: any) {
    console.error("Error fetching website page data on server:", err);
    return { error: "Could not load website content. Please try again later.", signatureRooms: [], allRooms: [], reviews: [], settings: null, amenities: [] };
  }
}

export default async function HomePage() {
  const pageData = await getPageData();

  if (pageData.error) {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-6 p-4 text-center">
            <TopHeader
                name="Website Currently Unavailable"
                icon={<ServerCrash className="h-10 w-10 text-destructive" />}
                description={pageData.error}
            />
            <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
        </div>
    )
  }

  return (
    <BookingProvider>
      <WebsitePageClient pageData={pageData} />
    </BookingProvider>
  );
}
