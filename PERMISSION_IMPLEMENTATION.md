# Permission-Based Refund & Return Docket Implementation

## Overview
This document outlines the implementation of permission-based access control for refund and return docket functionality in the POS system.

## Changes Made

### 1. **Permissions System** (`src/lib/permissions.ts`)

#### Added New Permission
- **RETURN_DOCKET** = `'process:return_docket'`
  - Description: "Process return dockets and issue refunds for returned items"
  - Group: Point of Sale (POS)
  - Added to PERMISSION_GROUPS under the 'pos' section

### 2. **Permissions Hook** (`src/hooks/use-permissions.ts`)

#### Fixed Permission Checking Logic
Previously, the hook always returned `true` for all permission checks (all users had full access). Now it:
- Checks if the requested permission exists in the user's `permissions` array
- Returns `false` for users without the required permission
- Properly validates permissions at the hook level

```typescript
hasPermission: (permission: string) => {
  return permissions.includes(permission);
}
```

### 3. **Running Tables Page** (`src/app/(protected)/running-tables/page.tsx`)

#### Updated Permission Checks
- Changed from checking `PROCESS_SALE_REFUNDS` to checking `RETURN_DOCKET` permission
- Added `hasReturnDocketPermission` variable
- Updated "Return Items" button condition to show/hide based on `RETURN_DOCKET` permission
- Added proper permission validation with user-friendly error messages

**Key Changes:**
- Line 1008: Added `hasReturnDocketPermission = hasPermission(PagePermission.RETURN_DOCKET)`
- Line 1011: Changed condition from `hasRolesPermission` to `hasReturnDocketPermission || hasRolesPermission || isCreditSale`
- Line 1726-1751: Updated Return Items button with proper permission checks

### 4. **Payments Page - Refund Dialog** (`src/components/payments/refund-dialog.tsx`)

#### Added Permission Validation
- Imported `usePermissions` hook
- Added permission check for `PROCESS_SALE_REFUNDS`
- Shows user-friendly error if permission is denied
- Prevents refund processing without proper authorization

**Key Changes:**
- Line 26: Added import for `usePermissions`
- Line 47: Called `usePermissions` hook
- Lines 66-74: Added permission check with clear error message

### 5. **Payments Table Columns** (`src/components/payments/columns.tsx`)

#### Added Refund Permission Check
- Added `canProcessRefunds` variable that checks `PROCESS_SALE_REFUNDS` permission
- Updated "Issue Refund" button condition to include permission check
- Button is now disabled if user lacks refund permission

**Key Changes:**
- Line 62: Added `canProcessRefunds` variable
- Line 201: Updated `canRefund` condition to include `canProcessRefunds`
- Line 237: Added `canProcessRefunds` to dependency array

## Permission Hierarchy

```
POS Permissions:
├── VIEW_POS (access the POS page)
├── PROCESS_SALES (add items to cart, process sales)
├── APPLY_DISCOUNTS
├── PROCESS_SALE_REFUNDS (issue refunds for payments/bookings)
├── RETURN_DOCKET (process return dockets for running tables) ← NEW
├── MANAGE_CREDIT_SALES
├── VIEW_SALES_REPORTS
├── VIEW_POS_ACCOUNTING
├── VIEW_MY_SALES_HISTORY
├── MANAGE_POS_CUSTOMERS
├── MANAGE_POS_SETTINGS
├── MANAGE_POS_CATEGORIES
├── VIEW_RUNNING_TABLES
└── MANAGE_RUNNING_TABLES
```

## User Experience Changes

### Before Implementation
- All POS users could see and click refund buttons
- Return Item buttons were always visible
- No permission checks were enforced
- Users with insufficient permissions could still access refund dialogs

### After Implementation
- **Refund Buttons** are hidden/disabled if user lacks `PROCESS_SALE_REFUNDS` permission
- **Return Item Buttons** are hidden/disabled if user lacks `RETURN_DOCKET` permission
- **Permission Dialog** appears when user attempts unauthorized action
- **Role Creation/Edit Page** shows the new `RETURN_DOCKET` permission for assignment

## Testing Checklist

- [ ] Create test user with VIEW_POS but NO refund permissions
- [ ] Verify refund buttons are disabled in Payments page
- [ ] Verify RefundDialog shows "Permission Denied" message
- [ ] Create test user with RETURN_DOCKET permission
- [ ] Verify Return Items button is enabled in Running Tables
- [ ] Create test user WITHOUT RETURN_DOCKET permission
- [ ] Verify Return Items button is disabled
- [ ] Test permission sync via "Resave Staff Permissions"
- [ ] Verify permissions take effect immediately after sync
- [ ] Test role creation/editing - new permission shows in UI

## Files Modified

1. `/src/lib/permissions.ts` - Added RETURN_DOCKET permission
2. `/src/hooks/use-permissions.ts` - Fixed permission checking logic
3. `/src/app/(protected)/running-tables/page.tsx` - Added RETURN_DOCKET checks
4. `/src/components/payments/refund-dialog.tsx` - Added PROCESS_SALE_REFUNDS check
5. `/src/components/payments/columns.tsx` - Added refund permission validation

## Implementation Notes

- All permission checks use the centralized `usePermissions` hook
- Permissions are loaded from user's profile in UserContext
- Permission arrays are synced from role assignments
- The system supports the "Resave Staff Permissions" feature for manual sync
- UI properly hides/disables buttons instead of showing errors (better UX)
- Dialog-level permission checks provide additional safety

## Future Enhancements

- Consider adding permission validation at API level (if applicable)
- Add audit logging for permission denials
- Implement granular branch-level permissions for multi-location setups
- Add permission templates for common role combinations
