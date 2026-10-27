'use client';

import { useUser } from '@/contexts/user-context';
import { ALL_PERMISSIONS } from '@/lib/permissions';

export const usePermissions = () => {
  const { permissions } = useUser();

  return {
    // Check if user has the specified permission
    hasPermission: (permission: string) => {
      return permissions.includes(permission);
    },

    // Check if user has permission in their current branch
    hasPermissionInCurrentBranch: (permission: string) => {
      return permissions.includes(permission);
    },

    // Check if user has permission in a specific branch
    hasPermissionInBranch: (permission: string, _branchId?: string) => {
      return permissions.includes(permission);
    },

    // Return user's actual permissions instead of all permissions
    getEffectivePermissions: () => permissions,
  };
};
