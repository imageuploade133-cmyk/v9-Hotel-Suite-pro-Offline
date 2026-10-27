

export enum PagePermission {
  // Dashboard
  VIEW_DASHBOARD = 'view:dashboard',
  VIEW_TODAYS_INCOME = 'view:todays_income',

  // Bookings
  VIEW_BOOKINGS_PAGE = 'view:bookings',
  CREATE_BOOKING = 'create:booking',
  EDIT_BOOKING = 'edit:booking',
  CANCEL_BOOKING = 'cancel:booking',

  // Rooms & Housekeeping
  MANAGE_ROOM_STATUS = 'manage:room_status',
  VIEW_ROOMS_PAGE = 'view:rooms_page',
  VIEW_CLEANING_PAGE = 'view:cleaning',
  VIEW_LAUNDRY_PAGE = 'view:laundry',
  MANAGE_LAUNDRY_ORDERS = 'manage:laundry_orders',
  VIEW_MAINTENANCE_PAGE = 'view:maintenance',

  // F&B
  VIEW_MENUS_PAGE = 'view:menus',
  MANAGE_MENUS = 'manage:menus',
  VIEW_KITCHEN_PAGE = 'view:kitchen',
  MANAGE_ORDERS = 'manage:orders',
  VIEW_RESTAURANT_PAGE = 'view:restaurant',

  // POS
  VIEW_POS = 'view:pos',
  PROCESS_SALES = 'process:sales',
  APPLY_DISCOUNTS = 'apply:discounts',
  PROCESS_SALE_REFUNDS = 'process:sale_refunds',
  RETURN_DOCKET = 'process:return_docket',
  MANAGE_CREDIT_SALES = 'manage:credit_sales',
  VIEW_SALES_REPORTS = 'view:sales_reports',
  VIEW_POS_ACCOUNTING = 'view:pos_accounting',
  VIEW_MY_SALES_HISTORY = 'view:my_sales_history',
  MANAGE_POS_CUSTOMERS = 'manage:pos_customers',
  MANAGE_POS_SETTINGS = 'manage:pos_settings',
  MANAGE_POS_CATEGORIES = 'manage:pos_categories',
  VIEW_RUNNING_TABLES = 'view:running_tables',
  MANAGE_RUNNING_TABLES = 'manage:running_tables',

  // Stock
  VIEW_STOCK_MANAGEMENT = 'view:stock_management',
  MANAGE_STOCK_ITEMS = 'manage:stock_items',
  TRANSFER_STOCK = 'transfer:stock',
  TRANSFER_STOCK_TO_BRANCH = 'transfer:stock_to_branch',
  VIEW_STOCK_ALERTS = 'view:stock_alerts',
  RESTOCK_INVENTORY = 'restock:inventory',
  VIEW_STOCK_AUDIT = 'view:stock_audit',
  MANAGE_STOCK_CATEGORIES = 'manage:stock_categories',
  MANAGE_SUPPLIERS = 'manage:suppliers',

  // Accounting & Finance
  MANAGE_EXPENSES = 'manage:expenses',
  VIEW_ACCOUNTING_PAGE = 'view:accounting',
  VIEW_PAYMENTS_PAGE = 'view:payments',
  VIEW_GUEST_FOLIO = 'view:guest_folio',

  // Customers
  VIEW_CUSTOMERS_PAGE = 'view:customers',
  MANAGE_CUSTOMERS = 'manage:customers',

  // Staff
  MANAGE_STAFF = 'manage:staff',
  MANAGE_ROLES = 'manage:roles',
  VIEW_STAFF_ANALYTICS = 'view:staff_analytics',
  VIEW_STAFF_WORKING_HOURS = 'view:staff_working_hours',

