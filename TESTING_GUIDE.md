# Permission System Testing Guide

## Quick Start

The permission system has been implemented with the following key changes:

### What Was Fixed

1. **Use-Permissions Hook** - Now actually validates permissions instead of granting all access
2. **RETURN_DOCKET Permission** - New permission added specifically for return docket functionality
3. **UI Controls** - Refund and return buttons now respect user permissions

## How to Test

### Test Case 1: User WITHOUT Return Docket Permission

**Setup:**
1. Go to Roles & Permissions page
2. Create/Edit a role with these POS permissions:
   - ✅ VIEW_POS
   - ✅ PROCESS_SALES
   - ✅ APPLY_DISCOUNTS
   - ❌ RETURN_DOCKET (do NOT select this)
   - ❌ PROCESS_SALE_REFUNDS (do NOT select this)
3. Assign this role to a test user
4. Click "Resave Staff Permissions" button (if visible)

**Expected Behavior:**
- Login as the test user
- Go to Running Tables page
- The "Return Items" button should be **HIDDEN or DISABLED**
- If they click it anyway, toast shows: "You do not have permission to process return dockets"

---

### Test Case 2: User WITHOUT Process Sale Refunds Permission

**Setup:**
1. Create/Edit a role with these permissions:
   - ✅ VIEW_PAYMENTS_PAGE
   - ❌ PROCESS_SALE_REFUNDS (do NOT select)
2. Assign to test user

**Expected Behavior:**
- Login as test user
- Go to Payments page
- The "Issue Refund" button should be **DISABLED** in the actions menu
- If they try to open RefundDialog, toast shows: "You do not have permission to process refunds"

---

### Test Case 3: User WITH All Required Permissions

**Setup:**
1. Create/Edit a role with:
   - ✅ VIEW_POS
   - ✅ PROCESS_SALES
   - ✅ RETURN_DOCKET
   - ✅ PROCESS_SALE_REFUNDS

**Expected Behavior:**
- "Return Items" button is **VISIBLE and ENABLED** in Running Tables
- "Issue Refund" button is **ENABLED** in Payments page
- User can successfully process returns and refunds

---

### Test Case 4: Temporary Profile Users

**Note:** Users without a Firestore profile get a temporary profile with ALL permissions for backwards compatibility.

**Test:**
1. Create a user in Firebase Auth but don't assign them a role
2. Login as that user
3. They should have access to all features (temporary fallback)

---

## Locations to Check

### 1. Roles Page (`/roles`)
- **Where:** Create or edit a role
- **What to Look For:** New "Process return dockets and issue refunds for returned items" permission under POS section
- **Expected:** Permission appears in the list and can be checked/unchecked

### 2. Running Tables Page (`/running-tables`)
- **Active Tables Tab**
- **Click Actions menu (⋮) on any running table**
- **Look For:** "Return Items" button
  - If user lacks permission → Button is HIDDEN
  - If user has permission → Button is VISIBLE

### 3. Payments Page (`/payments`)
- **Click Actions menu (⋮) on any payment**
- **Look For:** "Issue Refund" option
  - If user lacks permission → Option is DISABLED (grayed out)
  - If user has permission → Option is ENABLED

---

## Permission String Reference

For debugging or manual testing:

```
POS Return/Refund Permissions:
- 'process:return_docket'       # Return dockets from running tables
- 'process:sale_refunds'        # Refunds from payments page

Both are located in the "Point of Sale (POS)" permission group
```

---

## Verification Steps

After making changes to roles, follow these steps:

1. **In Roles Page:**
   - Click "Resave Staff Permissions" button (if available)
   - Wait for success toast

2. **For the Affected User:**
   - They may need to log out and log back in
   - Or refresh the page to see updated permissions

3. **Verify in UI:**
   - Navigate to Running Tables or Payments
   - Check if buttons appear/disappear as expected

---

## Common Issues & Solutions

### Issue: Permission changes not taking effect
**Solution:**
- Click "Resave Staff Permissions" in Roles page
- User should log out and log back in
- Check user's profile in Firebase - permissions array should be updated

### Issue: Button still visible but permission not granted
**Solution:**
- Check browser console for any errors
- Verify permissions are properly synced in Firebase
- Clear browser cache and refresh

### Issue: Test user has too many permissions
**Solution:**
- When creating test role, explicitly UNCHECK the permissions you want to restrict
- Don't leave them checked

---

## Files Modified (For Reference)

1. `src/lib/permissions.ts` - Added RETURN_DOCKET enum and to POS group
2. `src/hooks/use-permissions.ts` - Fixed permission checking logic
3. `src/app/(protected)/running-tables/page.tsx` - Added RETURN_DOCKET checks
4. `src/components/payments/refund-dialog.tsx` - Added permission validation
5. `src/components/payments/columns.tsx` - Added permission check for refund button

---

## Success Criteria

✅ Users without RETURN_DOCKET cannot see/click return items buttons
✅ Users without PROCESS_SALE_REFUNDS cannot see/click refund buttons
✅ Permission errors display user-friendly toasts
✅ Permissions sync properly via "Resave Staff Permissions"
✅ New RETURN_DOCKET permission appears in role editing UI
✅ Backwards compatibility maintained for temp profiles
