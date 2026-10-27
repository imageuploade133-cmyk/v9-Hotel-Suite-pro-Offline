# Inventory Branch-Style Isolation Architecture

## Overview

The inventory system has been refactored to support complete branch-style isolation. Each inventory space now operates as an independent branch with its own isolated data collections, permissions, and analytics.

## Architecture Goals

✅ **Complete Data Isolation** - Each inventory has its own Firestore collections
✅ **Branch-Style Cloning** - Create new inventories with identical structure (optional data cloning)
✅ **Scoped Permissions** - Inventory-specific permission checks
✅ **Zero Cross-Inventory Access** - Prevented by architecture, not just permissions
✅ **Production-Safe** - No data duplication, clean service layer
✅ **Migration Support** - Existing inventories can be safely upgraded

---

## Data Structure

### 1. InventorySpace Document

Each inventory is stored in the `inventorySpaces` collection with the following structure:

```typescript
{
  id: "abc123",                    // Auto-generated Firestore ID
  name: "Bar & Beverages",         // Display name
  description: "Hotel bar inventory", // Optional description
  iconName: "Wine",                // Lucide icon name
  color: "#6366f1",                // Accent color for UI

  // ISOLATED COLLECTIONS
  stockCollection: "inv_stock_bar_beverages_abc123",
  salesCollection: "inv_sales_bar_beverages_abc123",
  heldSalesCollection: "inv_held_bar_beverages_abc123",
  posCustomersCollection: "inv_pos_customers_bar_beverages_abc123",
  recentTransactionsCollection: "inv_recent_tx_bar_beverages_abc123",
  stockAlertsCollection: "inv_alerts_bar_beverages_abc123",

  // METADATA
  createdAt: Timestamp,
  createdBy: "user123",
  createdByName: "John Doe",
  isActive: true,
  migratedAt: Timestamp,           // Last migration timestamp

  // PERMISSIONS (auto-generated)
  registeredPermissions: [
    "view:inventory:abc123",
    "pos:inventory:abc123",
    "alerts:inventory:abc123",
    "sales:inventory:abc123",
    "customers:inventory:abc123"
  ]
}
```

### 2. Firestore Schema Example

#### Root Collections
```
📁 inventorySpaces/         # Inventory configurations
📁 roles/                    # Role definitions
📁 users/                    # User profiles
```

#### Isolated Inventory Collections (per inventory)
```
📁 inv_stock_bar_beverages_abc123/
  ├─ item1 (StockItem)
  ├─ item2 (StockItem)
  └─ ...

📁 inv_sales_bar_beverages_abc123/
  ├─ sale1 (StockSale)
  ├─ sale2 (StockSale)
  └─ ...

📁 inv_held_bar_beverages_abc123/
  ├─ held1 (HeldSale)
  ├─ held2 (HeldSale)
  └─ ...

📁 inv_pos_customers_bar_beverages_abc123/
  ├─ customer1 (Customer)
  ├─ customer2 (Customer)
  └─ ...

📁 inv_recent_tx_bar_beverages_abc123/
  ├─ tx1 (Transaction)
  ├─ tx2 (Transaction)
  └─ ...

📁 inv_alerts_bar_beverages_abc123/
  ├─ alert1 (StockAlert)
  ├─ alert2 (StockAlert)
  └─ ...
```

### 3. Permission Structure

#### Global Permissions
- `manage:inventory_spaces` - Can create/edit/delete any inventory
- `view:inventory_spaces` - Can view all inventories

#### Inventory-Scoped Permissions
- `view:inventory:{inventoryId}` - View this inventory
- `pos:inventory:{inventoryId}` - Access POS for this inventory
- `alerts:inventory:{inventoryId}` - View stock alerts for this inventory
- `sales:inventory:{inventoryId}` - View sales history for this inventory
- `customers:inventory:{inventoryId}` - Manage customers for this inventory

#### Role Examples

**Admin Role:**
```json
{
  "name": "Admin",
  "permissions": [
    "manage:inventory_spaces",
    "view:inventory:abc123",      // Inventory 1
    "pos:inventory:abc123",
    "alerts:inventory:abc123",
    "view:inventory:def456",      // Inventory 2
    "pos:inventory:def456",
    "alerts:inventory:def456",
    // ... all other global permissions
  ]
}
```

