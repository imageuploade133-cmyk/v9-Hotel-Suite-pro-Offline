
import * as React from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import StatusPageWrapper from './client-page';
import { sanitizeForUrl } from '@/lib/helpers';

export async function generateStaticParams() {
  try {
    const defaultStatuses = ['vacant', 'active-check-ins', 'reserved', 'cleaning-in-progress', 'maintenance', 'do-not-disturb'];

    const statusesCol = collection(firestore, 'roomStatuses');
    const statusSnapshot = await getDocs(query(statusesCol));
    const customStatuses = statusSnapshot.docs
      .map(doc => doc.data().name)
      .filter(name => name)
      .map(name => sanitizeForUrl(name));

    const allStatuses = [...new Set([...defaultStatuses, ...customStatuses])];

    return allStatuses.map(status => ({ status }));
  } catch (error) {
    console.error("Failed to generate static params for status pages:", error);
    return [{ status: 'placeholder' }];
  }
}

export default function StatusPage({ params }: { params: { status: string }}) {
  if (params.status === 'placeholder') {
    return <div>Loading status page...</div>;
  }
  return <StatusPageWrapper />;
}
