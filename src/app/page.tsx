
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { useUser } from '@/contexts/user-context';
import { getLandingPage } from '@/lib/permissions';
import { FullscreenLoader } from '@/components/ui/fullscreen-loader';

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

  return <FullscreenLoader message="Please wait..." subtext="Checking authentication status" />;
}