  // Settings & Admin
  VIEW_SETTINGS_PAGE = 'view:settings',
  MANAGE_GENERAL_SETTINGS = 'manage:general_settings',
  MANAGE_ROOMS_SETTINGS = 'manage:rooms_settings',
  MANAGE_BILLING_SETTINGS = 'manage:billing_settings',
  MANAGE_BRANCHES = 'manage:branches',

  // Profile
  MANAGE_OWN_PROFILE = 'manage:own_profile',

  // Other Modules
  VIEW_GYM_PAGE = 'view:gym',
  MANAGE_GYM_MEMBERS = 'manage:gym_members',
  VIEW_SALON_PAGE = 'view:salon',
  MANAGE_SALON_ORDERS = 'manage:salon_orders',
  VIEW_SERVICES_PAGE = 'view:services',
  VIEW_GUEST_REPORTS = 'view:guest_reports',
  MANAGE_GUEST_ENGAGEMENT = 'manage:guest_engagement',
  VIEW_TUTORIAL_PAGE = 'view:tutorial',
  MANAGE_WHATSAPP_MESSAGING = 'manage:whatsapp_messaging',
  VIEW_GLOBAL_AUDIT = 'view:global_audit',
  VIEW_SETTINGS_PAGE_2 = 'view:settings_page_2',

  // Management Section
  VIEW_MANAGEMENT = 'view:management',
}

export const STANDALONE_PERMISSIONS = new Set([
  // These permissions can be assigned individually and are not part of a larger group on the UI
  PagePermission.MANAGE_OWN_PROFILE,
  PagePermission.TRANSFER_STOCK,
  PagePermission.VIEW_MY_SALES_HISTORY,
]);

