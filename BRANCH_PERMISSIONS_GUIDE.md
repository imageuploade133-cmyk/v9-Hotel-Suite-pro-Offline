# Branch-Specific Roles & Permissions Implementation Guide

## Overview
This implementation enables branch-specific role and permission management, allowing users to have different access levels in different branches while maintaining backward compatibility with global permissions.

## Key Features

### 1. **Role Type Updates**
- Roles can now be marked as **Global** (apply to all branches) or **Branch-Specific**
- When creating/editing a role, admins can select which branches it applies to
- Global roles maintain backward compatibility with existing permission systems

### 2. **Type Definitions**

#### Role Interface (Updated)
```typescript
interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  applicableBranches?: string[]; // Array of branch IDs
  isGlobalRole?: boolean; // true if applies to all branches
}
```

#### UserProfile Interface (Updated)
```typescript
interface UserProfile {
  // ... existing fields ...
  branchPermissions?: Record<string, string[]>; // Map of branchId -> permissions[]
}
```

### 3. **UI Changes**

#### Roles Page
- Role cards now display:
  - "Global Role" badge for roles applying to all branches
  - Branch-specific badges showing which branches a role applies to
- No changes to existing role management features

#### Role Editor (Edit/Create)
- New "Apply to All Branches" checkbox
- When unchecked, shows checkboxes for each branch
- Users can select multiple branches for a single role
- Branch selection is hidden if "Apply to All Branches" is checked

### 4. **Permission Checking Functions**

New utility functions in `/src/lib/branch-permissions.ts`:

```typescript
// Check if user has permission in given context
userHasPermission(user, permission, branchId?)

// Check if a role applies to a branch
roleIsApplicableToBranch(role, branchId?)

// Get effective permissions in a branch
getUserPermissionsInBranch(user, branchId?)
```

### 5. **Updated Hook: usePermissions**

The hook now provides:
```typescript
{
  // Original: Global permission check
  hasPermission(permission: string): boolean

  // New: Permission in current branch
  hasPermissionInCurrentBranch(permission: string): boolean

  // New: Permission in specific branch
  hasPermissionInBranch(permission: string, branchId?: string): boolean

  // New: Get all effective permissions
  getEffectivePermissions(): string[]
}
```

## Usage Examples

### Check Permission in Current Branch
```typescript
const { hasPermissionInCurrentBranch } = usePermissions();

if (hasPermissionInCurrentBranch(PagePermission.MANAGE_STOCK_ITEMS)) {
  // User has permission in current branch
}
```

### Check Permission in Specific Branch
```typescript
const { hasPermissionInBranch } = usePermissions();

if (hasPermissionInBranch(PagePermission.VIEW_PAYMENTS_PAGE, 'branch-id-123')) {
  // User has permission in specified branch
}
```

### Get All Effective Permissions
```typescript
const { getEffectivePermissions } = usePermissions();
const effectivePerms = getEffectivePermissions();
```

## Permission Hierarchy

1. **Global Permissions** (applies everywhere)
   - User's `permissions` array
   - Always active regardless of branch

2. **Branch-Specific Permissions** (applies only in that branch)
   - User's `branchPermissions[branchId]` array
   - Only active when viewing that specific branch

3. **Role-Based Assignment**
   - Admin creates role with specific permissions
   - Role marked as Global OR assigned to specific branches
   - When role is updated, all users with that role get new permissions
   - Branch-specific roles only grant permissions in applicable branches

## Data Structure Example

### User with Mixed Permissions
```typescript
{
  uid: "user123",
  name: "John Manager",
  role: "BranchManager",
  permissions: [
    "view:dashboard",     // Global - sees dashboard everywhere
    "manage:own_profile"  // Global - can edit their profile everywhere
  ],
  branchPermissions: {
    "branch-main": [
      "view:stock_management",
      "manage:stock_items",
      "process:sales"
    ],
    "branch-secondary": [
      "view:stock_management"  // Can only view stock, not manage
    ]
  }
}
```

## Database Structure
In Firestore:
- Roles collection: Updated with `applicableBranches` and `isGlobalRole` fields
- Users collection: Each user can have `branchPermissions` object

## Backward Compatibility

✅ **Fully backward compatible:**
- Existing roles without `applicableBranches` treat as global roles
- Users without `branchPermissions` only use global `permissions`
- Existing permission checks continue to work
- No breaking changes to the API

## Admin Workflow

1. Create a new role
2. Choose: "Apply to All Branches" or select specific branches
3. Assign permissions (same UI as before)
4. Assign users to the role
5. Users automatically get branch-specific access

## Developer Notes

- Branch context must be available: `useBranch()` must be in a BranchProvider
- Use `hasPermissionInCurrentBranch()` for most permission checks
- Use `hasPermissionInBranch(perm, branchId)` for explicit branch checking
- Global permissions are always checked alongside branch permissions
- Permissions are merged (user gets both global AND branch-specific)

## Future Enhancements

Possible improvements:
- UI for assigning different roles to same user in different branches
- Permission templates per branch type
- Bulk permission assignment across branches
- Permission audit logs per branch
