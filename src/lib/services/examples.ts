/**
 * Inventory Service Usage Examples
 *
 * This file demonstrates how to use the inventory service layer
 * for common operations.
 */

import {
  createInventorySpace,
  getInventorySpace,
  deleteInventorySpace,
  cloneInventorySpace,
  hasInventoryPermission,
  getUserAccessibleInventorySpaces,
  validateInventoryCollections,
  migrateInventorySpacesForAlerts,
} from './inventory-service';
import type { InventoryCloneOptions } from '@/lib/types';

// ============================================================================
// EXAMPLE 1: Creating a New Inventory
// ============================================================================

export async function example1_createInventory(firestore: any, user: any) {
  const result = await createInventorySpace(
    firestore,
    {
      name: 'Main Bar',
      description: 'Hotel main bar inventory',
      iconName: 'Wine',
      color: '#6366f1',
      createdBy: user.uid,
      createdByName: user.name,
    },
    {
      cloneWithData: false, // Don't clone data, just structure
    }
  );

  if (result.success) {
    console.log(`Inventory created with ID: ${result.inventoryId}`);
    // The inventory now has isolated collections:
    // - inv_stock_main_bar_abc123
    // - inv_sales_main_bar_abc123
    // - inv_held_main_bar_abc123
    // - inv_pos_customers_main_bar_abc123
    // - inv_recent_tx_main_bar_abc123
    // - inv_alerts_main_bar_abc123
  } else {
    console.error(`Failed to create inventory: ${result.error}`);
  }

  return result;
}

// ============================================================================
// EXAMPLE 2: Getting User's Accessible Inventories
// ============================================================================

export async function example2_getUserInventories(
  firestore: any,
  user: any
) {
  const inventories = await getUserAccessibleInventorySpaces(
    firestore,
    user.permissions
  );

  console.log(`Found ${inventories.length} accessible inventories:`);
  inventories.forEach((inv) => {
    console.log(`  - ${inv.name} (ID: ${inv.id})`);
  });

  return inventories;
}

// ============================================================================
// EXAMPLE 3: Checking Inventory Permissions
// ============================================================================

export function example3_checkPermissions(
  userPermissions: string[],
  inventoryId: string
) {
  const permissions = [
    { name: 'View Inventory', key: 'view' },
    { name: 'Access POS', key: 'pos' },
    { name: 'View Stock Alerts', key: 'alerts' },
    { name: 'View Sales History', key: 'sales' },
    { name: 'Manage Customers', key: 'customers' },
  ];

  console.log(`\nPermissions for inventory ${inventoryId}:`);
  permissions.forEach((perm) => {
    const hasAccess = hasInventoryPermission(
      userPermissions,
      inventoryId,
      perm.key
    );
    console.log(`  ${hasAccess ? 'YES' : 'NO'} ${perm.name}`);
  });
}

// ============================================================================
// EXAMPLE 4: Switching Between Inventories in UI
// ============================================================================

export async function example4_switchInventory(
  firestore: any,
  currentInventoryId: string,
  targetInventoryId: string
) {
  // Get the target inventory
  const targetInventory = await getInventorySpace(firestore, targetInventoryId);

  if (!targetInventory) {
    console.error('Inventory not found');
    return null;
  }

  // Update UI context (in React component)
  // const { setCurrentInventory } = useInventory();
  // setCurrentInventory(targetInventory);

  console.log(`Switched to: ${targetInventory.name}`);
  console.log(`   Stock collection: ${targetInventory.stockCollection}`);
  console.log(`   Sales collection: ${targetInventory.salesCollection}`);

  return targetInventory;
}

// ============================================================================
// EXAMPLE 5: Cloning an Inventory
// ============================================================================

export async function example5_cloneInventory(
  firestore: any,
  sourceInventoryId: string
) {
  const result = await cloneInventorySpace(
    firestore,
    sourceInventoryId,
    'Gift Shop Copy',
    {
      cloneWithData: true, // Copy stock items from source
      permissions: [], // Use default permissions
    }
  );

  if (result.success) {
    console.log(`Inventory cloned with ID: ${result.inventoryId}`);
  } else {
    console.error(`Failed to clone: ${result.error}`);
  }

  return result;
}

// ============================================================================
// EXAMPLE 6: Validating Inventory Collections
// ============================================================================

export async function example6_validateInventory(
  firestore: any,
  inventoryId: string
) {
  const inventory = await getInventorySpace(firestore, inventoryId);

  if (!inventory) {
    console.error('Inventory not found');
    return;
  }

  const validation = await validateInventoryCollections(firestore, inventory);

  if (validation.isValid) {
    console.log(`All collections are valid for "${inventory.name}"`);
  } else {
    console.log(`Missing collections for "${inventory.name}":`);
    validation.missingCollections.forEach((col) => {
      console.log(`  - ${col}`);
    });
  }

  return validation;
}

// ============================================================================
// EXAMPLE 7: Running Migration
// ============================================================================

