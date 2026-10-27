# Secure Print System - Test Plan

## Manual Testing Checklist

### Prerequisites
1. Open the POS page in a browser
2. Have a test sale ready to complete
3. Have a test running table (held sale) with items

### Test 1: Single Tab - Stock Sale Receipt (Final Receipt)
**Objective**: Verify normal printing flow for final receipts

**Steps**:
1. Complete a sale in POS
2. Click "Print" on the receipt dialog
3. Verify button shows "Printing..." with spinning icon
4. Verify print dialog opens
5. Close the receipt dialog
6. Reopen the same receipt
7. Verify button shows "Already Printed" (grey, disabled)
8. Verify button cannot be clicked

**Expected Result**: Receipt can only be printed once, permanently marked as printed

---

### Test 2: Multiple Tabs - Stock Sale Receipt
**Objective**: Verify cross-tab synchronization for final receipts

**Steps**:
1. Complete a sale in POS
2. Open the receipt dialog in Tab A
3. Duplicate Tab A (Ctrl/Cmd + Click on tab, or right-click → Duplicate)
4. In Tab B, wait for receipt to load
5. In Tab A, click "Print"
6. Immediately switch to Tab B
7. Verify button in Tab B shows "Already Printed" within 1-2 seconds

**Expected Result**: Both tabs show "Already Printed" after one print

---

### Test 3: Tab Duplication - Stock Sale Receipt
**Objective**: Verify new tabs detect already-printed receipts

**Steps**:
1. Complete a sale in POS
2. Open receipt dialog and print it
3. Close receipt dialog
4. Reopen receipt dialog (or open in new tab via URL)
5. Verify button shows "Already Printed" immediately

**Expected Result**: New/duplicated tabs show "Already Printed" immediately

---

### Test 4: Running Table - Full Docket
**Objective**: Verify running table docket printing

**Steps**:
1. Create a running table with items
2. Open the receipt dialog (full docket, not update)
3. Click "Print"
4. Verify button shows "Already Printed"
5. Wait 6 seconds
6. Refresh the page
7. Reopen the same running table receipt dialog
8. Verify button can be clicked again

**Expected Result**: Docket can be reprinted after 5 seconds

---

### Test 5: Running Table - Update Docket
**Objective**: Verify update dockets (new items) work correctly

**Steps**:
1. Create a running table with items
2. Add new items to the running table
3. Open the update docket (shows only new items)
4. Click "Print"
5. Verify print is successful
6. Verify button shows "Printed" but can be printed again

**Expected Result**: Update dockets can be printed multiple times (no permanent block)

---

### Test 6: Running Table - Immediate Reprint (Within 5 Seconds)
**Objective**: Verify warning for immediate reprints

**Steps**:
1. Create a running table with items
2. Print the full docket
3. Immediately try to print again (within 5 seconds)
4. Verify warning toast: "Recent Print Detected. Are you sure you want to print again?"
5. Verify print proceeds (optional, based on confirmation)

**Expected Result**: Warning shown but reprint allowed

---

### Test 7: Multiple Tabs - Running Table Docket
**Objective**: Verify cross-tab synchronization for running table dockets

**Steps**:
1. Create a running table with items
2. Open receipt dialog in Tab A
3. Duplicate Tab A
4. In Tab A, click "Print"
5. Switch to Tab B
6. Verify button in Tab B shows "Already Printed" within 1-2 seconds
7. Wait 6 seconds
8. Verify both tabs return to normal state

**Expected Result**: Both tabs sync immediately, reset after 5 seconds

---

### Test 8: Single Item Receipt
**Objective**: Verify single item docket printing

**Steps**:
1. Create a running table with multiple items
2. Open single item docket for one item
3. Click "Print"
4. Verify print successful
5. Wait 6 seconds
6. Try to print again
7. Verify can print again

**Expected Result**: Single item dockets follow same reprint-after-5s rules

---

### Test 9: Fast Double-Click
**Objective**: Verify system handles rapid clicks

**Steps**:
1. Open any receipt dialog
2. Double-click the "Print" button rapidly
3. Verify only one print dialog opens
4. Verify button shows "Already Printed"

**Expected Result**: Only one print succeeds, button locked during processing

---

### Test 10: Slow Network Simulation
**Objective**: Verify system handles network delays

**Steps**:
1. Use browser DevTools to throttle network (Slow 3G)
2. Complete a sale and print receipt
3. Verify button shows "Printing..." for longer time
4. Verify transaction completes eventually
5. Verify print succeeds

**Expected Result**: System handles slow network gracefully

---

### Test 11: Toast Notifications
**Objective**: Verify appropriate toast messages

**Scenarios**:
1. **Success Print**: Verify "Docket printed successfully." toast (green)
2. **Already Printed**: Verify "This docket has already been printed." toast (red)
3. **Recent Print**: Verify "Recent Print Detected." toast (yellow)
4. **Network Error**: Disconnect network, try to print, verify error toast

**Expected Result**: All toast variants display correctly with appropriate colors

---

### Test 12: Print Button States
**Objective**: Verify all button state transitions

**State Matrix**:
| Initial | Processing | Already Printed |
|---------|------------|-----------------|
| Print icon, black text | Spinning icon, "Printing..." | CheckCircle2 icon, grey text |
| Button clickable | Button disabled | Button disabled |

**Expected Result**: All states visually distinct and correct

---

## Automated Tests (Future)

### Unit Tests
- `markAsPrinted()` transaction logic
- `usePrintStatusMonitor()` real-time updates
- `usePrintTabSync()` cross-tab communication
- `useSecurePrint()` complete workflow

### Integration Tests
- Multi-tab scenarios
- Network failure handling
- Concurrent print attempts

## Browser Compatibility

### Test in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

### Verify:
- BroadcastChannel API works
- localStorage fallback works
- Print dialogs open correctly

## Edge Cases to Consider

1. **Tab Crashes**: Verify other tabs still work
2. **Browser Refresh**: Verify print status persists
3. **Multiple Sales**: Verify no cross-sale interference
4. **Different Users**: Verify each user's prints tracked separately
5. **Firestore Outage**: Verify graceful degradation

## Success Criteria

- ✅ No duplicate prints possible in any scenario
- ✅ Cross-tab synchronization works within 2 seconds
- ✅ UI states update correctly
- ✅ Toast messages are clear and helpful
- ✅ Running tables can reprint after delay
- ✅ Final receipts permanently blocked
- ✅ No console errors in production
