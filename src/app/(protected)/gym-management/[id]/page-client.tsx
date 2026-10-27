
'use client';

import * as React from 'react';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import GymMemberPageComponent from './client-page';
import { notFound, useParams } from 'next/navigation';
import type { GymMember } from '@/lib/types';
import GymMemberDetailsLoading from './loading';

export default function Page() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();

  const memberDocRef = React.useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'gym-members', id);
  }, [firestore, id]);

  const { data: memberData, isLoading } = useDoc<GymMember>(memberDocRef);

  if (isLoading) {
      return <GymMemberDetailsLoading />;
  }

  if (!memberData) {
      notFound();
  }

  return <GymMemberPageComponent initialMemberData={memberData} />;
}
