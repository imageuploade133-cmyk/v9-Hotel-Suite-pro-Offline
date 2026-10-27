'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import EditRolePageContent from './client-page';
import { notFound } from 'next/navigation';
import type { Role } from '@/lib/types';
import { Loader2 } from 'lucide-react';

function EditRoleContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const firestore = useFirestore();
  const [role, setRole] = React.useState<Role | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id || !firestore) {
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const docRef = doc(firestore, 'roles', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setRole({ id: docSnap.id, ...docSnap.data() } as Role);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error('Error fetching role:', error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [id, firestore]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!id || !role) {
    notFound();
  }

  return <EditRolePageContent role={role} />;
}

export default function EditRolePage() {
  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <EditRoleContent />
    </Suspense>
  );
}
