
'use client';

import * as React from 'react';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import PosCustomerClientPage from './client-page';
import { notFound, useParams } from 'next/navigation';
import type { Customer } from '@/lib/types';
import CustomerDetailsLoading from './loading';
import { useBranch } from '@/contexts/branch-context';

export default function Page() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();

  const customerRef = React.useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, getCollectionPath('posCustomers'), id);
  }, [firestore, id, getCollectionPath]);

  const { data: customer, isLoading } = useDoc<Customer>(customerRef);

  if (isLoading) {
    return <CustomerDetailsLoading />;
  }

  if (!customer) {
    notFound();
  }

  return <PosCustomerClientPage customer={customer} />;
}
