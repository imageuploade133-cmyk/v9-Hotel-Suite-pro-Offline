/**
 * WhatsApp Service Usage Examples
 *
 * This file demonstrates how to use the WhatsApp messaging service
 * in different scenarios within the Hotel Suite Pro application.
 */

import {
  sendWhatsAppMessage,
  sendBookingConfirmation,
  sendCheckInNotification,
  sendCheckOutReminder,
  sendPaymentConfirmation,
  sendPromotionalMessage,
  formatPhoneNumber,
  checkWhatsAppServiceConfig,
} from './whatsapp';

// ==============================================================================
// Example 1: Basic Message Sending
// ==============================================================================

export async function example1_BasicMessage() {
  console.log('=== Example 1: Basic Message ===');

  const result = await sendWhatsAppMessage({
    recipients: '+2348012345678',
    subject: 'Test Message',
    message: 'This is a test message from Hotel Suite Pro.',
  });

  console.log('Result:', result);

  // Handle result
  if (result.success) {
    console.log('✅ Message sent successfully!');
  } else {
    console.error('❌ Failed to send message:', result.message);
  }

  return result;
}

// ==============================================================================
// Example 2: Send to Multiple Recipients
// ==============================================================================

export async function example2_MultipleRecipients() {
  console.log('=== Example 2: Multiple Recipients ===');

  const result = await sendWhatsAppMessage({
    recipients: ['+2348012345678', '+2348023456789', '+2348034567890'],
    subject: 'Hotel Announcement',
    message: 'Important: Swimming pool will be closed for maintenance tomorrow.',
  });

  console.log('Result:', result);
  return result;
}

// ==============================================================================
// Example 3: Booking Confirmation Workflow
// ==============================================================================

export async function example3_BookingConfirmation() {
  console.log('=== Example 3: Booking Confirmation ===');

  const bookingData = {
    phoneNumber: '08012345678', // Will be formatted to 2348012345678
    guestName: 'John Doe',
    bookingId: 'BKG-ABC123',
    checkInDate: '2025-01-15',
    checkOutDate: '2025-01-20',
    roomNumber: '101',
  };

  const result = await sendBookingConfirmation(
    bookingData.phoneNumber,
    bookingData.guestName,
    bookingData.bookingId,
    bookingData.checkInDate,
    bookingData.checkOutDate,
    bookingData.roomNumber
  );

  console.log('Result:', result);
  return result;
}

// ==============================================================================
// Example 4: Check-in Notification
// ==============================================================================

export async function example4_CheckInNotification() {
  console.log('=== Example 4: Check-in Notification ===');

  const result = await sendCheckInNotification(
    '+2348012345678',
    'Jane Smith',
    '205'
  );

  console.log('Result:', result);
  return result;
}

// ==============================================================================
// Example 5: Check-out Reminder
// ==============================================================================

export async function example5_CheckOutReminder() {
  console.log('=== Example 5: Check-out Reminder ===');

  const result = await sendCheckOutReminder(
    '+2348012345678',
    'John Doe',
    '2025-01-20'
  );

  console.log('Result:', result);
  return result;
}

// ==============================================================================
// Example 6: Payment Confirmation
// ==============================================================================

export async function example6_PaymentConfirmation() {
  console.log('=== Example 6: Payment Confirmation ===');

  const result = await sendPaymentConfirmation(
    '+2348012345678',
    'John Doe',
    150000,
    'Credit Card'
  );

  console.log('Result:', result);
  return result;
}

// ==============================================================================
// Example 7: Bulk Promotional Message
// ==============================================================================

export async function example7_PromotionalMessage() {
  console.log('=== Example 7: Promotional Message ===');

  const recipients = [
    '+2348012345678',
    '+2348023456789',
    '+2348034567890',
    '+2348045678901',
    '+2348056789012',
  ];

  const result = await sendPromotionalMessage(
    recipients,
    'Special Offer: 20% Off!',
    '🎉 Special offer! Book now and get 20% off your next stay. Use code: HOTEL20. Offer valid until end of month!'
  );

  console.log('Result:', result);
  return result;
}

// ==============================================================================
// Example 8: Phone Number Formatting
// ==============================================================================

export function example8_PhoneNumberFormatting() {
  console.log('=== Example 8: Phone Number Formatting ===');

  const testNumbers = [
    '08012345678',      // Nigerian format - should become 2348012345678
    '+2348012345678',   // International format - should become 2348012345678
    '2348012345678',    // Already correct format
    '+1 (555) 123-4567', // US format - should become 15551234567
  ];

  testNumbers.forEach((number) => {
    try {
      const formatted = formatPhoneNumber(number);
      console.log(`${number} -> ${formatted} ✅`);
    } catch (error: any) {
      console.log(`${number} -> Error: ${error.message} ❌`);
    }
  });
}

// ==============================================================================
// Example 9: Service Configuration Check
// ==============================================================================

export function example9_ServiceConfigCheck() {
  console.log('=== Example 9: Service Configuration Check ===');

  const config = checkWhatsAppServiceConfig();

  if (config.configured) {
    console.log('✅ WhatsApp service is properly configured');
  } else {
    console.log('❌ WhatsApp service has configuration issues:');
    config.issues.forEach((issue) => console.log(`  - ${issue}`));
  }

  return config;
}

