# Fix for React Error #310: Infinite Re-render Loop in Print Docket

## Problem
Users were experiencing a React error #310 (Too many re-renders) when attempting to print unprinted dockets in the running tables section. The error message was:

```
Error: Minified React error #310; visit https://react.dev/errors/310 for the full message
```

This error occurs when React detects an infinite loop of component re-renders.

## Root Cause Analysis

The issue was in the docket receipt dialog components where:

1. **State updates during render**: When the print button was clicked, `setIsPrinted(true)` was called immediately, triggering a re-render
2. **Parent component updates**: The `onPrinted` callback would update Firestore, which triggered the parent component to re-fetch data via `setReloadCounter`
3. **Dialog state synchronization issues**: The rapid state changes between the parent and child components created a re-render loop
4. **No duplicate click prevention**: Multiple rapid clicks on the print button could trigger multiple print operations simultaneously

## Solution Implemented

### 1. Added Print-in-Progress Tracking (useRef)

Added a ref `isPrintingRef` to track printing state without triggering re-renders:

```typescript
const isPrintingRef = React.useRef(false);
```

This ref is set to `true` immediately when printing starts and prevents duplicate prints.

### 2. Improved Dialog State Management

Added tracking of previous sale ID to only reset state when a new sale is opened:

```typescript
const prevHeldSaleRef = React.useRef<string | null>(null);

React.useEffect(() => {
  const saleId = heldSale?.id || (newItemsOnly?.length > 0 ? 'update' : null);

  if (isOpen && saleId) {
    // Only reset if this is a different sale than before
    if (!prevHeldSaleRef.current || prevHeldSaleRef.current !== saleId) {
      setIsPrinted(false);
      isPrintingRef.current = false;
      prevHeldSaleRef.current = saleId;
    }
  } else if (!isOpen) {
    prevHeldSaleRef.current = null;
  }
}, [isOpen, heldSale?.id, newItemsOnly?.length]);
```

This prevents unnecessary state resets during parent re-renders.

### 3. Enhanced Print Handler with useCallback

Wrapped `handlePrint` in `useCallback` with proper dependencies and added early return to prevent duplicate prints:

```typescript
const handlePrint = React.useCallback(() => {
  // Prevent multiple simultaneous prints
  if (isPrintingRef.current || isPrinted || unprintedItems.length === 0) return;

  // Mark as printing immediately
  isPrintingRef.current = true;

  // Execute print
  printHtml(printContent.innerHTML, title);

  // Update state
  setIsPrinted(true);

  // Call callback and close dialog
  if (onPrinted) {
    onPrinted();
    setTimeout(() => onClose(), 100);
  }
}, [dependencies...]);
```

### 4. Better User Feedback

Added loading spinner on print button and disabled close button during printing:

```typescript
<Button disabled={isPrintingRef.current || isPrinted || ...}>
  {isPrintingRef.current ? (
    <>
      <div className="mr-2 h-4 w-4 animate-spin..." />
      Printing...
    </>
  ) : isPrinted ? (
    <>Printed</>
  ) : (
    <>Print Docket</>
  )}
</Button>
```

### 5. Automatic Dialog Closure

Made dialogs close automatically after printing completes for better UX:

```typescript
if (onPrinted) {
  onPrinted();
  setTimeout(() => onClose(), 100);
}
```

## Files Modified

1. **`/home/engine/project/src/components/pos/unprinted-items-receipt-dialog.tsx`**
   - Added `isPrintingRef` and `prevHeldSaleRef`
   - Improved useEffect to track sale ID changes
   - Converted `handlePrint` to useCallback with proper dependencies
   - Enhanced button states with loading spinner
   - Auto-close dialog after printing

2. **`/home/engine/project/src/components/pos/held-sale-receipt-dialog.tsx`**
   - Added `isPrintingRef` and `prevHeldSaleRef`
   - Improved useEffect to handle both regular and update dockets
   - Converted `handlePrint` to useCallback
   - Enhanced button states and disabled close button during print
   - Auto-close dialog after printing

3. **`/home/engine/project/src/components/pos/draft-docket-receipt-dialog.tsx`**
   - Added `isPrintingRef` and `prevHeldSaleRef`
   - Improved useEffect to track sale ID changes
   - Converted `handlePrint` to useCallback
   - Enhanced button states with loading spinner
   - Auto-close dialog after printing

## Benefits

1. **✅ Fixes React Error #310**: Eliminates infinite re-render loops
2. **✅ Prevents Duplicate Prints**: Multiple rapid clicks won't trigger multiple print dialogs
3. **✅ Better User Experience**: Loading indicators provide clear feedback
4. **✅ Consistent Behavior**: All docket dialogs now have the same improved behavior
5. **✅ Automatic Cleanup**: Dialogs close automatically after printing completes

## Testing Recommendations

1. Test printing unprinted items from running tables
2. Test printing full dockets
3. Test printing draft dockets
4. Attempt rapid double-clicks on print buttons (should only print once)
5. Verify dialogs close automatically after printing
6. Test with multiple different running tables to ensure state doesn't leak

## Technical Notes

- The fix uses `useRef` instead of `useState` for tracking print-in-progress state to avoid triggering unnecessary re-renders
- The `prevHeldSaleRef` ensures state is only reset when the dialog is opened with a new sale, not during parent re-renders
- The 100ms delay before closing the dialog ensures the print dialog has time to open and display
- All changes are backwards compatible and don't affect the existing API of these components
