# Receipt Settings Fix - Branch POS Settings Integration

## Problem
The "Reprint Receipt" feature on the "My Sales History" page was not using the Branch POS Receipt Settings. Instead, it was always using the global/organization-level settings, ignoring branch-specific receipt configurations.

## Solution
Updated the `StockSaleReceiptDialog` component to merge and prioritize branch-specific POS receipt settings over global settings.

## Files Modified

### 1. `src/components/stock/stock-sale-receipt-dialog.tsx`

#### Changes Made:

**A. Updated Receipt Settings Logic (Lines 186-206)**
- Added access to branch POS settings: `const branchPosSettings = currentBranch?.posSettings || {};`
- Modified all receipt display settings to check branch settings first, then fall back to global settings:
  - `posLogoUrl`: Now checks `branchPosSettings.posReceiptLogoUrl` first
  - `posLogoSize`: Prioritizes `branchPosSettings.posReceiptLogoSize`
  - `posShowBusinessName`: Uses `branchPosSettings.posShowBusinessName`
  - `posShowAddress`: Uses `branchPosSettings.posShowAddress`
  - `posShowPhone`: Uses `branchPosSettings.posShowPhone`
  - `posShowCashier`: Uses `branchPosSettings.posShowCashierName`
  - `posShowDate`: Uses `branchPosSettings.posShowDate`
  - `posHeader`: Uses `branchPosSettings.posReceiptHeader`
  - `posFooter`: Uses `branchPosSettings.posReceiptFooter`

**B. Updated PaymentDetailsCreditSale Component (Lines 42-92)**
- Added `currentBranch` parameter to component props
- Modified payment details retrieval to prioritize branch settings:
  - `bankName`: `currentBranch?.posSettings?.bankName` → fallback to global
  - `accountName`: `currentBranch?.posSettings?.accountName` → fallback to global
  - `accountNumber`: `currentBranch?.posSettings?.accountNumber` → fallback to global
  - `bankLogoUrl`: `currentBranch?.posSettings?.bankLogoUrl` → fallback to global

**C. Updated Component Calls (Lines 343, 436)**
- Updated both calls to `PaymentDetailsCreditSale` to pass `currentBranch` prop
- Ensures payment details use branch-specific settings when available

## How It Works

1. **Branch Settings Priority**: When reprinting receipts, the component now checks if branch-specific POS settings exist
2. **Fallback to Global**: If branch settings are not configured, it falls back to global organization settings
3. **Complete Coverage**: All receipt display settings (headers, footers, logos, payment details) now respect branch configuration

## Result

- ✅ "My Sales History" page reprint receipt now uses Branch POS Receipt Settings
- ✅ Multiple branches can have different receipt formats
- ✅ Each branch maintains its own branding and payment information on receipts
- ✅ Global settings still work as fallback for unconfigured branches

## Testing

To verify the fix:

1. Navigate to **My Sales History** page
2. Click **Reprint Receipt** on any historical sale
3. Verify that the receipt displays with:
   - Branch-specific logo (if configured)
   - Branch-specific payment details (if configured)
   - Branch-specific header/footer text (if configured)
4. Compare with receipts from other branches to see different settings
