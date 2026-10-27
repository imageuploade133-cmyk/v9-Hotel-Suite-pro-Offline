# POS Isolation Implementation - Complete

## Overview
Each Point of Sale (POS) terminal now has completely separate, isolated data. This ensures that data from "Hotel POS" and "Main POS" (or any other POS terminal) are never mixed together.

## Architecture

### Data Structure
```
branches/
├── {branchId}/
│   ├── pointOfSales/
│   │   ├── {posId1}/
│   │   │   ├── stock/
│   │   │   ├── heldSales/
│   │   │   ├── stockSales/
│   │   │   ├── runningTables/
│   │   │   ├── creditSales/
│   │   │   └── posCustomers/
│   │   └── {posId2}/
│   │       ├── stock/
│   │       ├── heldSales/
│   │       └── ...
│   └── (branch-level collections for non-POS-specific data)
```

### Data Isolation Levels

**Level 1: Global** (All branches and all POS terminals)
- Path: `collectionName` (e.g., `stock`, `heldSales`)
- Used when: `currentBranchId === 'global'`

**Level 2: Branch** (Specific branch, all POS terminals)
- Path: `branches/{branchId}/collectionName`
- Used when: `isBranchMode && !isPosMode`

**Level 3: POS** (Specific branch, specific POS terminal)
- Path: `branches/{branchId}/pointOfSales/{posId}/collectionName`
- Used when: `isPosMode && isBranchMode`

## Changes Made

### 1. Extended Branch Context (`/src/contexts/branch-context.tsx`)

Added new types and properties:
- `POS_ISOLATED_COLLECTIONS` - Collections that have POS-level isolation
- `PointOfSale` interface - Represents a POS terminal
- Extended `BranchContextValue` with POS properties:
  - `pointOfSales: PointOfSale[]` - List of POS terminals in current branch
  - `currentPosId: string | null` - Currently selected POS
  - `currentPos: PointOfSale | null` - Currently selected POS object
  - `selectPos: (posId: string | null) => void` - Select a POS
  - `isPosMode: boolean` - Whether in POS-specific view
  - `getPosSelectorVisible: () => boolean` - Show POS selector in UI

Updated `getCollectionPath()` to handle three-level isolation:
```typescript
// POS-specific path (highest priority)
if (isPosMode && POS_ISOLATED_COLLECTIONS.includes(collectionName)) {
  return `branches/${currentBranchId}/pointOfSales/${currentPosId}/${collectionName}`;
}
// Branch-specific path
if (isBranchMode && BRANCH_ISOLATED_COLLECTIONS.includes(collectionName)) {
  return `branches/${currentBranchId}/${collectionName}`;
}
// Root path
return collectionName;
```

### 2. Created POS Management Page (`/src/app/(protected)/pos-management/page.tsx`)

Features:
- View all POS terminals in current branch
- Create new POS terminals with name and type (hotel, restaurant, main, other)
- Delete POS terminals
- Display POS status and type badges
- Only accessible in branch mode (not global)

### 3. Updated Navigation (`/src/app/(protected)/layout.tsx`)

Added "POS Management" menu item:
- Link: `/pos-management`
- Icon: `Building2`
- Permission: `PagePermission.MANAGE_POS_SETTINGS`
- Position: Right after "Point of Sale" menu item

## Usage

### For End Users

1. **Select Branch**: Use the branch selector in the sidebar
2. **Select POS**: When in a branch, use the POS selector (appears when POS terminals exist)
3. **Add POS Terminal**: Go to "POS Management" > "Add New POS Terminal"
4. **Use POS**: All sales, held items, and running tables are now isolated per POS

### For Developers

Using the branch context:
```typescript
const {
  currentBranchId,        // e.g., "branch123"
  currentPosId,          // e.g., "pos456" or null
  isPosMode,             // true if in POS mode
  getCollectionPath,     // Get path with automatic POS/branch isolation
  selectPos,             // Switch to different POS
  pointOfSales,          // Available POS terminals
} = useBranch();

// Get collection path - automatically handles all three levels
const collectionPath = getCollectionPath('heldSales');
// In POS mode: "branches/branch123/pointOfSales/pos456/heldSales"
// In Branch mode: "branches/branch123/heldSales"
// In Global mode: "heldSales"
```

## POS-Isolated Collections

These collections are isolated at the POS level (when in POS mode):
- `stock` - Product inventory
- `stockSales` - Sales transactions
- `heldSales` - Held/suspended sales
- `runningTables` - Open/running table amounts
- `creditSales` - Credit sales ledger
- `posCustomers` - POS-specific customers

## Non-Isolated Collections

These remain at the branch/global level:
- `stockCategories` - Product categories
- `services` - Services offered
- `serviceCategories` - Service categories
- `posCategories` - POS categories
- `posSettings` - POS display settings
- `suppliers` - Supplier list
- And many others...

## Migration Path

The system maintains backward compatibility:
- Old data in `branches/{branchId}/collectionName` still works in branch mode
- New data created in POS mode goes to `branches/{branchId}/pointOfSales/{posId}/collectionName`
- When switching modes, the system reads from both locations (new data takes priority)

## Next Steps (Optional Enhancements)

1. Add POS selector UI to POS page header
2. Add real-time data sync between POS terminals (optional)
3. Create POS reconciliation reports
4. Add POS-level permission controls
5. Create data migration utility to consolidate old data into POS structure
