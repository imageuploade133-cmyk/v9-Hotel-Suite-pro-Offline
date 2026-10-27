
// =================================================================
//  Hotel Suite Pro - Google Apps Script Booking Engine
// =================================================================
//  Instructions:
//  1. Create a new Google Apps Script project at script.google.com.
//  2. Replace the content of Code.gs with this entire script.
//  3. In the script editor, go to "Services" > "+" > "Firestore".
//  4. In the script editor, go to "Project Settings" > "Script Properties".
//  5. Add three script properties:
//     - FIREBASE_PROJECT_ID:  Your Firebase project ID.
//     - FIREBASE_CLIENT_EMAIL: The client email from your Firebase service account JSON key.
//     - FIREBASE_PRIVATE_KEY: The private key from your Firebase service account JSON key (copy the entire key, including "-----BEGIN PRIVATE KEY-----...").
//  6. Deploy the script as a Web App with "Execute as: Me" and "Who has access: Anyone".
//  7. Copy the generated Web App URL and paste it into the "Google Apps Script URL" field in your application's settings.
// =================================================================

/**
 * @OnlyCurrentDoc
 */

// Global variables for Firebase connection
var firestore = null;
var SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
var PROJECT_ID = SCRIPT_PROPERTIES.getProperty('FIREBASE_PROJECT_ID');
var CLIENT_EMAIL = SCRIPT_PROPERTIES.getProperty('FIREBASE_CLIENT_EMAIL');
var PRIVATE_KEY = SCRIPT_PROPERTIES.getProperty('FIREBASE_PRIVATE_KEY');