// ==============================================================================
// Example 10: Integration in Booking Component
// ==============================================================================

/**
 * Example: How to integrate WhatsApp sending in a booking component
 */
export async function example10_BookingComponentIntegration() {
  console.log('=== Example 10: Booking Component Integration ===');

  // Simulated booking data from form
  const newBooking = {
    id: 'BKG-' + Date.now(),
    guestName: 'John Doe',
    phoneNumber: '08012345678',
    email: 'john@example.com',
    checkIn: '2025-02-15',
    checkOut: '2025-02-18',
    roomNumber: '101',
    amount: 45000,
  };

  try {
    // 1. Save booking to database (Firestore)
    console.log('Saving booking to database...');
    // await saveBookingToFirestore(newBooking);

    // 2. Send WhatsApp confirmation
    console.log('Sending WhatsApp confirmation...');
    const whatsappResult = await sendBookingConfirmation(
      newBooking.phoneNumber,
      newBooking.guestName,
      newBooking.id,
      newBooking.checkIn,
      newBooking.checkOut,
      newBooking.roomNumber
    );

    if (whatsappResult.success) {
      console.log('✅ Booking created and confirmation sent!');
      return { success: true, booking: newBooking, whatsapp: whatsappResult };
    } else {
      console.warn('⚠️  Booking created but WhatsApp failed:', whatsappResult.message);
      return {
        success: true,
        booking: newBooking,
        whatsapp: whatsappResult,
        warning: 'WhatsApp notification failed',
      };
    }

  } catch (error: any) {
    console.error('❌ Booking failed:', error);
    return { success: false, error: error.message };
  }
}

// ==============================================================================
// Example 11: Integration in Check-in Process
// ==============================================================================

/**
 * Example: How to integrate WhatsApp sending in check-in process
 */
export async function example11_CheckInProcessIntegration() {
  console.log('=== Example 11: Check-in Process Integration ===');

  // Simulated check-in data
  const checkInData = {
    bookingId: 'BKG-ABC123',
    guestName: 'Jane Smith',
    phoneNumber: '+2348023456789',
    roomNumber: '205',
  };

  try {
    // 1. Update booking status to CheckedIn
    console.log('Updating booking status...');
    // await updateBookingStatus(checkInData.bookingId, 'CheckedIn');

    // 2. Send check-in notification
    console.log('Sending check-in notification...');
    const whatsappResult = await sendCheckInNotification(
      checkInData.phoneNumber,
      checkInData.guestName,
      checkInData.roomNumber
    );

    if (whatsappResult.success) {
      console.log('✅ Check-in completed and notification sent!');
      return { success: true, checkIn: checkInData, whatsapp: whatsappResult };
    } else {
      console.warn('⚠️  Check-in completed but notification failed:', whatsappResult.message);
      return {
        success: true,
        checkIn: checkInData,
        whatsapp: whatsappResult,
        warning: 'WhatsApp notification failed',
      };
    }

  } catch (error: any) {
    console.error('❌ Check-in failed:', error);
    return { success: false, error: error.message };
  }
}

// ==============================================================================
// Example 12: Batch Processing with Error Handling
// ==============================================================================

/**
 * Example: Send messages to multiple recipients with individual error handling
 */
export async function example12_BatchProcessing() {
  console.log('=== Example 12: Batch Processing ===');

  const recipients = [
    { name: 'Guest 1', phone: '+2348012345678' },
    { name: 'Guest 2', phone: '+2348023456789' },
    { name: 'Guest 3', phone: '+2348034567890' },
  ];

  const results = {
    total: recipients.length,
    successful: 0,
    failed: 0,
    details: [] as any[],
  };

  for (const recipient of recipients) {
    try {
      const result = await sendWhatsAppMessage({
        recipients: recipient.phone,
        subject: 'Personalized Message',
        message: `Hello ${recipient.name}, this is a personalized message just for you!`,
      });

      if (result.success) {
        results.successful++;
        results.details.push({
          recipient: recipient.name,
          phone: recipient.phone,
          status: 'success',
        });
      } else {
        results.failed++;
        results.details.push({
          recipient: recipient.name,
          phone: recipient.phone,
          status: 'failed',
          error: result.message,
        });
      }
    } catch (error: any) {
      results.failed++;
      results.details.push({
        recipient: recipient.name,
        phone: recipient.phone,
        status: 'error',
        error: error.message,
      });
    }
  }

  console.log('Batch processing complete:', results);
  return results;
}

// ==============================================================================
// Export all examples
// ==============================================================================

export const whatsappExamples = {
  basicMessage: example1_BasicMessage,
  multipleRecipients: example2_MultipleRecipients,
  bookingConfirmation: example3_BookingConfirmation,
  checkInNotification: example4_CheckInNotification,
  checkOutReminder: example5_CheckOutReminder,
  paymentConfirmation: example6_PaymentConfirmation,
  promotionalMessage: example7_PromotionalMessage,
  phoneNumberFormatting: example8_PhoneNumberFormatting,
  serviceConfigCheck: example9_ServiceConfigCheck,
  bookingIntegration: example10_BookingComponentIntegration,
  checkInIntegration: example11_CheckInProcessIntegration,
  batchProcessing: example12_BatchProcessing,
};
