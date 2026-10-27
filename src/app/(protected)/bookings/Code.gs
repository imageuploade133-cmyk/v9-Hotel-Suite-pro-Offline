/**
 * @fileoverview
 * This Google Apps Script acts as a simple, serverless backend for a hotel booking website.
 * It provides two main functionalities accessible via a deployed Web App URL:
 *
 * 1.  GET Request with `action=getAvailability`:
 *     - Checks for available room types between a `checkIn` and `checkOut` date.
 *     - Queries the 'bookings' collection in Firestore to find conflicting reservations.
 *     - Returns a JSON array of available room types, including their details and the number of available rooms.
 *
 * 2.  POST Request with `action=createReservation`:
 *     - Creates a new, unpaid reservation in the 'bookings' collection.
 *     - Expects a JSON payload with booking details (room, dates, guest info).
 *     - Returns a JSON object indicating success or failure.
 *
 * This script is designed to be used with a static website, enabling dynamic booking functionality without a traditional server.
 *
 * @license Apache-2.0
 */

// --- Main Handler ---
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getAvailability') {
      const checkInStr = e.parameter.checkIn;
      const checkOutStr = e.parameter.checkOut;

      if (!checkInStr || !checkOutStr) {
        return createJsonResponse({ error: 'Missing checkIn or checkOut date parameters.' }, 400);
      }

      // Add time to dates to prevent off-by-one errors with startOfDay
      const checkInDate = new Date(checkInStr + 'T00:00:00');
      const checkOutDate = new Date(checkOutStr + 'T00:00:00');

      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        return createJsonResponse({ error: 'Invalid date format. Please use YYYY-MM-DD.' }, 400);
      }

      const availableRooms = checkAvailability(checkInDate, checkOutDate);
      return createJsonResponse(availableRooms);
    }

    return createJsonResponse({ error: 'Invalid action specified.' }, 400);

  } catch (error) {
    return createJsonResponse({ error: 'An unexpected server error occurred: ' + error.message }, 500);
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (action === 'createReservation') {
      const payload = requestData.payload;
      const result = createReservation(payload);
      return createJsonResponse(result);
    }

    return createJsonResponse({ error: 'Invalid POST action specified.' }, 400);

  } catch (error) {
    return createJsonResponse({ error: 'An unexpected server error occurred: ' + error.message }, 500);
  }
}

// --- Firestore Logic ---
function checkAvailability(checkInDate, checkOutDate) {
  const firestore = getFirestore();
  const roomsCollection = firestore.getDocuments('rooms');
  const allRooms = roomsCollection.map(doc => ({ id: doc.getName().split('/').pop(), ...doc.getFields() }));

  const checkInTimestamp = FirestoreApp.createTimestamp(checkInDate);
  const checkOutTimestamp = FirestoreApp.createTimestamp(checkOutDate);

  // Find all bookings that conflict with the desired date range
  const conflictingBookings = firestore.query('bookings')
    .where('checkOutDate', '>', checkInTimestamp)
    .where('checkInDate', '<', checkOutTimestamp)
    .get()
    .map(doc => doc.getFields());

  const bookedRoomCounts = {};
  conflictingBookings.forEach(booking => {
    const roomId = booking.roomId.stringValue;
    bookedRoomCounts[roomId] = (bookedRoomCounts[roomId] || 0) + 1;
  });

  // Determine available rooms
  const availableRoomTypes = allRooms.map(roomType => {
    const totalRoomsOfType = roomType.totalRooms.integerValue;
    const bookedCount = bookedRoomCounts[roomType.id] || 0;
    const availableCount = totalRoomsOfType - bookedCount;

    // Get specific available room numbers
    const bookedNumbersForType = conflictingBookings
        .filter(b => b.roomId.stringValue === roomType.id)
        .map(b => b.roomNumber.stringValue);

    const allNumbersForType = (roomType.roomNumbers && roomType.roomNumbers.arrayValue && roomType.roomNumbers.arrayValue.values)
        ? roomType.roomNumbers.arrayValue.values.map(v => v.stringValue)
        : [];

    const availableNumbers = allNumbersForType.filter(num => !bookedNumbersForType.includes(num));

    return {
      id: roomType.id,
      name: roomType.name.stringValue,
      price: roomType.price.doubleValue || roomType.price.integerValue,
      capacity: roomType.capacity.integerValue,
      images: (roomType.images.arrayValue.values || []).map(v => v.stringValue),
      facilities: (roomType.facilities.arrayValue.values || []).map(v => v.stringValue),
      availableRooms: availableCount,
      availableRoomNumbers: availableNumbers,
    };
  }).filter(roomType => roomType.availableRooms > 0);

  return availableRoomTypes;
}

function createReservation(payload) {
  const firestore = getFirestore();
  const checkInDate = new Date(payload.checkIn);
  const checkOutDate = new Date(payload.checkOut);

  // Re-verify availability to prevent race conditions
  const availableRooms = checkAvailability(checkInDate, checkOutDate);
  const requestedRoomType = availableRooms.find(r => r.id === payload.roomId);

  if (!requestedRoomType || !requestedRoomType.availableRoomNumbers.includes(payload.roomNumber)) {
    return { error: 'This room is not available for the selected dates.' };
  }

  const newBooking = {
    checkInDate: FirestoreApp.createTimestamp(checkInDate),
    checkOutDate: FirestoreApp.createTimestamp(checkOutDate),
    roomId: payload.roomId,
    roomNumber: payload.roomNumber,
    guestName: payload.guestName,
    guestEmail: payload.guestEmail || null,
    guestPhoneNumber: payload.guestPhoneNumber || null,
    numberOfGuests: payload.numberOfGuests || 1,
    status: 'Booked', // Unpaid reservation
    createdAt: FirestoreApp.serverTimestamp(),
  };

  const newDoc = firestore.createDocument('bookings', newBooking);

  return {
    success: true,
    bookingId: newDoc.getName().split('/').pop(),
    message: "Reservation created successfully."
  };
}

// --- Utility Functions ---
function createJsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode !== 200) {
    // This is a simplification; a robust implementation would handle status codes properly.
    // For Apps Script web apps, the HTTP status is always 200 or a redirect.
    // Errors are signaled through the response body.
  }
  return output;
}

// --- Firestore Service (Keep this at the bottom) ---
function getFirestore() {
  const serviceAccount = {
    "type": "service_account",
    "project_id": PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID'),
    "private_key_id": PropertiesService.getScriptProperties().getProperty('FIREBASE_PRIVATE_KEY_ID'),
    "private_key": PropertiesService.getScriptProperties().getProperty('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    "client_email": PropertiesService.getScriptProperties().getProperty('FIREBASE_CLIENT_EMAIL'),
    "client_id": PropertiesService.getScriptProperties().getProperty('FIREBASE_CLIENT_ID'),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": PropertiesService.getScriptProperties().getProperty('FIREBASE_CLIENT_X509_CERT_URL')
  };

  return FirestoreApp.getFirestore(serviceAccount.client_email, serviceAccount.private_key, serviceAccount.project_id);
}
