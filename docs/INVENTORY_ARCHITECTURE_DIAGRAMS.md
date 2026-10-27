# Inventory Architecture Diagrams

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    InventoryProvider (Context)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ currentInventory: InventorySpace | null                  │  │
│  │ accessibleInventories: InventorySpace[]                 │  │
│  │ hasPermission(inventoryId, permission)                  │  │
│  │ switchInventory(inventoryId)                           │  │
│  │ refreshInventories()                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  InventoryService Layer                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ createInventorySpace()                                 │  │
│  │ getInventorySpace()                                    │  │
│  │ deleteInventorySpace()                                │  │
│  │ cloneInventorySpace()                                 │  │
│  │ hasInventoryPermission()                              │  │
│  │ getUserAccessibleInventorySpaces()                    │  │
│  │ validateInventoryCollections()                        │  │
│  │ migrateInventorySpacesForAlerts()                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Roles      │  │   Users      │  │ Firestore    │
│ Collection   │  │  Collection  │  │  Operations  │
└──────────────┘  └──────────────┘  └──────┬───────┘
                                           │
                                           ▼
                              ┌──────────────────────┐
                              │ Isolated Collections │
                              │ (one per inventory)  │
                              └──────────────────────┘
```

---

## 2. Inventory Isolation Model

```
┌─────────────────────────────────────────────────────────────┐
│                    inventorySpaces Collection                 │
└─────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Inventory A  │    │  Inventory B  │    │  Inventory C  │
│   (Bar)       │    │  (Restaurant) │    │ (Gift Shop)   │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ id: abc123    │    │ id: def456    │    │ id: ghi789    │
│ stockCol:     │    │ stockCol:     │    │ stockCol:     │
│   inv_stock_  │    │   inv_stock_  │    │   inv_stock_  │
│   bar_abc123  │    │   rest_456    │    │   gift_789    │
│ salesCol:     │    │ salesCol:     │    │ salesCol:     │
│   inv_sales_  │    │   inv_sales_  │    │   inv_sales_  │
│   bar_abc123  │    │   rest_456    │    │   gift_789    │
│ ...           │    │ ...           │    │ ...           │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Isolated      │    │ Isolated      │    │ Isolated      │
│ Collections   │    │ Collections   │    │ Collections   │
│ for Bar       │    │ for Restaurant│    │ for Gift Shop │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ • stock       │    │ • stock       │    │ • stock       │
│ • sales       │    │ • sales       │    │ • sales       │
│ • held        │    │ • held        │    │ • held        │
│ • customers   │    │ • customers   │    │ • customers   │
│ • recent_tx   │    │ • recent_tx   │    │ • recent_tx   │
│ • alerts      │    │ • alerts      │    │ • alerts      │
└───────────────┘    └───────────────┘    └───────────────┘

✅ NO DATA SHARING - COMPLETE ISOLATION
```

---

## 3. Permission Flow

```
User Request
      │
      ▼
┌─────────────────────────┐
│ UI Component (e.g., POS)│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ InventoryContext       │
│ currentInventory = {...}│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Permission Check       │
│ hasInventoryPermission(│
│   user.permissions,    │
│   inventoryId,         │
│   'pos'                │
│ )                      │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌─────────┐  ┌────────────┐
│ Allowed │  │  Blocked   │
└────┬────┘  └────────────┘
     │
     ▼
┌─────────────────────────┐
│ InventoryService       │
│ getInventorySpace(id)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Firestore Query         │
│ collection(firestore,    │
│   space.stockCollection)│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Inventory-Specific     │
│ Collection Data        │
└─────────────────────────┘
```

---

## 4. Data Flow: Creating an Inventory

```
User clicks "Create Inventory"
      │
      ▼
┌─────────────────────────┐
│ Form Submission        │
│ { name, description,   │
│   icon, color }         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ createInventorySpace() │
│ (Service Layer)        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 1. Generate Unique     │
│    Collection Names    │
│    - stock:            │
│      inv_stock_        │
│      {name}_{ts}       │
│    - sales:            │
│      inv_sales_        │
│      {name}_{ts}       │
│    - held:             │
│      inv_held_         │
│      {name}_{ts}       │
│    - customers:        │
│      inv_pos_customers_│
│      {name}_{ts}       │
│    - recent_tx:        │
│      inv_recent_tx_    │
│      {name}_{ts}       │
│    - alerts:           │
│      inv_alerts_        │
│      {name}_{ts}       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Create InventorySpace│
│    Document             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Register Permissions│
│    - view:inventory:{id}│
│    - pos:inventory:{id} │
│    - alerts:inventory:{}│
│    - sales:inventory:{} │
│    - customers:inv:{id} │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. Update Admin Roles  │
│    (Add new permissions)│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. Refresh Context     │
│    (Update UI)          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Success! ✅            │
│ Inventory Ready        │
└─────────────────────────┘
```

---

## 5. Permission Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    Super Admin                           │
│            (email: test@example.com)                   │
│         └─ Access: ALL INVENTORIES                      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Global Permissions                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ manage:inventory_spaces                         │   │
│  │   ├─ Can create any inventory                   │   │
│  │   ├─ Can edit any inventory                    │   │
│  │   └─ Can delete any inventory                  │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ view:inventory_spaces                          │   │
│  │   └─ Can view all inventories                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           Inventory-Scoped Permissions                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ view:inventory:{id}                             │   │
│  │   ├─ Can view this inventory                    │   │
│  │   └─ Grants access to stock view                │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ pos:inventory:{id}                              │   │
│  │   ├─ Can access POS                             │   │
│  │   ├─ Can process sales                          │   │
│  │   └─ Can hold sales                             │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ alerts:inventory:{id}                           │   │
│  │   ├─ Can view stock alerts                      │   │
│  │   └─ Can manage stock levels                     │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ sales:inventory:{id}                            │   │
│  │   ├─ Can view sales history                     │   │
│  │   └─ Can access analytics                       │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ customers:inventory:{id}                        │   │
│  │   ├─ Can manage customers                       │   │
│  │   └─ Can view customer history                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    No Access                             │
│           (Missing permissions)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Migration Process

```
Existing Inventory
      │
      ▼
