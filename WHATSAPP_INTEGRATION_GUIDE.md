# WhatsApp Service Integration Guide

This guide provides step-by-step instructions for integrating the WhatsApp messaging service into various parts of Hotel Suite Pro.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Booking Workflow Integration](#booking-workflow-integration)
3. [Check-in/Check-out Integration](#check-incheck-out-integration)
4. [Payment Notifications](#payment-notifications)
5. [Bulk Messaging](#bulk-messaging)
6. [Guest Communications](#guest-communications)
7. [Admin Panel Integration](#admin-panel-integration)
8. [Testing and Validation](#testing-and-validation)

---

## Quick Start

### 1. Import the Service

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';
```

### 2. Send a Message

```typescript
const result = await sendWhatsAppMessage({
  recipients: '+2348012345678',
  subject: 'Test',
  message: 'Hello from Hotel Suite Pro!'
});

if (result.success) {
  console.log('✅ Message sent');
}
```

### 3. Handle Results

```typescript
if (result.success) {
  // Success handling
  toast.success('Message sent successfully');
} else {
  // Error handling
  toast.error('Failed to send message: ' + result.message);
}
```

---

## Booking Workflow Integration

### Scenario 1: New Booking Created

**File:** Any booking creation component/page

```typescript
import { sendBookingConfirmation } from '@/lib/whatsapp';

async function createNewBooking(bookingData: BookingFormData) {
  try {
    // 1. Validate and prepare booking data
    const booking = {
      ...bookingData,
      bookingId: `BKG-${Date.now()}`,
      status: 'Booked',
      createdAt: new Date().toISOString(),
    };

    // 2. Save to Firestore
    const bookingRef = await addDoc(collection(db, 'bookings'), booking);
    console.log('✅ Booking saved:', bookingRef.id);

    // 3. Send WhatsApp confirmation
    const whatsappResult = await sendBookingConfirmation(
      booking.guestPhoneNumber,
      booking.guestName,
      booking.bookingId,
      booking.checkInDate,
      booking.checkOutDate,
      booking.roomNumber
    );

    // 4. Handle WhatsApp result
    if (whatsappResult.success) {
      console.log('✅ WhatsApp confirmation sent');
      toast.success('Booking created and confirmation sent!');
    } else {
      console.warn('⚠️ WhatsApp failed:', whatsappResult.message);
      toast.warning('Booking created but confirmation message failed');
    }

    // 5. Update booking with WhatsApp status
    await updateDoc(doc(db, 'bookings', bookingRef.id), {
      whatsappSent: whatsappResult.success,
      whatsappMessageId: whatsappResult.messageId,
    });

    return {
      success: true,
      bookingId: booking.bookingId,
      whatsappResult,
    };

  } catch (error) {
    console.error('❌ Booking creation failed:', error);
    toast.error('Failed to create booking');
    throw error;
  }
}
```

### Scenario 2: Booking Modification

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function updateBooking(
  bookingId: string,
  updates: Partial<Booking>
) {
  try {
    // 1. Get current booking
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const currentBooking = bookingDoc.data();

    // 2. Apply updates
    await updateDoc(doc(db, 'bookings', bookingId), updates);

    // 3. Send notification if significant changes
    if (updates.checkInDate || updates.checkOutDate || updates.roomNumber) {
      const message = `Dear ${currentBooking.guestName},

Your booking has been updated.

Updated Details:
• Booking ID: ${currentBooking.bookingId}
• Check-in: ${updates.checkInDate || currentBooking.checkInDate}
• Check-out: ${updates.checkOutDate || currentBooking.checkOutDate}
• Room Number: ${updates.roomNumber || currentBooking.roomNumber}

If you did not request this change, please contact us immediately.`;

      await sendWhatsAppMessage({
        recipients: currentBooking.guestPhoneNumber,
        subject: 'Booking Updated',
        message,
      });
    }

    return { success: true };

  } catch (error) {
    console.error('Update failed:', error);
    throw error;
  }
}
```

### Scenario 3: Booking Cancellation

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function cancelBooking(bookingId: string, reason?: string) {
  try {
    // 1. Get booking details
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const booking = bookingDoc.data();

    // 2. Update status
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'Cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
    });

    // 3. Send cancellation notification
    const message = `Dear ${booking.guestName},

Your booking has been cancelled.

Booking Details:
• Booking ID: ${booking.bookingId}
• Original Dates: ${booking.checkInDate} to ${booking.checkOutDate}

${reason ? `Reason: ${reason}` : ''}

If this cancellation was made in error, please contact us immediately to reschedule.`;

    await sendWhatsAppMessage({
      recipients: booking.guestPhoneNumber,
      subject: 'Booking Cancelled',
      message,
    });

    return { success: true };

  } catch (error) {
    console.error('Cancellation failed:', error);
    throw error;
  }
}
```

---

## Check-in/Check-out Integration

### Scenario 1: Guest Check-in

**File:** Check-in handler/component

```typescript
import { sendCheckInNotification } from '@/lib/whatsapp';

async function processGuestCheckIn(bookingId: string) {
  try {
    // 1. Get booking
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const booking = bookingDoc.data();

    // 2. Validate booking can be checked in
    if (booking.status !== 'Booked') {
      throw new Error('Booking is not eligible for check-in');
    }

    // 3. Update status
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'CheckedIn',
      checkInTime: new Date().toISOString(),
      checkedInBy: currentUser?.uid,
    });

    // 4. Send WhatsApp notification
    const whatsappResult = await sendCheckInNotification(
      booking.guestPhoneNumber,
      booking.guestName,
      booking.roomNumber
    );

    // 5. Update room status
    await updateDoc(doc(db, 'rooms', booking.roomId), {
      status: 'Occupied',
    });

    return {
      success: true,
      whatsappResult,
    };

  } catch (error) {
    console.error('Check-in failed:', error);
    throw error;
  }
}
```

### Scenario 2: Guest Check-out

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function processGuestCheckOut(bookingId: string) {
  try {
    // 1. Get booking
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const booking = bookingDoc.data();

    // 2. Update status
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'CheckedOut',
      checkOutTime: new Date().toISOString(),
      checkedOutBy: currentUser?.uid,
    });

    // 3. Send check-out message
    const message = `Dear ${booking.guestName},

Thank you for staying with us!

We hope you had a wonderful stay. Please take a moment to complete our quick feedback survey.

Your feedback helps us improve our services.

Safe travels, and we hope to welcome you back soon! 👋`;

    await sendWhatsAppMessage({
      recipients: booking.guestPhoneNumber,
      subject: 'Thank You for Your Stay',
      message,
    });

    // 4. Update room status
    await updateDoc(doc(db, 'rooms', booking.roomId), {
      status: 'Housekeeping',
    });

    return { success: true };

  } catch (error) {
    console.error('Check-out failed:', error);
    throw error;
  }
}
```

### Scenario 3: Check-out Reminder (Scheduled)

```typescript
import { sendCheckOutReminder } from '@/lib/whatsapp';

// This can be called by a scheduled job or cron
async function sendCheckOutReminders() {
  try {
    // 1. Find bookings checking out tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('checkOutDate', '==', tomorrowStr),
      where('status', '==', 'CheckedIn')
    );

    const snapshot = await getDocs(bookingsQuery);

    // 2. Send reminders to each booking
    const results = [];
    for (const doc of snapshot.docs) {
      const booking = doc.data();

      const result = await sendCheckOutReminder(
        booking.guestPhoneNumber,
        booking.guestName,
        booking.checkOutDate
      );

      results.push({
        bookingId: booking.bookingId,
        success: result.success,
        error: result.message,
      });
    }

    return {
      total: snapshot.size,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    };

  } catch (error) {
    console.error('Failed to send reminders:', error);
    throw error;
  }
}
```

---

## Payment Notifications

### Scenario 1: Payment Received

```typescript
import { sendPaymentConfirmation } from '@/lib/whatsapp';

async function recordPayment(paymentData: PaymentData) {
  try {
    // 1. Create payment record
    const paymentRef = await addDoc(collection(db, 'payments'), {
      ...paymentData,
      createdAt: new Date().toISOString(),
    });

    // 2. Get booking details
    const bookingDoc = await getDoc(doc(db, 'bookings', paymentData.bookingId));
    const booking = bookingDoc.data();

    // 3. Send payment confirmation
    await sendPaymentConfirmation(
      booking.guestPhoneNumber,
      booking.guestName,
      paymentData.amount,
      paymentData.paymentMethod
    );

    // 4. Update booking payment status if fully paid
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('bookingId', '==', paymentData.bookingId)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    const totalPaid = paymentsSnapshot.docs.reduce(
      (sum, doc) => sum + doc.data().amount,
      0
    );

    if (totalPaid >= booking.totalAmount) {
      await updateDoc(doc(db, 'bookings', paymentData.bookingId), {
        paymentStatus: 'Paid',
      });
    }

    return { success: true, paymentId: paymentRef.id };

  } catch (error) {
    console.error('Payment recording failed:', error);
    throw error;
  }
}
```

### Scenario 2: Payment Reminder

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function sendPaymentReminder(bookingId: string) {
  try {
    // 1. Get booking
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const booking = bookingDoc.data();

    // 2. Calculate balance
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('bookingId', '==', bookingId)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    const totalPaid = paymentsSnapshot.docs.reduce(
      (sum, doc) => sum + doc.data().amount,
      0
    );
    const balance = booking.totalAmount - totalPaid;

    // 3. Send reminder
    const message = `Dear ${booking.guestName},

This is a friendly reminder about your booking payment.

Payment Summary:
• Booking ID: ${booking.bookingId}
• Check-in: ${booking.checkInDate}
• Total Amount: ₦${booking.totalAmount.toLocaleString()}
• Amount Paid: ₦${totalPaid.toLocaleString()}
• Balance Due: ₦${balance.toLocaleString()}

Please complete your payment before check-in.

Payment Methods:
- Bank Transfer
- Credit/Debit Card
- Cash at Reception

Thank you!`;

    await sendWhatsAppMessage({
      recipients: booking.guestPhoneNumber,
      subject: 'Payment Reminder',
      message,
    });

    return { success: true };

  } catch (error) {
    console.error('Payment reminder failed:', error);
    throw error;
  }
}
```

---

## Bulk Messaging

### Scenario 1: Promotional Campaign

```typescript
import { sendPromotionalMessage } from '@/lib/whatsapp';

async function sendPromotionalCampaign() {
  try {
    // 1. Get guest list (from past bookings)
    const guestsQuery = query(
      collection(db, 'bookings'),
      where('status', '==', 'CheckedOut'),
      orderBy('checkOutDate', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(guestsQuery);

    // 2. Extract unique phone numbers
    const phoneNumbers = [
      ...new Set(
        snapshot.docs
          .map((doc) => doc.data().guestPhoneNumber)
          .filter(Boolean)
      ),
    ];

    // 3. Send promotional message
    const result = await sendPromotionalMessage(
      phoneNumbers,
      'Special Offer: 20% Off!',
      `🎉 Special Offer!

Book your next stay with us and get 20% off!

Use promo code: HOTEL20
Valid until: 31st December 2025

Book now at our website or call us!`
    );

    if (result.success) {
      toast.success(`Promotional message sent to ${phoneNumbers.length} guests`);
    }

    return result;

  } catch (error) {
    console.error('Campaign failed:', error);
    throw error;
  }
}
```

### Scenario 2: Important Announcement

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function sendSystemAnnouncement(
  recipients: string[],
  subject: string,
  message: string
) {
  try {
    // Split into batches of 100 (API limit)
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    // Send each batch
    const results = [];
    for (const batch of batches) {
      const result = await sendWhatsAppMessage({
        recipients: batch,
        subject,
        message,
      });
      results.push(result);
    }

    const totalSent = results.filter((r) => r.success).length;
    toast.success(`Announcement sent to ${totalSent} recipients`);

    return {
      totalBatches: batches.length,
      successful: totalSent,
      failed: batches.length - totalSent,
    };

  } catch (error) {
    console.error('Announcement failed:', error);
    throw error;
  }
}
```

---

## Guest Communications

### Scenario 1: Room Service Request Confirmation

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function confirmRoomServiceRequest(
  bookingId: string,
  serviceType: string,
  notes?: string
) {
  try {
    // 1. Get booking
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const booking = bookingDoc.data();

    // 2. Create service request
    const requestRef = await addDoc(collection(db, 'serviceRequests'), {
      bookingId,
      guestName: booking.guestName,
      roomNumber: booking.roomNumber,
      serviceType,
      notes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    });

    // 3. Send confirmation
    const message = `Dear ${booking.guestName},

Your room service request has been received.

Request Details:
• Service: ${serviceType}
• Room: ${booking.roomNumber}
• Request ID: ${requestRef.id.substring(0, 8).toUpperCase()}

${notes ? `Notes: ${notes}` : ''}

Our team will attend to your request shortly.
Thank you!`;

    await sendWhatsAppMessage({
      recipients: booking.guestPhoneNumber,
      subject: 'Room Service Request Received',
      message,
    });

    return { success: true, requestId: requestRef.id };

  } catch (error) {
    console.error('Request confirmation failed:', error);
    throw error;
  }
}
```

### Scenario 2: Housekeeping Request

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

async function requestHousekeeping(
  bookingId: string,
  requestType: 'cleaning' | 'towels' | 'amenities' | 'maintenance'
) {
  try {
    // 1. Get booking
    const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
    const booking = bookingDoc.data();

    // 2. Create request
    await addDoc(collection(db, 'housekeepingRequests'), {
      bookingId,
      roomNumber: booking.roomNumber,
      requestType,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    });

    // 3. Send confirmation
    const message = `Dear ${booking.guestName},

Your housekeeping request has been received.

Request: ${requestType}
Room: ${booking.roomNumber}

Our housekeeping team will be there shortly.
Thank you!`;

    await sendWhatsAppMessage({
      recipients: booking.guestPhoneNumber,
      subject: 'Housekeeping Request',
      message,
    });

    return { success: true };

  } catch (error) {
    console.error('Housekeeping request failed:', error);
    throw error;
  }
}
```

---

## Admin Panel Integration

### Scenario 1: WhatsApp Message Composer

Create a page at `src/app/(protected)/admin/whatsapp/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { WhatsAppTestPanel } from '@/components/whatsapp';

export default function WhatsAppAdminPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">WhatsApp Messaging</h1>
      <WhatsAppTestPanel />
    </div>
  );
}
```

### Scenario 2: Bulk Message Sender

```typescript
'use client';

import { useState } from 'react';
import { sendPromotionalMessage } from '@/lib/whatsapp';

export function BulkMessageSender() {
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const phoneNumbers = recipients
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    setSending(true);
    const result = await sendPromotionalMessage(phoneNumbers, subject, message);
    setSending(false);

    if (result.success) {
      alert(`Message sent to ${phoneNumbers.length} recipients!`);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        placeholder="Enter phone numbers (one per line)"
        value={recipients}
        onChange={(e) => setRecipients(e.target.value)}
        rows={10}
      />
      <input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
      />
      <button onClick={handleSend} disabled={sending}>
        {sending ? 'Sending...' : 'Send Bulk Message'}
      </button>
    </div>
  );
}
```

---

## Testing and Validation

### Unit Testing

```typescript
import { formatPhoneNumber, validateMessage } from '@/lib/whatsapp';

describe('WhatsApp Service', () => {
  test('formats Nigerian phone numbers correctly', () => {
    expect(formatPhoneNumber('08012345678')).toBe('2348012345678');
    expect(formatPhoneNumber('+2348012345678')).toBe('2348012345678');
  });

  test('validates message content', () => {
    expect(() => validateMessage('', 'test')).toThrow();
    expect(() => validateMessage('subject', '')).toThrow();
  });
});
```

### Integration Testing

```typescript
import { runAllTests } from '@/lib/whatsapp-test-utils';

// Run tests in development
if (process.env.NODE_ENV === 'development') {
  runAllTests({
    skipMessageTests: true, // Skip actual API calls
  });
}
```

---

## Best Practices

### 1. Error Handling

Always handle both success and error cases:

```typescript
const result = await sendWhatsAppMessage(params);

if (result.success) {
  // Update UI, show success message
} else {
  // Show error, log to console, maybe retry later
}
```

### 2. Asynchronous Operations

Don't block the main thread:

```typescript
// Don't await if message sending is not critical
sendWhatsAppMessage(params).then((result) => {
  if (!result.success) {
    console.error('WhatsApp failed:', result.message);
  }
});

// Or use fire-and-forget pattern
sendWhatsAppMessage(params).catch(console.error);
```

### 3. Phone Number Storage

Always store phone numbers in a consistent format (with country code):

```typescript
// When collecting phone numbers
const formattedPhone = formatPhoneNumber(inputPhone);
await saveBooking({ ...data, guestPhoneNumber: formattedPhone });
```

### 4. Logging

Log important events for debugging:

```typescript
console.log('📱 Sending WhatsApp to:', phoneNumber);
console.log('✅ WhatsApp sent successfully:', result.messageId);
```

### 5. User Feedback

Always provide feedback to the user:

```typescript
toast.success('Confirmation sent to WhatsApp');
toast.error('Failed to send message', { description: result.message });
```

---

## Troubleshooting

### Messages not sending?

1. Check credentials in `.env.local`
2. Verify eBulkSMS account balance
3. Check console logs for errors
4. Test with `quickConfigCheck()`

### Phone number format errors?

1. Ensure country code is included
2. Use `formatPhoneNumber()` to validate
3. Check for extra spaces or special characters

### Rate limiting issues?

1. Implement batching for bulk messages
2. Add delays between batches
3. Monitor API response for rate limit info

---

## Summary

The WhatsApp service is designed to be:

- ✅ **Easy to use**: Simple function calls
- ✅ **Flexible**: Works with any workflow
- ✅ **Robust**: Handles errors gracefully
- ✅ **Well-documented**: Clear examples and guides
- ✅ **Production-ready**: Tested and validated

Start integrating today and improve guest communication! 🚀
