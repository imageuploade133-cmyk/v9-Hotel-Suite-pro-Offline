# Testing Checklist for Guest Report Issues Page Fixes

## Pre-Testing Setup
1. Ensure imgbb API key is configured in Settings > Image Upload Settings
   - Or verify default key is available as fallback
2. Set up a test room with an active booking
3. Generate QR code for the test room: `/guest-report?room=XXX`
4. Have a mobile device or enable mobile emulation in browser
5. Ensure camera permissions are allowed in the browser

## Camera Functionality Tests

### Test 1: Camera Dialog Opening
- [ ] Open camera dialog by clicking "Take Photo" button
- [ ] Verify camera does NOT auto-start
- [ ] Verify "Start Camera" button is displayed with camera icon
- [ ] Verify clear messaging: "Camera ready to start"

### Test 2: Starting Camera
- [ ] Click "Start Camera" button
- [ ] Verify loading indicator appears
- [ ] Verify camera permission prompt appears (first time)
- [ ] Verify video feed starts after permission granted
- [ ] Verify "Capture Photo" button is enabled when feed is active

### Test 3: Capturing Photo
- [ ] Click "Capture Photo" button
- [ ] Verify photo is captured and displayed
- [ ] Verify video feed stops
- [ ] Verify "Retake" and "Use Photo" buttons appear

### Test 4: Retaking Photo
- [ ] After capturing, click "Retake" button
- [ ] Verify camera restarts
- [ ] Verify can capture another photo

### Test 5: Confirming Photo
- [ ] Capture a photo
- [ ] Click "Use Photo" button
- [ ] Verify dialog closes
- [ ] Verify photo appears in "Selected Images" section
- [ ] Verify image count badge updates (e.g., "1/5")

### Test 6: Camera Errors
- [ ] Deny camera permission
- [ ] Verify appropriate error message appears
- [ ] Verify error is not destructive to the form
- [ ] Verify can still upload from gallery

## Image Upload Tests

### Test 7: Gallery Upload
- [ ] Click "Upload Images" button
- [ ] Select 1 image from gallery
- [ ] Verify image appears in preview
- [ ] Verify can remove image
- [ ] Verify image count badge updates

### Test 8: Multiple Images
- [ ] Upload or capture 3 different images
- [ ] Verify all 3 appear in preview
- [ ] Verify badge shows "3/5"
- [ ] Verify can remove individual images
- [ ] Try to add 3 more images (total 6)
- [ ] Verify prevented with message "Maximum 5 images allowed"

### Test 9: Image Size Validation
- [ ] Try to upload image larger than 5MB
- [ ] Verify error message appears
- [ ] Verify image is not added to selection

### Test 10: Image Format Validation
- [ ] Try to upload non-image file (PDF, TXT, etc.)
- [ ] Verify error message appears
- [ ] Verify file is not added to selection

## Image Upload to imgbb Tests

### Test 11: Successful Upload
- [ ] Add 2-3 images
- [ ] Fill in report message
- [ ] Click "Submit Report"
- [ ] Verify upload progress appears: "Uploading 0 of 3 images..."
- [ ] Verify progress updates: "Uploading 1 of 3 images..."
- [ ] Verify progress continues through all images
- [ ] Verify success screen appears with images displayed
- [ ] Verify image count shown on success screen

### Test 12: Upload Progress Display
- [ ] During upload, verify:
  - [ ] Loading spinner on submit button
  - [ ] Progress text shows current/total
  - [ ] Button shows "Uploading Images (2/5)..."
  - [ ] Button is disabled during upload
  - [ ] Upload progress alert is visible

### Test 13: Network Error Handling
- [ ] Add images
- [ ] Disconnect network
- [ ] Try to submit report
- [ ] Verify graceful error handling
- [ ] Verify toast notification about upload failure
- [ ] Verify report still submits without images
- [ ] Verify success screen appears

### Test 14: Invalid API Key
- [ ] Clear imgbb API key in settings (if possible)
- [ ] Add images and submit
- [ ] Verify falls back to default API key
- [ ] Verify upload completes successfully

### Test 15: Partial Upload Failure
- [ ] (May require network throttling or mock)
- [ ] Verify if some images fail, successful ones are still saved
- [ ] Verify failed count is displayed in progress

## Integration Tests