┌─────────────────────────┐
│ Check Migration Status │
│ - posCustomersCol?     │
│ - recentTransactionsCol?│
│ - stockAlertsCol?      │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌─────────┐  ┌────────────┐
│  Migrate│  │ Up to Date │
└────┬────┘  └────────────┘
     │
     ▼
┌─────────────────────────┐
│ Generate Collection     │
│ Names                   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Update Document Fields  │
│ - posCustomersCollection│
│ - recentTransactionsCol │
│ - stockAlertsCollection│
│ - migratedAt           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Register Permissions    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Success! ✅            │
│ Inventory Migrated     │
└─────────────────────────┘
```

---

## 7. Security Model - Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: UI Context                     │
│  ┌────────────────────────────────────────────────────┐   │
│  │ • InventoryContext tracks current inventory       │   │
│  │ • Dropdown switches context safely               │   │
│  │ • Components read from context, not global state │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Layer 2: Service Layer                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ • All operations go through service functions      │   │
│  │ • Permission checks enforced before access        │   │
│  │ • Centralized validation logic                   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Layer 3: Collection Isolation             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ • Each inventory has unique collections           │   │
│  │ • Collection names include inventory ID + timestamp│   │
│  │ • No shared collections between inventories       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Layer 4: Query Scoping                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │ • All queries use inventory-specific collections │   │
│  │ • No global collection queries                    │   │
│  │ • Results are inherently scoped                   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 5: Firestore Security Rules (Future)      │
│  ┌────────────────────────────────────────────────────┐   │
│  │ • Server-side permission enforcement              │   │
│  │ • Additional layer of protection                 │   │
│  │ • Defense against client-side bypasses            │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

✅ Multiple Layers = Strong Security
```

---

## 8. Component Hierarchy

```
App
 │
 └─ InventoryProvider
     │
     ├─ Layout
     │   │
     │   ├─ Sidebar
     │   │   └─ Inventory Switcher
     │   │
     │   ├─ Header
     │   │   └─ Current Inventory Display
     │   │
     │   └─ Main Content
     │       │
     │       ├─ Inventory List Page
     │       │   └─ InventoryCards
     │       │
     │       ├─ Inventory Detail Page
     │       │   ├─ Stock Management
     │       │   ├─ POS
     │       │   │   └─ InventoryPOS (useInventoryPOS hook)
     │       │   ├─ Sales History
     │       │   ├─ Customers
     │       │   └─ Stock Alerts
     │       │
     │       ├─ Create Inventory Page
     │       │   └─ InventoryForm
     │       │
     │       └─ Migration Page
     │           └─ MigrationWizard
     │
     └─ All Components
         └─ Can use: useInventory()
```

---

## 9. Error Handling Flow

```
User Action
      │
      ▼
┌─────────────────────────┐
│ Permission Check        │
│ hasInventoryPermission()│
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌─────────┐  ┌────────────┐
│ Success │  │  Blocked   │
└────┬────┘  └─────┬──────┘
     │              │
     ▼              ▼
┌─────────┐  ┌────────────────────┐
│ Service │  │ Throw Error:       │
│ Call    │  │ "Access denied.    │
│         │  │  You don't have    │
│         │  │  permission to    │
│         │  │  access this      │
│         │  │  inventory."      │
└────┬────┘  └────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Firestore Operation     │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌─────────┐  ┌────────────┐
│ Success │  │   Error     │
└────┬────┘  └─────┬──────┘
     │              │
     ▼              ▼
┌─────────┐  ┌────────────────────┐
│ Return  │  │ Return Error:      │
│ Result  │  │ {                  │
│ {       │  │   success: false,  │
│   data  │  │   error: "...",    │
│ }       │  │ }                  │
└─────────┘  └────────────────────┘
```

---

## Summary

These diagrams illustrate:

1. **High-Level Architecture** - How all components work together
2. **Inventory Isolation** - How each inventory is separate
3. **Permission Flow** - How permissions are checked
4. **Data Flow** - How inventory creation works
5. **Permission Hierarchy** - How permissions are organized
6. **Migration Process** - How existing inventories are upgraded
7. **Security Model** - Multiple layers of protection
8. **Component Hierarchy** - How React components are organized
9. **Error Handling** - How errors are managed

The architecture ensures:
- ✅ Complete data isolation
- ✅ Secure permission checks
- ✅ Clean separation of concerns
- ✅ Maintainable code structure
- ✅ Production-ready implementation
