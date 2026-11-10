

'use client';

import React from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser } from '@/contexts/user-context';
import { PagePermission, getLandingPage } from '@/lib/permissions';
import { usePathname, useRouter } from 'next/navigation';
import { FullscreenLoader } from '@/components/ui/fullscreen-loader';

function PermissionRedirect({ path, currentPath }: { path: string; currentPath: string }) {
  const router = useRouter();

  React.useEffect(() => {
    // Prefer the normal Next.js client-side transition.
    router.replace(path);

    // Some mobile WebKit sessions can leave a client-side route transition
    // pending after authentication. If the browser URL has not changed, fall
    // back to a full document navigation so the assigned workspace can load.
    const fallbackId = window.setTimeout(() => {
      if (window.location.pathname === currentPath) {
        window.location.replace(path);
      }
    }, 1800);

    return () => window.clearTimeout(fallbackId);
  }, [currentPath, path, router]);

  return <FullscreenLoader message="Redirecting..." subtext="Opening your assigned workspace" delayMs={900} />;
}

export default function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission?: PagePermission | string
) {
  const WithAuthComponent: React.FC<P> = (props) => {
    const { user, loading: authLoading } = useAuth();
    const { userProfile, loading: profileLoading, permissions: contextPermissions } = useUser();
    const pathname = usePathname();

    if (authLoading || profileLoading) {
      return <FullscreenLoader message="Please wait..." subtext="Verifying permissions..." />;
    }

    if (!user) {
      return null;
    }

    // Use the centralized permission calculation. Missing profiles resolve to no permissions.
    const finalPermissions = contextPermissions || [];
    const isAdminIdentity = userProfile?.isFirebaseOnlyAdmin === true
      || userProfile?.isSuperAdmin === true
      || userProfile?.role === 'Admin'
      || userProfile?.role === 'Super Admin';

    const canManageRoomStatus = finalPermissions.includes(PagePermission.MANAGE_ROOM_STATUS);

    // Every authenticated account may view its own profile, regardless of
    // whether it has a staff role or the optional MANAGE_OWN_PROFILE permission.
    const isOwnProfileRoute = pathname === '/profile';
    const isEmailMarketingAdminAccess = requiredPermission === PagePermission.MANAGE_EMAIL_MARKETING && isAdminIdentity;
    let hasRequiredPermission = isOwnProfileRoute || isEmailMarketingAdminAccess ||
      (requiredPermission ? finalPermissions.includes(requiredPermission) : true);

    // POS-assigned staff may open Running Tables; the page itself scopes them
    // to their own held sales and hides management-only sections/actions.
    const isPosRunningTablesRoute = pathname === '/running-tables';
    const hasPosRunningTablesAccess = isPosRunningTablesRoute && (
      finalPermissions.includes(PagePermission.VIEW_POS)
      || finalPermissions.includes(PagePermission.PROCESS_SALES)
    );
    if (hasPosRunningTablesAccess) {
      hasRequiredPermission = true;
    }

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

    const landingPage = getLandingPage(finalPermissions);

    if (!hasRequiredPermission) {
      if (landingPage !== pathname) {
        return <PermissionRedirect path={landingPage} currentPath={pathname} />;
      }
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
