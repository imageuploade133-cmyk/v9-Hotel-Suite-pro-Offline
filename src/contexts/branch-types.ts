/**
 * Branch Context Types
 *
 * This file contains types and constants for the branch context to avoid
 * circular dependencies between branch-context and user-context.
 */

// Collections that are isolated per-branch when in branch mode
export const BRANCH_ISOLATED_COLLECTIONS = [
  'stock',
  'stockSales',
  'heldSales',
  'stockCategories',
  'services',
  'serviceCategories',
  'stockAlerts',
  'stockRestock',
  'posCategories',
  'posSettings',
  'runningTables',
  'creditSales',
  'posCustomers',
  'suppliers',
  'stockKeeper',
  'stockKeeperItems',
  'transferLog',
  'docketHistory',
  'stockReturns',
  'pointOfSales', // POS terminals collection
];

// Collections that are isolated per-POS when in POS mode
export const POS_ISOLATED_COLLECTIONS = [
  'stock',
  'stockSales',
  'heldSales',
  'runningTables',
  'creditSales',
  'posCustomers',
];

export interface PointOfSale {
  id: string;
  name: string;
  type: 'hotel' | 'restaurant' | 'main' | 'other';
  branchId: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}
