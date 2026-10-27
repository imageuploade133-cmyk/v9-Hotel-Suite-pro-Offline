import { PagePermission } from './permissions';

// Global-only permissions - These can ONLY be assigned at admin/global level, not per-branch
export const GLOBAL_ONLY_PERMISSIONS = new Set([
  // Settings & Admin
  PagePermission.MANAGE_GENERAL_SETTINGS,
  PagePermission.MANAGE_ROOMS_SETTINGS,
  PagePermission.MANAGE_BILLING_SETTINGS,
  PagePermission.MANAGE_BRANCHES,

  // Staff & Roles
  PagePermission.MANAGE_ROLES,
  PagePermission.MANAGE_STAFF,
  PagePermission.VIEW_STAFF_ANALYTICS,
  PagePermission.VIEW_STAFF_WORKING_HOURS,

  // Global reports & audit
  PagePermission.VIEW_GLOBAL_AUDIT,
  PagePermission.VIEW_SETTINGS_PAGE,
  PagePermission.VIEW_SETTINGS_PAGE_2,
]);

// Branch-compatible permissions - These CAN be assigned per-branch
export const BRANCH_COMPATIBLE_PERMISSIONS = new Set([
  // Dashboard
  PagePermission.VIEW_DASHBOARD,
  PagePermission.VIEW_TODAYS_INCOME,

  // Bookings
  PagePermission.VIEW_BOOKINGS_PAGE,
  PagePermission.CREATE_BOOKING,
  PagePermission.EDIT_BOOKING,
  PagePermission.CANCEL_BOOKING,

  // Rooms & Housekeeping
  PagePermission.MANAGE_ROOM_STATUS,
  PagePermission.VIEW_ROOMS_PAGE,
  PagePermission.VIEW_CLEANING_PAGE,
  PagePermission.VIEW_LAUNDRY_PAGE,
  PagePermission.MANAGE_LAUNDRY_ORDERS,
  PagePermission.VIEW_MAINTENANCE_PAGE,

  // F&B
  PagePermission.VIEW_MENUS_PAGE,
  PagePermission.MANAGE_MENUS,
  PagePermission.VIEW_KITCHEN_PAGE,
  PagePermission.MANAGE_ORDERS,
  PagePermission.VIEW_RESTAURANT_PAGE,

  // POS
  PagePermission.VIEW_POS,
  PagePermission.PROCESS_SALES,
  PagePermission.APPLY_DISCOUNTS,
  PagePermission.PROCESS_SALE_REFUNDS,
  PagePermission.MANAGE_CREDIT_SALES,
  PagePermission.VIEW_SALES_REPORTS,
  PagePermission.VIEW_MY_SALES_HISTORY,
  PagePermission.MANAGE_POS_CUSTOMERS,
  PagePermission.MANAGE_POS_SETTINGS,
  PagePermission.MANAGE_POS_CATEGORIES,
  PagePermission.MANAGE_RUNNING_TABLES,

  // Stock
  PagePermission.VIEW_STOCK_MANAGEMENT,
  PagePermission.MANAGE_STOCK_ITEMS,
  PagePermission.TRANSFER_STOCK,
  PagePermission.VIEW_STOCK_ALERTS,
  PagePermission.RESTOCK_INVENTORY,
  PagePermission.VIEW_STOCK_AUDIT,
  PagePermission.MANAGE_STOCK_CATEGORIES,
  PagePermission.MANAGE_SUPPLIERS,

  // Accounting & Finance
  PagePermission.MANAGE_EXPENSES,
  PagePermission.VIEW_ACCOUNTING_PAGE,
  PagePermission.VIEW_PAYMENTS_PAGE,
  PagePermission.VIEW_GUEST_FOLIO,

  // Customers
  PagePermission.VIEW_CUSTOMERS_PAGE,
  PagePermission.MANAGE_CUSTOMERS,

  // Other Modules
  PagePermission.VIEW_GYM_PAGE,
  PagePermission.MANAGE_GYM_MEMBERS,
  PagePermission.VIEW_SALON_PAGE,
  PagePermission.MANAGE_SALON_ORDERS,
  PagePermission.VIEW_SERVICES_PAGE,
  PagePermission.VIEW_GUEST_REPORTS,
  PagePermission.MANAGE_GUEST_ENGAGEMENT,

  // Profile
  PagePermission.MANAGE_OWN_PROFILE,

  // Other
  PagePermission.VIEW_TUTORIAL_PAGE,
  PagePermission.MANAGE_WHATSAPP_MESSAGING,

  // Management Section
  PagePermission.VIEW_MANAGEMENT,
]);

/**
 * Get filtered permissions based on role scope (global vs branch-specific)
 * @param isGlobalRole - Whether the role is for global/admin use
 * @returns Array of permissions available for the role
 */
export function getAvailablePermissions(isGlobalRole: boolean): string[] {
  if (isGlobalRole) {
    // Global roles can use all permissions
    return Array.from(GLOBAL_ONLY_PERMISSIONS).concat(Array.from(BRANCH_COMPATIBLE_PERMISSIONS));
  } else {
    // Branch roles can only use branch-compatible permissions
    return Array.from(BRANCH_COMPATIBLE_PERMISSIONS);
  }
}

/**
 * Check if a permission can be assigned in branch-specific roles
 */
export function isBranchCompatiblePermission(permission: string): boolean {
  return BRANCH_COMPATIBLE_PERMISSIONS.has(permission as PagePermission);
}

/**
 * Check if a permission is global-only
 */
export function isGlobalOnlyPermission(permission: string): boolean {
  return GLOBAL_ONLY_PERMISSIONS.has(permission as PagePermission);
}