export async function example7_migrateInventories(firestore: any) {
  console.log('Starting inventory migration...');

  const result = await migrateInventorySpacesForAlerts(firestore);

  if (result.success) {
    console.log(`\nMigration completed successfully!`);
    console.log(`   Migrated ${result.migrated} inventories`);

    if (result.errors.length > 0) {
      console.log(`\nErrors encountered:`);
      result.errors.forEach((error) => {
        console.log(`   - ${error}`);
      });
    }
  } else {
    console.log(`Migration failed`);
  }

  return result;
}

// ============================================================================
// EXAMPLE 8: Deleting an Inventory (Destructive)
// ============================================================================

export async function example8_deleteInventory(
  firestore: any,
  inventoryId: string
) {
  // WARNING: This permanently deletes all data!
  const confirmDelete = window.confirm(
    'Are you sure you want to delete this inventory? All data will be permanently lost!'
  );

  if (!confirmDelete) {
    console.log('Delete cancelled');
    return;
  }

  const result = await deleteInventorySpace(firestore, inventoryId);

  if (result.success) {
    console.log('Inventory deleted successfully');
    // Refresh inventory context in UI
    // const { refreshInventories } = useInventory();
    // await refreshInventories();
  } else {
    console.error(`Failed to delete: ${result.error}`);
  }

  return result;
}

// ============================================================================
// EXAMPLE 9: React Component Integration
// ============================================================================

/**
 * Example React component showing inventory service integration
 */
export function example9_reactComponent() {
  return `
import { useInventory } from '@/contexts/inventory-context';
import { createInventorySpace, hasInventoryPermission } from '@/lib/services/inventory-service';
import { useUser } from '@/contexts/user-context';
import { useState } from 'react';

function InventoryManager() {
  const { userProfile } = useUser();
  const {
    currentInventory,
    accessibleInventories,
    setCurrentInventory,
    refreshInventories,
    hasPermission
  } = useInventory();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateInventory = async () => {
    setIsLoading(true);
    try {
      const result = await createInventorySpace(firestore, {
        name: 'New Inventory',
        description: 'A new inventory space',
        createdBy: userProfile.uid,
        createdByName: userProfile.name
      });

      if (result.success) {
        await refreshInventories();
        // Optionally switch to the new inventory
        await switchInventory(result.inventoryId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitch = async (inventoryId: string) => {
    await switchInventory(inventoryId);
  };

  const canAccessPOS = currentInventory
    ? hasPermission(currentInventory.id, 'pos')
    : false;

  return (
    <div>
      {/* Inventory dropdown */}
      <select
        value={currentInventory?.id}
        onChange={(e) => handleSwitch(e.target.value)}
      >
        {accessibleInventories.map(inv => (
          <option key={inv.id} value={inv.id}>
            {inv.name}
          </option>
        ))}
      </select>

      {/* Create new inventory button */}
      <button onClick={handleCreateInventory} disabled={isLoading}>
        Create New Inventory
      </button>

      {/* POS access control */}
      {canAccessPOS && (
        <Link href={'/inventory/' + currentInventory.id + '/pos'}>
          Open POS
        </Link>
      )}
    </div>
  );
}
`;
}

// ============================================================================
// EXAMPLE 10: Middleware/Permission Check
// ============================================================================

/**
 * Example permission check middleware
 */
export function example10_permissionMiddleware(
  userPermissions: string[],
  inventoryId: string,
  requiredPermission: string
) {
  const canAccess = hasInventoryPermission(
    userPermissions,
    inventoryId,
    requiredPermission
  );

  if (!canAccess) {
    throw new Error(
      `Access denied. You don't have permission to ${requiredPermission} this inventory.`
    );
  }

  return true;
}

// ============================================================================
// Usage Summary
// ============================================================================

export function printUsageSummary() {
  console.log(`
+======================================================================+
|          Inventory Service Layer - Usage Summary                      |
+======================================================================+

1. Create Inventory:
   await createInventorySpace(firestore, inventoryData, options)

2. Get Inventory:
   await getInventorySpace(firestore, inventoryId)

3. Check Permissions:
   hasInventoryPermission(userPermissions, inventoryId, permission)

4. Get User's Inventories:
   await getUserAccessibleInventorySpaces(firestore, permissions)

5. Clone Inventory:
   await cloneInventorySpace(firestore, sourceId, newName, options)

6. Validate Collections:
   await validateInventoryCollections(firestore, inventory)

7. Migrate Inventories:
   await migrateInventorySpacesForAlerts(firestore)

8. Delete Inventory:
   await deleteInventorySpace(firestore, inventoryId)

+======================================================================+
|                     Key Features                                      |
+======================================================================+

- Branch-Style Isolation - Unique collections per inventory
- Permission Scoping - Inventory-specific access control
- Type Safety - Full TypeScript support
- Error Handling - Standardized result objects
- Migration Support - Safe upgrade path
- UI Integration - Works with InventoryContext

+======================================================================+
|                  Collection Structure                                 |
+======================================================================+

inv_stock_<name>_<timestamp>           - Stock items
inv_sales_<name>_<timestamp>           - Sales history
inv_held_<name>_<timestamp>            - Held sales
inv_pos_customers_<name>_<timestamp>    - POS customers
inv_recent_tx_<name>_<timestamp>       - Recent transactions
inv_alerts_<name>_<timestamp>          - Stock alerts

Each inventory has completely isolated collections!
`);
}