// Main entry point for GET requests (checking availability)
function doGet(e) {
  var action = e.parameter.action;

  if (action === 'getAvailability') {
    var checkIn = e.parameter.checkIn;
    var checkOut = e.parameter.checkOut;

    if (!checkIn || !checkOut) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Missing checkIn or checkOut date." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    try {
      var availableRooms = getAvailableRooms(checkIn, checkOut);
      return ContentService
        .createTextOutput(JSON.stringify(availableRooms))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ error: "Invalid action." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Main entry point for POST requests (creating reservations)
function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);

    if (request.action === 'createReservation') {
      var payload = request.payload;
      var bookingId = createReservation(payload);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, bookingId: bookingId, message: "Reservation created successfully." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ error: "Invalid action." }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
     return ContentService
      .createTextOutput(JSON.stringify({ error: "Failed to process request: " + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Creates a new reservation in Firestore.
 * @param {object} payload The booking details from the client.
 * @return {string} The ID of the new booking document.
 */
function createReservation(payload) {
  if (!payload || !payload.checkIn || !payload.checkOut || !payload.roomId || !payload.roomNumber || !payload.guestName) {
    throw new Error("Missing required reservation data in payload.");
  }

  var firestore = getFirestoreService();
  var checkInDate = new Date(payload.checkIn);
  var checkOutDate = new Date(payload.checkOut);

  // --- Check for conflicts again on the server-side for safety ---
  var bookings = firestore.getDocuments('bookings').documents.map(function(doc) {
    return doc.fields;
  });

  var isConflict = bookings.some(function(booking) {
    if (booking.roomNumber.stringValue !== payload.roomNumber) return false;
    if (booking.status && (booking.status.stringValue === 'Cancelled' || booking.status.stringValue === 'Refunded')) return false;

    var existingStart = new Date(booking.checkInDate.timestampValue);
    var existingEnd = new Date(booking.checkOutDate.timestampValue);

    return (checkInDate < existingEnd && checkOutDate > existingStart);
  });

  if (isConflict) {
    throw new Error("This room is no longer available for the selected dates. Please try another room or date.");
  }
  // --- End conflict check ---

  var bookingId = "BK-" + Math.random().toString(36).substr(2, 5).toUpperCase();
  var totalAmount = 0; // The client handles pricing, but we could re-calculate here if needed.

  var newBooking = {
    fields: {
      bookingId: { stringValue: bookingId },
      guestName: { stringValue: payload.guestName },
      guestEmail: { stringValue: payload.guestEmail || '' },
      guestPhoneNumber: { stringValue: payload.guestPhoneNumber || '' },
      numberOfGuests: { integerValue: payload.numberOfGuests || 1 },
      checkInDate: { timestampValue: checkInDate.toISOString() },
      checkOutDate: { timestampValue: checkOutDate.toISOString() },
      roomId: { stringValue: payload.roomId },
      roomNumber: { stringValue: payload.roomNumber },
      status: { stringValue: 'Booked' }, // New reservations are "Booked"
      totalAmount: { doubleValue: totalAmount },
      createdAt: { timestampValue: new Date().toISOString() },
      // Set createdBy fields to 'System' or a generic name for website bookings
      createdByName: { stringValue: "Website Booking" },
      createdByUid: { stringValue: "system-website" }
    }
  };

  var createdDocument = firestore.createDocument('bookings', newBooking);
  return bookingId;
}

/**
 * Checks for available rooms for the given date range.
 * @param {string} checkIn The check-in date in YYYY-MM-DD format.
 * @param {string} checkOut The check-out date in YYYY-MM-DD format.
 * @return {Array<object>} A list of available room types.
 */
function getAvailableRooms(checkIn, checkOut) {
  var firestore = getFirestoreService();
  var checkInDate = new Date(checkIn);
  var checkOutDate = new Date(checkOut);

  // Fetch all rooms and active/reserved bookings
  var rooms = firestore.getDocuments('rooms').documents.map(function(doc) {
    return { id: doc.name.split('/').pop(), ...doc.fields };
  });

  var bookings = firestore.getDocuments('bookings').documents.map(function(doc) {
    var bookingData = doc.fields;
    var status = bookingData.status ? bookingData.status.stringValue : '';
    // Filter out cancelled, checked-out, or refunded bookings
    if (status === 'Cancelled' || status === 'Checked-out' || status === 'Refunded') {
      return null;
    }
    return bookingData;
  }).filter(Boolean); // Remove null entries

  var availableRoomTypes = [];

  rooms.forEach(function(roomType) {
    var totalRoomCount = roomType.totalRooms ? parseInt(roomType.totalRooms.integerValue) : 0;
    if (totalRoomCount === 0) return;

    var roomNumbersForType = roomType.roomNumbers && roomType.roomNumbers.arrayValue.values ?
      roomType.roomNumbers.arrayValue.values.map(function(v) { return v.stringValue; }) : [];

    var bookedRoomNumbersInDateRange = new Set();

    bookings.forEach(function(booking) {
      if (booking.roomId && booking.roomId.stringValue === roomType.id) {
        var existingStart = new Date(booking.checkInDate.timestampValue);
        var existingEnd = new Date(booking.checkOutDate.timestampValue);

        // Check for overlap
        if (checkInDate < existingEnd && checkOutDate > existingStart) {
          bookedRoomNumbersInDateRange.add(booking.roomNumber.stringValue);
        }
      }
    });

    var availableRoomNumbersForType = roomNumbersForType.filter(function(num) {
      return !bookedRoomNumbersInDateRange.has(num);
    });

    if (availableRoomNumbersForType.length > 0) {
      availableRoomTypes.push({
        id: roomType.id,
        name: roomType.name ? roomType.name.stringValue : 'Unnamed Room',
        description: roomType.description ? roomType.description.stringValue : '',
        price: roomType.price ? roomType.price.doubleValue || roomType.price.integerValue : 0,
        images: roomType.images && roomType.images.arrayValue.values ? roomType.images.arrayValue.values.map(function(v) { return v.stringValue; }) : [],
        capacity: roomType.capacity ? parseInt(roomType.capacity.integerValue) : 2,
        facilities: roomType.facilities && roomType.facilities.arrayValue.values ? roomType.facilities.arrayValue.values.map(function(v) { return v.stringValue; }) : [],
        availableRooms: availableRoomNumbersForType.length,
        availableRoomNumbers: availableRoomNumbersForType
      });
    }
  });

  return availableRoomTypes;
}

/**
 * Initializes and returns an authenticated Firestore service object.
 * @return {object} An authenticated Firestore service instance.
 */
function getFirestoreService() {
  if (!firestore) {
    if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      throw new Error("Firebase credentials are not set in Script Properties.");
    }
    firestore = FirestoreApp.getFirestore(CLIENT_EMAIL, PRIVATE_KEY.replace(/\\n/g, '\n'), PROJECT_ID);
  }
  return firestore;
}
