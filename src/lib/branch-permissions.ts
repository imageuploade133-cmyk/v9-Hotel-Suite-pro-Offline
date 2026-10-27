import type { UserProfile } from '@/lib/types';
import type { Role } from '@/lib/types';

/**
 * Check if a user has a specific permission in a given context (global or branch-specific)
 * @param user - The user profile
 * @param permission - The permission to check
 * @param branchId - Optional branch ID. If not provided, checks global permissions
 * @returns true if the user has the permission in the given context
 */
export function userHasPermission(
  user: UserProfile | null | undefined,
  permission: string,
  branchId?: string
): boolean {
  if (!user) return false;

  // Check global permissions (these apply everywhere)
  if (user.permissions?.includes(permission)) {
    return true;
  }

  // If a specific branch is requested, check branch-specific permissions
  if (branchId && user.branchPermissions?.[branchId]) {
    return user.branchPermissions[branchId].includes(permission);
  }

  return false;
}

/**
 * Check if a role is applicable to a given branch
 * @param role - The role to check
 * @param branchId - Optional branch ID
 * @returns true if the role is applicable
 */
export function roleIsApplicableToBranch(
  role: Role | null | undefined,
  branchId?: string
): boolean {
  if (!role) return false;

  // Global roles apply everywhere
  if (role.isGlobalRole) {
    return true;
  }

  // If no branch specified, only global roles apply
  if (!branchId) {
    return role.isGlobalRole;
  }

  // Check if role is in the applicable branches list
  return role.applicableBranches?.includes(branchId) || false;
}

/**
 * Get the effective permissions for a user in a specific branch
 * @param user - The user profile
 * @param branchId - Optional branch ID
 * @returns Array of permissions
 */
export function getUserPermissionsInBranch(
  user: UserProfile | null | undefined,
  branchId?: string
): string[] {
  if (!user) return [];

  // Always include global permissions
  const permissions = [...(user.permissions || [])];

  // Add branch-specific permissions if a branch is specified
  if (branchId && user.branchPermissions?.[branchId]) {
    permissions.push(...user.branchPermissions[branchId]);
  }

  // Remove duplicates
  return [...new Set(permissions)];
}