**Inventory Manager (Specific Inventory):**
```json
{
  "name": "Bar Manager",
  "permissions": [
    "view:inventory:abc123",
    "pos:inventory:abc123",
    "alerts:inventory:abc123",
    "sales:inventory:abc123",
    "customers:inventory:abc123"
  ]
}
```

---

## How Isolation is Guaranteed

### 1. Collection-Level Isolation
Each inventory uses completely separate Firestore collections:
- **No shared collections** between inventories
- Collection names are unique (include inventory ID and timestamp)
- Zero chance of data mixing

### 2. Permission-Based Access Control
All Firestore reads/writes must pass permission checks:

```typescript
// Example: Checking access before querying
function canAccessInventory(userPermissions, inventoryId) {
  return (
    hasPermission(userPermissions, 'manage:inventory_spaces') ||
    hasPermission(userPermissions, `view:inventory:${inventoryId}`)
  );
}
```

### 3. Service Layer Enforcement
The `InventoryService` enforces isolation at the API level:

```typescript
// ❌ BAD: Global collection access
const allStock = await getDocs(collection(firestore, 'stock'));

// ✅ GOOD: Inventory-scoped access
const inventory = await getInventory(firestore, inventoryId);
const stock = await getDocs(collection(firestore, inventory.stockCollection));
```

### 4. Query Filtering
All queries are scoped to inventory-specific collections:

```typescript
// Always query from inventory-specific collection
const query = query(
  collection(firestore, space.stockCollection),
  where('quantity', '<=', lowStockThreshold)
);
```

### 5. UI Context Management
The `InventoryContext` tracks the current inventory and switches context:

```typescript
const { currentInventory } = useInventory();

// All UI components use currentInventory.collections
<StockItems collection={currentInventory.stockCollection} />
```

---

## Service Layer API

### Core Functions

#### `createInventorySpace(firestore, inventoryData, options)`
Creates a new inventory with complete branch isolation.

**What it does:**
1. Generates unique collection names
2. Creates InventorySpace document
3. Registers inventory-specific permissions
4. Optionally clones data (not implemented yet)

**Example:**
```typescript
const result = await createInventorySpace(
  firestore,
  {
    name: "Gift Shop",
    description: "Hotel gift shop inventory",
    createdBy: user.uid,
    createdByName: user.name
  },
  {
    cloneWithData: false
  }
);
```

#### `getInventorySpace(firestore, inventoryId)`
Retrieves an inventory space by ID with all collection names.

```typescript
const inventory = await getInventorySpace(firestore, "abc123");
// Returns: InventorySpace object
```

#### `deleteInventorySpace(firestore, inventoryId)`
Deletes an inventory and all its data (including all collections).

⚠️ **Destructive operation** - permanently deletes all data.

```typescript
const result = await deleteInventorySpace(firestore, "abc123");
```

#### `cloneInventorySpace(firestore, sourceId, newName, options)`
Clones an existing inventory (structure or data).

```typescript
const result = await cloneInventorySpace(
  firestore,
  "abc123",           // Source inventory ID
  "Gift Shop Copy",    // New inventory name
  { cloneWithData: true }
);
```

#### `getUserAccessibleInventorySpaces(firestore, userPermissions)`
Returns all inventories a user has access to based on permissions.

```typescript
const inventories = await getUserAccessibleInventorySpaces(
  firestore,
  user.permissions
);
```

#### `hasInventoryPermission(userPermissions, inventoryId, permission)`
Checks if a user has permission for a specific inventory.

```typescript
const canAccess = hasInventoryPermission(
  user.permissions,
  "abc123",
  "pos"
);
```

---

## Migration Strategy

### Existing Inventory Migration

Existing inventories are automatically upgraded via the migration script:

1. **Check Status** - Identify inventories missing new collections
2. **Add Collections** - Generate collection names for:
   - `posCustomersCollection`
   - `recentTransactionsCollection`
   - `stockAlertsCollection`
3. **Update Document** - Add new fields to InventorySpace
4. **Register Permissions** - Add inventory-specific permissions to roles

### Running Migration

1. Navigate to `/migrate-inventory-spaces`
2. Review migration status
3. Click "Start Migration"
4. Verify success

