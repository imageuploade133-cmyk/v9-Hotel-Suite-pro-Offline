# Inventory Branch-Style Isolation - Quick Reference

## 🚀 Quick Start

### Creating an Inventory

```typescript
import { createInventorySpace } from '@/lib/services/inventory-service';

const result = await createInventorySpace(
  firestore,
  {
    name: 'Main Bar',
    description: 'Hotel main bar',
    createdBy: user.uid,
    createdByName: user.name
  },
  { cloneWithData: false }
);
```

### Using Inventory in UI

```typescript
import { useInventory } from '@/contexts/inventory-context';

function MyComponent() {
  const { currentInventory, switchInventory } = useInventory();

  return (
    <div>
      <h1>{currentInventory?.name}</h1>
      <button onClick={() => switchInventory(inventoryId)}>
        Switch Inventory
      </button>
    </div>
  );
}
```

### Checking Permissions

```typescript
import { hasInventoryPermission } from '@/lib/services/inventory-service';

const canAccess = hasInventoryPermission(
  user.permissions,
  inventoryId,
  'pos'
);
```

---

## 📦 Collections Created per Inventory

| Collection | Purpose | Example |
|-----------|---------|---------|
| `inv_stock_{name}_{ts}` | Stock items | `inv_stock_bar_abc123` |
| `inv_sales_{name}_{ts}` | Sales history | `inv_sales_bar_abc123` |
| `inv_held_{name}_{ts}` | Held sales | `inv_held_bar_abc123` |
| `inv_pos_customers_{name}_{ts}` | POS customers | `inv_pos_customers_bar_abc123` |
| `inv_recent_tx_{name}_{ts}` | Recent transactions | `inv_recent_tx_bar_abc123` |
| `inv_alerts_{name}_{ts}` | Stock alerts | `inv_alerts_bar_abc123` |

---

## 🔐 Permissions

### Global
- `manage:inventory_spaces` - Create/edit/delete any inventory
- `view:inventory_spaces` - View all inventories

### Inventory-Scope (per inventory)
- `view:inventory:{id}` - View inventory
- `pos:inventory:{id}` - Access POS
- `alerts:inventory:{id}` - View stock alerts
- `sales:inventory:{id}` - View sales history
- `customers:inventory:{id}` - Manage customers

---

## 🛠️ Service Layer Functions

```typescript
// Creation & Management
createInventorySpace(firestore, data, options)
getInventorySpace(firestore, id)
deleteInventorySpace(firestore, id)
cloneInventorySpace(firestore, sourceId, newName, options)

// Permissions & Access
hasInventoryPermission(permissions, id, permission)
getUserAccessibleInventorySpaces(firestore, permissions)

// Migration & Validation
migrateInventorySpacesForAlerts(firestore)
validateInventoryCollections(firestore, inventory)
```

---

## 🎣 React Hook

```typescript
const {
  currentInventory,          // Currently selected inventory
  setCurrentInventory,       // Set current inventory
  accessibleInventories,     // User's accessible inventories
  hasPermission,             // Check permission
  switchInventory,           // Switch between inventories
  refreshInventories,        // Refresh inventory list
  isLoading                  // Loading state
} = useInventory();
```

---

## 📝 Common Patterns

### Pattern 1: Permission-Gated Component

```typescript
function POSPage() {
  const { currentInventory, hasPermission } = useInventory();

  if (!currentInventory) return <div>Select an inventory</div>;
  if (!hasPermission(currentInventory.id, 'pos')) {
    return <div>Access denied</div>;
  }

  return <POSInterface inventory={currentInventory} />;
}
```

### Pattern 2: Inventory Switcher

```typescript
function InventorySwitcher() {
  const { currentInventory, accessibleInventories, switchInventory } = useInventory();

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

### Pattern 3: Safe Firestore Query

```typescript
function useStockItems(inventory: InventorySpace) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!inventory) return;

    const q = query(
      collection(firestore, inventory.stockCollection),
      orderBy('name')
    );

    onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => doc.data()));
    });
  }, [inventory]);

  return items;
}
```

---

## 🔄 Migration

### Running Migration

1. Navigate to `/migrate-inventory-spaces`
2. Review status
3. Click "Start Migration"
4. Verify success

### What It Does

- Adds `posCustomersCollection` (if missing)
- Adds `recentTransactionsCollection` (if missing)
- Adds `stockAlertsCollection` (if missing)
- Sets `migratedAt` timestamp
- Registers inventory-specific permissions

---

## 🚨 Troubleshooting

### Issue: "Inventory not found"

**Solution:** Check user has `view:inventory:{id}` or `manage:inventory_spaces` permission.

### Issue: "Collections not configured"

**Solution:** Run migration script at `/migrate-inventory-spaces`.

### Issue: "Access denied"

**Solution:** Verify user has required permission:
```typescript
hasInventoryPermission(user.permissions, inventoryId, 'pos')
```

### Issue: Context not updating

**Solution:** Refresh inventory context:
```typescript
const { refreshInventories } = useInventory();
await refreshInventories();
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `docs/INVENTORY_BRANCH_ARCHITECTURE.md` | Complete architecture guide |
| `docs/INVENTORY_ARCHITECTURE_DIAGRAMS.md` | Visual diagrams |
| `src/lib/services/README.md` | Service layer API reference |
| `src/lib/services/examples.ts` | Code examples |
| `docs/INVENTORY_IMPLEMENTATION_SUMMARY.md` | Implementation details |
| `INVENTORY_ISOLATION_CHANGELOG.md` | Changelog |

---

## ✅ Checklist

### Before Creating Inventory
- [ ] User has `manage:inventory_spaces` permission
- [ ] Firestore is initialized
- [ ] User profile is loaded

### After Creating Inventory
- [ ] All 6 collections created
- [ ] Permissions registered
- [ ] Context refreshed
- [ ] Inventory appears in list

### Before Using Inventory
- [ ] Current inventory selected
- [ ] Permission checked
- [ ] Collections validated
- [ ] UI context updated

---

## 🎯 Key Concepts

1. **Isolation** - Each inventory has unique collections
2. **Permissions** - Inventory-scoped access control
3. **Service Layer** - Centralized API
4. **Context** - UI state management
5. **Migration** - Safe upgrade path

---

## 📞 Support

For detailed information, see:
- Architecture: `docs/INVENTORY_BRANCH_ARCHITECTURE.md`
- API: `src/lib/services/README.md`
- Examples: `src/lib/services/examples.ts`
- Diagrams: `docs/INVENTORY_ARCHITECTURE_DIAGRAMS.md`
