

'use client';

import React from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser } from '@/contexts/user-context';
import { PagePermission } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { FullscreenLoader } from '@/components/ui/fullscreen-loader';

export default function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission?: PagePermission | string
) {
  const WithAuthComponent: React.FC<P> = (props) => {
    const { user, loading: authLoading } = useAuth();
    const { userProfile, loading: profileLoading, permissions: contextPermissions } = useUser();
    const router = useRouter();

    if (authLoading || profileLoading) {
      return <FullscreenLoader message="Please wait..." subtext="Verifying permissions..." />;
    }

    if (!user) {
      return null;
    }

    // If user has no profile in Firestore (Firebase account only), they are administrator full access
    const isSuperAdmin = !userProfile || userProfile?.isSuperAdmin || userProfile?.role === 'Super Admin' || userProfile?.role === 'Admin';
    const finalPermissions = isSuperAdmin ? Object.values(PagePermission) : (userProfile?.permissions || contextPermissions || []);

    const canManageRoomStatus = isSuperAdmin || finalPermissions.includes(PagePermission.MANAGE_ROOM_STATUS);

    let hasRequiredPermission = requiredPermission ? (isSuperAdmin || finalPermissions.includes(requiredPermission)) : true;

    // If it's a custom room status page (format: view:custom_status_name) and the user doesn't have the specific permission,
    // check if they have the general `manage:room_status` permission.
    // Only apply this to dynamic custom status permissions, not to standard view: permissions
    const isStandardViewPermission = requiredPermission && Object.values(PagePermission).includes(requiredPermission as PagePermission);
    const isCustomStatusPage = typeof requiredPermission === 'string' &&
                               requiredPermission.startsWith('view:') &&
                               !isStandardViewPermission;
    if (isCustomStatusPage && !hasRequiredPermission) {
      hasRequiredPermission = canManageRoomStatus;
    }

    if (!hasRequiredPermission) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardTitle className="text-2xl font-bold text-destructive">Permission Denied</CardTitle>
              <CardDescription>
                Your assigned role (<span className="font-semibold">{userProfile?.role || 'Unassigned'}</span>) does not have the required permissions to view this page. Please contact an administrator if you believe this is an error.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithAuthComponent;
}
