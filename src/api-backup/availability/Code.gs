
/**
 * @fileoverview Google Apps Script for Hotel Suite Pro Booking Engine.
 *
 * This script provides two main functions when deployed as a web app:
 * 1.  doGet(e): Handles GET requests to check room availability for given dates.
 * 2.  doPost(e): Handles POST requests to create a new unpaid reservation.
 *
 * It interacts with a Firestore database to manage room and booking data.
 * You must add the Firestore service in the Apps Script editor and configure
 * the script properties with your Firebase project credentials.
 */


// --- Firestore Initialization ---

// To make this work, you need to:
// 1. In the Apps Script editor, go to "Services" > "Add Service" > "Firestore".
// 2. Click "Connect to GCP Project" and enter your Firebase Project ID.
// 3. Go to "Project Settings" (gear icon) > "Script properties" and add the following properties:
//    - FIREBASE_PROJECT_ID: Your Firebase project ID.
//    - FIREBASE_CLIENT_EMAIL: The client email from your service account JSON file.
//    - FIREBASE_PRIVATE_KEY: The private key from your service account JSON file (including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines, replacing newline characters with \n).

let firestore;

/**
 * Initializes a connection to the Firestore database using service account credentials.
 * @returns {Firestore} An authenticated Firestore service instance.
 */
function getFirestoreInstance() {
  if (firestore) {
    return firestore;
  }
  const scriptProperties = PropertiesService.getScriptProperties();
  const projectId = scriptProperties.getProperty('FIREBASE_PROJECT_ID');
  const clientEmail = scriptProperties.getProperty('FIREBASE_CLIENT_EMAIL');
  const privateKey = scriptProperties.getProperty('FIREBASE_PRIVATE_KEY');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firestore configuration is missing in script properties.");
  }

  firestore = FirestoreApp.getFirestore(clientEmail, privateKey, projectId);
  return firestore;
}


// --- Main API Functions ---

/**
 * Handles GET requests. Currently used for checking room availability.
 * @param {GoogleAppsScript.Events.DoGet} e The event parameter containing request details.
 * @returns {ContentService.TextOutput} A JSON response.
 */
function doGet(e) {
  try {
    // Correctly access parameters from the event object
    const action = e.parameter.action;

    if (action === 'getAvailability') {
      const checkInDateStr = e.parameter.checkIn;
      const checkOutDateStr = e.parameter.checkOut;

      if (!checkInDateStr || !checkOutDateStr) {
        return createJsonResponse({ error: 'checkIn and checkOut date parameters are required.' }, 400);
      }

      const availableRooms = getAvailableRooms(checkInDateStr, checkOutDateStr);
      return createJsonResponse(availableRooms);
    } else {
      return createJsonResponse({ error: 'Invalid or missing action parameter.' }, 400);
    }
  } catch (error) {
    Logger.log(error.toString());
    return createJsonResponse({ error: 'An internal server error occurred.', details: error.toString() }, 500);
  }
}

/**
 * Handles POST requests. Currently used for creating new reservations.
 * @param {GoogleAppsScript.Events.DoPost} e The event parameter containing request details.
 * @returns {ContentService.TextOutput} A JSON response.
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (action === 'createReservation') {
      const payload = requestData.payload;
      const result = createReservation(payload);
      return createJsonResponse(result);
    } else {
      return createJsonResponse({ error: 'Invalid or missing action in POST body.' }, 400);
    }
  } catch (error) {
    Logger.log(error.toString());
    return createJsonResponse({ error: 'An internal server error occurred.', details: error.toString() }, 500);
  }
}


// --- Business Logic ---

/**
 * Retrieves all rooms that are available for a given date range.
 * @param {string} checkInDateStr - The check-in date in YYYY-MM-DD format.
 * @param {string} checkOutDateStr - The check-out date in YYYY-MM-DD format.
 * @returns {Array<Object>} An array of available room objects.
 */
function getAvailableRooms(checkInDateStr, checkOutDateStr) {
  const firestore = getFirestoreInstance();
  const checkInDate = new Date(checkInDateStr);
  const checkOutDate = new Date(checkOutDateStr);

  const rooms = firestore.getDocuments('rooms').map(doc => ({ id: doc.getName(), ...doc.obj }));
  const bookings = firestore.getDocuments('bookings').map(doc => ({ id: doc.getName(), ...doc.obj }));

  const conflictingBookings = bookings.filter(booking => {
    const bookingStart = new Date(booking.checkInDate._seconds * 1000);
    const bookingEnd = new Date(booking.checkOutDate._seconds * 1000);

    // Check for overlap
    return (checkInDate < bookingEnd && checkOutDate > bookingStart);
  });

  const availableRooms = rooms.map(roomType => {
    const bookedRoomNumbersForType = conflictingBookings
      .filter(b => b.roomId === roomType.id)
      .map(b => b.roomNumber);

    const availableRoomNumbers = roomType.roomNumbers.filter(num => !bookedRoomNumbersForType.includes(num));

    return {
      ...roomType,
      availableRooms: availableRoomNumbers.length,
      availableRoomNumbers: availableRoomNumbers,
    };
  }).filter(roomType => roomType.availableRooms > 0);

  return availableRooms;
}

/**
 * Creates a new reservation in the Firestore database.
 * @param {Object} payload - The reservation data.
 * @returns {Object} A success or error object.
 */
function createReservation(payload) {
  const firestore = getFirestoreInstance();

  if (!payload.roomId || !payload.roomNumber || !payload.checkIn || !payload.checkOut || !payload.guestName) {
    throw new Error('Missing required fields for reservation.');
  }

  // Check availability again to be sure
  const available = getAvailableRooms(payload.checkIn, payload.checkOut);
  const selectedRoomType = available.find(r => r.id === payload.roomId);

  if (!selectedRoomType || !selectedRoomType.availableRoomNumbers.includes(payload.roomNumber)) {
    throw new Error('This room is not available for the selected dates.');
  }

  const bookingId = `WEB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  firestore.createDocument('bookings', {
    guestName: payload.guestName,
    guestEmail: payload.guestEmail || null,
    guestPhoneNumber: payload.guestPhoneNumber || null,
    checkInDate: new Date(payload.checkIn),
    checkOutDate: new Date(payload.checkOut),
    roomId: payload.roomId,
    roomNumber: payload.roomNumber,
    numberOfGuests: payload.numberOfGuests || 1,
    status: 'Booked', // Unpaid reservation
    createdAt: new Date(),
    bookingId: bookingId,
    source: 'Website',
  });

  return { success: true, bookingId: bookingId, message: "Reservation created successfully." };
}


// --- Utility Functions ---

/**
 * Creates a JSON response object for the web app.
 * @param {Object} data - The data to be sent as JSON.
 * @param {number} [statusCode=200] - The HTTP status code.
 * @returns {ContentService.TextOutput} A JSON formatted TextOutput object.
 */
function createJsonResponse(data, statusCode = 200) {
  const response = ContentService.createTextOutput(JSON.stringify(data));
  response.setMimeType(ContentService.MimeType.JSON);
  // Add headers to allow cross-origin requests (CORS)
  // In a real application, you might want to restrict the origin.
  // response.setHeaders({
  //   'Access-Control-Allow-Origin': '*'
  // });
  return response;
}
