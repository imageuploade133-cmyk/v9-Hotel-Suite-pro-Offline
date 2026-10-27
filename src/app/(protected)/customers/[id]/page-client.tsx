
'use client';

import * as React from 'react';
import CustomerPageComponent from './client-page';
import { notFound, useParams } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Customer } from '@/lib/types';
import CustomerDetailsLoading from './loading';

export default function Page() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();

  const customerRef = React.useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'customers', id);
  }, [firestore, id]);

  const { data: customerData, isLoading } = useDoc<Customer>(customerRef);

  if (isLoading) {
    return <CustomerDetailsLoading />;
  }

  if (!customerData) {
      notFound();
  }

  // We pass the fetched data to the client component.
  // The client component itself is wrapped with `withAuth`.
  return <CustomerPageComponent customerData={customerData} />;
}