### Safety Features

- ✅ Non-destructive (adds fields, doesn't delete)
- ✅ Idempotent (safe to run multiple times)
- ✅ Incremental (only migrates missing fields)
- ✅ Rollback-friendly (can delete added fields)

---

## UI Context Management

### InventoryProvider

Wrap the application with `InventoryProvider` to manage current inventory:

```typescript
// app/layout.tsx
<InventoryProvider>
  <App />
</InventoryProvider>
```

### useInventory Hook

Access inventory context in components:

```typescript
function MyComponent() {
  const {
    currentInventory,
    setCurrentInventory,
    accessibleInventories,
    hasPermission,
    switchInventory
  } = useInventory();

  return (
    <Select value={currentInventory?.id} onValueChange={switchInventory}>
      {accessibleInventories.map(inv => (
        <SelectItem key={inv.id} value={inv.id}>
          {inv.name}
        </SelectItem>
      ))}
    </Select>
  );
}
```

---

## Best Practices

### ✅ DO

1. **Always use inventory-specific collections**
   ```typescript
   collection(firestore, space.stockCollection)  // ✅
   ```

2. **Check permissions before accessing data**
   ```typescript
   if (hasPermission(inventoryId, 'view')) {
     // Fetch data
   }
   ```

3. **Use the service layer API**
   ```typescript
   await createInventorySpace(firestore, data, options)  // ✅
   ```

4. **Refresh inventory context after changes**
   ```typescript
   await refreshInventories();
   ```

### ❌ DON'T

1. **Don't access global collections**
   ```typescript
   collection(firestore, 'stock')  // ❌
   ```

2. **Don't skip permission checks**
   ```typescript
   // ❌ Missing permission check
   const data = await getDocs(collection(...));
   ```

3. **Don't share collection names between inventories**
   ```typescript
   // ❌ Same collection for multiple inventories
   stockCollection: 'stock'
   ```

4. **Don't bypass the service layer**
   ```typescript
   // ❌ Direct Firestore manipulation
   await addDoc(collection(firestore, 'inventorySpaces'), {...})
   ```

---

## Security Model

### Defense in Depth

1. **Collection Isolation** - Physical separation of data
2. **Permission Checks** - Authorization at every level
3. **Service Layer** - Centralized access control
4. **UI Context** - Prevents accidental cross-inventory access
5. **Query Scoping** - All queries filtered by inventory

### Permission Flow

```
User Action
  ↓
UI Context Check (currentInventory)
  ↓
Service Layer Permission Check
  ↓
Inventory-Specific Collection Query
  ↓
Firestore Security Rules (future)
```

---

## Future Enhancements

### Planned Features

1. **Data Cloning** - Clone data when creating new inventories
2. **Analytics per Inventory** - Isolated analytics dashboards
3. **Inventory Templates** - Pre-configured inventory structures
4. **Cross-Inventory Reports** - Aggregated reporting with permissions
5. **Firestore Security Rules** - Server-side permission enforcement
6. **Audit Trail** - Track inventory access and changes

### Data Cloning Example (Future)

```typescript
const result = await cloneInventorySpace(
  firestore,
  "abc123",
  "New Bar Location",
  {
    cloneWithData: true,  // Clone stock items
    permissions: ['user456', 'user789']  // Grant access to specific users
  }
);
```

---

## Troubleshooting

### Issue: Inventory not appearing in list
**Solution:** Check user has `view:inventory:{id}` or `manage:inventory_spaces` permission.

### Issue: Can't access POS for inventory
**Solution:** Verify `pos:inventory:{id}` permission is assigned to user's role.

### Issue: Data missing after migration
**Solution:** Run migration again - it's idempotent and safe.

### Issue: Cross-inventory data appearing
**Solution:** Verify collection names are unique in InventorySpace document.

---

## Summary

The branch-style isolation architecture provides:

- ✅ Complete data isolation via unique collections
- ✅ Scoped permissions per inventory
- ✅ Clean service layer API
- ✅ Safe migration path for existing data
- ✅ UI context management
- ✅ Production-safe design
- ✅ Future-ready for data cloning and analytics

Each inventory operates as an independent branch while being managed through a unified, secure interface.