export const PERMISSION_GROUPS = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    permissions: [
      { id: PagePermission.VIEW_DASHBOARD, description: 'View the main dashboard' },
      { id: PagePermission.VIEW_TODAYS_INCOME, description: 'View Today\'s Income card on dashboard' },
    ],
  },
  {
    id: 'bookings',
    name: 'Bookings & Check-ins',
    permissions: [
      { id: PagePermission.VIEW_BOOKINGS_PAGE, description: 'View bookings, reservations, and active check-ins lists' },
      { id: PagePermission.CREATE_BOOKING, description: 'Create new bookings' },
      { id: PagePermission.EDIT_BOOKING, description: 'Edit existing bookings (check-in, check-out, etc.)' },
      { id: PagePermission.CANCEL_BOOKING, description: 'Cancel a booking' },
    ],
  },
  {
    id: 'housekeeping',
    name: 'Rooms & Housekeeping',
    permissions: [
      { id: PagePermission.VIEW_ROOMS_PAGE, description: 'Access the Manage Rooms page to view, add, and manage room inventory' },
      { id: PagePermission.MANAGE_ROOM_STATUS, description: 'Change room statuses (Vacant, Occupied, etc.)' },
      { id: PagePermission.VIEW_CLEANING_PAGE, description: 'View and manage cleaning tasks' },
      { id: PagePermission.VIEW_LAUNDRY_PAGE, description: 'View and manage laundry service' },
      { id: PagePermission.MANAGE_LAUNDRY_ORDERS, description: 'Create, update, and manage laundry orders' },
      { id: PagePermission.VIEW_MAINTENANCE_PAGE, description: 'View and manage maintenance requests' },
    ],
  },
  {
    id: 'pos',
    name: 'Point of Sale (POS)',
    permissions: [
      { id: PagePermission.VIEW_POS, description: 'Access the Point of Sale interface' },
      { id: PagePermission.PROCESS_SALES, description: 'Process new sales transactions' },
      { id: PagePermission.APPLY_DISCOUNTS, description: 'Apply discounts to sales' },
      { id: PagePermission.PROCESS_SALE_REFUNDS, description: 'Issue refunds for payments and sales' },
      { id: PagePermission.RETURN_DOCKET, description: 'Process return dockets and issue refunds for returned items' },
      { id: PagePermission.MANAGE_CREDIT_SALES, description: 'Manage sales made on credit' },
      { id: PagePermission.VIEW_SALES_REPORTS, description: 'View reports on product sales and history' },
      { id: PagePermission.VIEW_POS_ACCOUNTING, description: 'View POS accounting, running tables, and staff performance' },
      { id: PagePermission.VIEW_MY_SALES_HISTORY, description: 'View personal sales history and transaction details' },
      { id: PagePermission.MANAGE_POS_CUSTOMERS, description: 'Manage customers specific to the POS' },
      { id: PagePermission.MANAGE_POS_SETTINGS, description: 'Customize POS receipt and invoice settings' },
      { id: PagePermission.MANAGE_POS_CATEGORIES, description: 'Manage categories for POS products and services' },
      { id: PagePermission.VIEW_RUNNING_TABLES, description: 'View running tables and sales data' },
      { id: PagePermission.MANAGE_RUNNING_TABLES, description: 'Reset, delete, and manage running tables' },
    ],
  },
  {
    id: 'stock',
    name: 'Stock & Inventory',
    permissions: [
      { id: PagePermission.VIEW_STOCK_MANAGEMENT, description: 'View stock levels and inventory data' },
      { id: PagePermission.MANAGE_STOCK_ITEMS, description: 'Add, edit, or remove stock items' },
      { id: PagePermission.TRANSFER_STOCK, description: 'Transfer items from staging to main inventory'},
      { id: PagePermission.TRANSFER_STOCK_TO_BRANCH, description: 'Transfer items to another branch'},
      { id: PagePermission.VIEW_STOCK_ALERTS, description: 'View alerts for low or out-of-stock items' },
      { id: PagePermission.RESTOCK_INVENTORY, description: 'Create and manage restock orders' },
      { id: PagePermission.VIEW_STOCK_AUDIT, description: 'View the audit trail for stock changes' },
      { id: PagePermission.MANAGE_STOCK_CATEGORIES, description: 'Manage categories for stock items' },
      { id: PagePermission.MANAGE_SUPPLIERS, description: 'Manage supplier information' },
    ],
  },
  {
    id: 'f&b',
    name: 'Food & Beverage',
    permissions: [
      { id: PagePermission.VIEW_MENUS_PAGE, description: 'View and manage all menus' },
      { id: PagePermission.MANAGE_MENUS, description: 'Create, edit, and delete menus and their items' },
      { id: PagePermission.VIEW_KITCHEN_PAGE, description: 'View the live kitchen order screen' },
      { id: PagePermission.MANAGE_ORDERS, description: 'Update the status of kitchen orders' },
      { id: PagePermission.VIEW_RESTAURANT_PAGE, description: 'View the restaurant page' },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounting & Finance',
    permissions: [
      { id: PagePermission.MANAGE_EXPENSES, description: 'Add, edit, or void expenses' },
      { id: PagePermission.VIEW_ACCOUNTING_PAGE, description: 'View detailed financial reports' },
      { id: PagePermission.VIEW_PAYMENTS_PAGE, description: 'View all payment transactions' },
      { id: PagePermission.VIEW_GUEST_FOLIO, description: 'View and print detailed guest folios' },
    ],
  },
  {
    id: 'customers',
    name: 'Customer Management',
    permissions: [
      { id: PagePermission.VIEW_CUSTOMERS_PAGE, description: 'View hotel customer profiles' },
      { id: PagePermission.MANAGE_CUSTOMERS, description: 'Create, edit, or delete hotel customer profiles' },
    ],
  },
  {
    id: 'staff',
    name: 'Staff Management',
    permissions: [
      { id: PagePermission.MANAGE_STAFF, description: 'Manage staff accounts (invite, edit, delete)' },
      { id: PagePermission.MANAGE_ROLES, description: 'Create, edit, and assign roles and permissions' },
      { id: PagePermission.VIEW_STAFF_ANALYTICS, description: 'View staff performance and sales data' },
      { id: PagePermission.VIEW_STAFF_WORKING_HOURS, description: 'View staff login times and attendance' },
    ],
  },
   {
    id: 'other-modules',
    name: 'Other Modules',
    permissions: [
      { id: PagePermission.VIEW_GYM_PAGE, description: 'View the gym management page' },
      { id: PagePermission.MANAGE_GYM_MEMBERS, description: 'Manage gym member registrations and renewals' },
      { id: PagePermission.VIEW_SALON_PAGE, description: 'View the salon management page' },
      { id: PagePermission.MANAGE_SALON_ORDERS, description: 'Create and manage salon service orders' },
      { id: PagePermission.VIEW_SERVICES_PAGE, description: 'View and manage services and food items' },
      { id: PagePermission.VIEW_GUEST_REPORTS, description: 'View and manage reports submitted by guests' },
      { id: PagePermission.MANAGE_GUEST_ENGAGEMENT, description: 'Manage QR codes and links for guest interaction' },
    ],
  },
  {
    id: 'management',
    name: 'Management',
    permissions: [
      { id: PagePermission.VIEW_MANAGEMENT, description: 'Access the Management section in the sidebar menu' },
    ],
  },
  {
    id: 'admin',
    name: 'Administration',
    permissions: [
      { id: PagePermission.VIEW_TUTORIAL_PAGE, description: 'Access the application tutorial' },
      { id: PagePermission.MANAGE_WHATSAPP_MESSAGING, description: 'Send bulk WhatsApp messages to customer groups' },
      { id: PagePermission.VIEW_SETTINGS_PAGE, description: 'View application settings' },
      { id: PagePermission.VIEW_SETTINGS_PAGE_2, description: 'View the second settings page' },
      { id: PagePermission.MANAGE_GENERAL_SETTINGS, description: 'Manage general business and system settings' },
      { id: PagePermission.MANAGE_ROOMS_SETTINGS, description: 'Manage room types, facilities, and statuses' },
      { id: PagePermission.MANAGE_BILLING_SETTINGS, description: 'Manage payment methods and invoice/receipt text' },
      { id: PagePermission.VIEW_GLOBAL_AUDIT, description: 'View the global audit log for all system activities' },
      { id: PagePermission.MANAGE_BRANCHES, description: 'Create and manage branches' },
    ],
  },
  {
    id: 'custom_statuses',
    name: 'Custom Room Statuses',
    permissions: [],
  }
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(group => group.permissions.map(p => p.id));

// Default landing pages for different permission sets - ordered by priority
export const DEFAULT_LANDING_PAGES = [
  { permission: PagePermission.VIEW_DASHBOARD, path: '/dashboard' },
  { permission: PagePermission.VIEW_POS, path: '/pos' },
  { permission: PagePermission.VIEW_KITCHEN_PAGE, path: '/kitchen' },
  { permission: PagePermission.VIEW_RESTAURANT_PAGE, path: '/restaurant' },
  { permission: PagePermission.VIEW_BOOKINGS_PAGE, path: '/bookings' },
  { permission: PagePermission.VIEW_ROOMS_PAGE, path: '/rooms' },
  { permission: PagePermission.VIEW_CLEANING_PAGE, path: '/cleaning' },
  { permission: PagePermission.VIEW_LAUNDRY_PAGE, path: '/laundry' },
  { permission: PagePermission.VIEW_STOCK_MANAGEMENT, path: '/stock-management' },
  { permission: PagePermission.VIEW_SALES_REPORTS, path: '/sales-history' },
  { permission: PagePermission.VIEW_MY_SALES_HISTORY, path: '/my-sales-history' },
  { permission: PagePermission.VIEW_CUSTOMERS_PAGE, path: '/customers' },
  { permission: PagePermission.VIEW_ACCOUNTING_PAGE, path: '/accounting' },
  { permission: PagePermission.VIEW_PAYMENTS_PAGE, path: '/payments' },
  { permission: PagePermission.MANAGE_EXPENSES, path: '/expenses' },
  { permission: PagePermission.VIEW_GYM_PAGE, path: '/gym-management' },
  { permission: PagePermission.VIEW_SALON_PAGE, path: '/barbing-salon' },
  { permission: PagePermission.MANAGE_STAFF, path: '/staff' },
  { permission: PagePermission.MANAGE_ROLES, path: '/roles' },
  { permission: PagePermission.MANAGE_OWN_PROFILE, path: '/profile' },
];

/**
 * Get the appropriate landing page URL based on user's permissions
 * Falls back to the first available permission or /profile
 */
export function getLandingPage(permissions: string[]): string {
  // Find the first landing page that matches any of the user's permissions
  for (const landing of DEFAULT_LANDING_PAGES) {
    if (permissions.includes(landing.permission)) {
      return landing.path;
    }
  }

  // If no specific landing page matched, check if user has any permissions
  // and redirect to the first available one
  if (permissions.length > 0) {
    // Try to find a matching route based on any permission
    const firstPermission = permissions[0];
    const routeMapping: Record<string, string> = {
      [PagePermission.VIEW_DASHBOARD]: '/dashboard',
      [PagePermission.VIEW_BOOKINGS_PAGE]: '/bookings',
      [PagePermission.CREATE_BOOKING]: '/bookings/create',
      [PagePermission.VIEW_POS]: '/pos',
      [PagePermission.VIEW_KITCHEN_PAGE]: '/kitchen',
      [PagePermission.VIEW_RESTAURANT_PAGE]: '/restaurant',
      [PagePermission.VIEW_ROOMS_PAGE]: '/rooms',
      [PagePermission.VIEW_CLEANING_PAGE]: '/cleaning',
      [PagePermission.VIEW_LAUNDRY_PAGE]: '/laundry',
      [PagePermission.VIEW_MAINTENANCE_PAGE]: '/status/maintenance',
      [PagePermission.VIEW_STOCK_MANAGEMENT]: '/stock-management',
      [PagePermission.VIEW_STOCK_ALERTS]: '/stock-alerts',
      [PagePermission.VIEW_SALES_REPORTS]: '/sales-history',
      [PagePermission.VIEW_MY_SALES_HISTORY]: '/my-sales-history',
      [PagePermission.MANAGE_CREDIT_SALES]: '/credit-sales',
      [PagePermission.VIEW_CUSTOMERS_PAGE]: '/customers',
      [PagePermission.VIEW_POS_ACCOUNTING]: '/pos-accounting',
      [PagePermission.MANAGE_POS_CUSTOMERS]: '/pos-customers',
      [PagePermission.VIEW_ACCOUNTING_PAGE]: '/accounting',
      [PagePermission.VIEW_PAYMENTS_PAGE]: '/payments',
      [PagePermission.MANAGE_EXPENSES]: '/expenses',
      [PagePermission.VIEW_GYM_PAGE]: '/gym-management',
      [PagePermission.VIEW_SALON_PAGE]: '/barbing-salon',
      [PagePermission.MANAGE_STAFF]: '/staff',
      [PagePermission.MANAGE_ROLES]: '/roles',
      [PagePermission.VIEW_STAFF_ANALYTICS]: '/staff-analytics',
      [PagePermission.VIEW_TUTORIAL_PAGE]: '/tutorial',
      [PagePermission.MANAGE_WHATSAPP_MESSAGING]: '/whatsapp',
      [PagePermission.VIEW_SETTINGS_PAGE]: '/settings',
      [PagePermission.MANAGE_OWN_PROFILE]: '/profile',
    };

    if (routeMapping[firstPermission]) {
      return routeMapping[firstPermission];
    }
  }

  // Ultimate fallback - profile page (all authenticated users should have this)
  return '/profile';
}