### Test 16: Full Report Submission
- [ ] Fill in all fields (message, phone)
- [ ] Add 3 images (mix of camera and gallery)
- [ ] Submit report
- [ ] Verify all data saved to Firestore:
  - [ ] roomNumber
  - [ ] reportMessage
  - [ ] guestName
  - [ ] phoneNumber
  - [ ] images array (3 imgbb URLs)
  - [ ] imageCount: 3
  - [ ] reportedAt timestamp
  - [ ] status: 'new'

### Test 17: WhatsApp Notification
- [ ] Submit report with images
- [ ] Verify WhatsApp notification sent to configured number
- [ ] Verify notification includes:
  - [ ] Room number
  - [ ] Guest name
  - [ ] Phone number
  - [ ] Report message
  - [ ] Image count
  - [ ] Image URLs

### Test 18: Success Screen Display
- [ ] After successful submission with images:
  - [ ] Verify success screen shows
  - [ ] Verify room number displayed
  - [ ] Verify timestamp displayed
  - [ ] Verify image count badge
  - [ ] Verify first 3 images displayed as thumbnails
  - [ ] If more than 3, verify "+N" badge

### Test 19: Report Without Images
- [ ] Submit report without any images
- [ ] Verify submission succeeds
- [ ] Verify success screen doesn't show image section
- [ ] Verify Firestore record has empty images array

### Test 20: Guest Information Auto-Population
- [ ] Access page with valid room number
- [ ] Verify guest name populated from booking
- [ ] Verify phone number populated from booking
- [ ] Verify fields are read-only/disabled

## Edge Cases

### Test 21: No Active Booking
- [ ] Access page with room number that has no active booking
- [ ] Verify page still loads
- [ ] Verify guest name shows "Checked-in Guest"
- [ ] Verify phone field is empty but editable

### Test 22: Missing Room Number
- [ ] Access page without room parameter
- [ ] Verify error screen appears
- [ ] Verify appropriate message displayed

### Test 23: Concurrent Uploads
- [ ] Add 5 images
- [ ] Submit report
- [ ] While uploading, verify:
  - [ ] Cannot submit another report
  - [ ] Cannot add more images
  - [ ] Form is properly disabled

### Test 24: Browser Compatibility
- [ ] Test on Chrome/Edge
- [ ] Test on Firefox
- [ ] Test on Safari (especially camera on iOS)
- [ ] Test on mobile browsers
- [ ] Verify camera APIs work on all platforms

### Test 25: Settings Integration
- [ ] Change imgbb API key in settings
- [ ] Submit report with images
- [ ] Verify new API key is used
- [ ] Change expiration settings
- [ ] Verify expiration is applied to uploaded images

## Performance Tests

### Test 26: Large Images
- [ ] Upload 5 large images (close to 5MB each)
- [ ] Verify upload doesn't timeout
- [ ] Verify browser doesn't hang
- [ ] Verify sequential upload works

### Test 27: Memory Leaks
- [ ] Add and remove images multiple times
- [ ] Open and close camera dialog multiple times
- [ ] Verify no memory leaks (check browser dev tools)
- [ ] Verify preview URLs are cleaned up

## Regression Tests

### Test 28: Other ImageUpload Usages
Since we fixed the base `ImageUpload` component:
- [ ] Test bookings create page (if uses image upload)
- [ ] Test menu item forms (if uses image upload)
- [ ] Test room forms (if uses image upload)
- [ ] Verify camera "Start Camera" button works everywhere
- [ ] Verify no auto-clicking issues elsewhere

## Expected Behaviors

### ✅ Success Criteria
- Camera requires explicit user action to start
- Images upload to imgbb (not Firebase Storage)
- Upload progress accurately reflects current state
- Failed uploads don't block report submission
- All uploaded images are included in Firestore and WhatsApp
- Success screen displays uploaded images
- No console errors during normal operation
- Responsive and works on mobile devices

### ❌ Failure Indicators
- Camera starts automatically
- Upload stays at "Uploading 0 of X"
- Images upload to Firebase Storage
- Upload errors crash the page
- Failed uploads prevent report submission
- imgbb API key not used from settings
- Memory leaks or performance issues

## Post-Testing
- [ ] Review Firestore `guestReports` collection for correct data
- [ ] Check WhatsApp messages received
- [ ] Verify imgbb dashboard shows uploaded images (if accessible)
- [ ] Check browser console for any warnings or errors
- [ ] Test cleanup: remove test reports if needed
