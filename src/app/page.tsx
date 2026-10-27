
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { useUser } from '@/contexts/user-context';
import { getLandingPage } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: profileLoading } = useUser();
  const router = useRouter();

  const loading = authLoading || profileLoading;

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect user to their appropriate landing page based on permissions
        const landingPage = getLandingPage(permissions);
        router.replace(landingPage);
      } else {
        router.replace('/website');
      }
    }
  }, [user, loading, permissions, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
