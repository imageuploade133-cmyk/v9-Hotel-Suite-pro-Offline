
import * as React from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import WebsiteStudioPage from '@/components/settings/website-studio-page';
import { notFound } from 'next/navigation';
import type { SiteData, Room, Amenity, Review, Settings } from '@/components/website/types';

const serializeFirestoreData = (data: any): any => {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }
  const newObj: { [key: string]: any } = {};
  for (const key in data) {
    newObj[key] = serializeFirestoreData(data[key]);
  }
  return newObj;
};

async function getPageData(): Promise<SiteData | { error: string }> {
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

    return {
      signatureRooms,
      allRooms,
      reviews,
      settings,
      amenities,
    } as SiteData;
  } catch (err: any) {
    console.error("Error fetching website page data for studio:", err);
    return { error: "Could not load website content for preview. Please try again later." };
  }
}

export default async function Page() {
  const pageData = await getPageData();

  if ('error' in pageData) {
    notFound();
  }

  return <WebsiteStudioPage pageData={pageData} />;
}
