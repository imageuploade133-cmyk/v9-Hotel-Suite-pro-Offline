# WhatsApp Service - Quick Reference Card

## 🚀 30-Second Quick Start

```typescript
import { sendWhatsAppMessage } from '@/lib/whatsapp';

// Send a message
const result = await sendWhatsAppMessage({
  recipients: '+2348012345678',
  subject: 'Hello!',
  message: 'Test message',
});

if (result.success) {
  console.log('✅ Sent!');
}
```

## 📱 Pre-built Templates

```typescript
import {
  sendBookingConfirmation,
  sendCheckInNotification,
  sendCheckOutReminder,
  sendPaymentConfirmation,
  sendPromotionalMessage,
} from '@/lib/whatsapp';

// Booking confirmation
await sendBookingConfirmation(
  phone, guestName, bookingId, checkIn, checkOut, roomNumber
);

// Check-in notification
await sendCheckInNotification(phone, guestName, roomNumber);

// Check-out reminder
await sendCheckOutReminder(phone, guestName, checkOutDate);

// Payment confirmation
await sendPaymentConfirmation(phone, guestName, amount, method);

// Bulk promotional
await sendPromotionalMessage([phone1, phone2, ...], subject, message);
```

## 📋 API Reference

### Main Function
```typescript
sendWhatsAppMessage({
  recipients: string | string[],  // Phone(s) with country code
  subject: string,                 // Max 100 chars
  message: string                  // Max 1000 chars
})
```

### Returns
```typescript
{
  success: boolean,
  message: string,
  messageId?: string,
  status?: string,
  cost?: number,
  rawResponse?: any
}
```

## 🔢 Phone Number Formats

All these work automatically:
- `08012345678` → `2348012345678`
- `+2348012345678` → `2348012345678`
- `2348012345678` → `2348012345678`

## 🛠️ Utility Functions

```typescript
import {
  formatPhoneNumber,
  checkWhatsAppServiceConfig
} from '@/lib/whatsapp';

// Format a phone number
const formatted = formatPhoneNumber('08012345678');

// Check configuration
const config = checkWhatsAppServiceConfig();
if (config.configured) {
  console.log('✅ Ready!');
}
```

## 🧪 Testing

```typescript
import {
  quickConfigCheck,
  quickTestMessage,
  runAllTests
} from '@/lib/whatsapp-test-utils';

// Quick config check
quickConfigCheck();

// Send test message
await quickTestMessage('08012345678');

// Run all tests
await runAllTests({ skipMessageTests: true });
```

## 🎨 React Component

```typescript
import { WhatsAppTestPanel } from '@/components/whatsapp';

export default function TestPage() {
  return <WhatsAppTestPanel />;
}
```

## ⚠️ Validation Rules

| Field | Requirement |
|-------|-------------|
| Recipients | 1-100 phone numbers |
| Phone | Must include country code |
| Subject | Max 100 characters |
| Message | Max 1000 characters |

## 📚 Documentation

- **Start Here:** `README_WHATSAPP.md`
- **API Reference:** `WHATSAPP_SERVICE_SETUP.md`
- **Integration Guide:** `WHATSAPP_INTEGRATION_GUIDE.md`
- **Full Summary:** `WHATSAPP_IMPLEMENTATION_COMPLETE.md`

## 🔧 Your Credentials

Already configured in `.env.local`:
- Username: `electro1@emakemrnd.com.ng`
- API Key: `4e72ff9e21f1e875834598daeacfd997a892bca332fce1a90804cb15ca2da398`

## ❌ Error Handling

```typescript
const result = await sendWhatsAppMessage(params);

if (result.success) {
  // Success
  toast.success('Message sent!');
} else {
  // Error
  toast.error(result.message);
}
```

## 🎯 Common Use Cases

```typescript
// 1. Booking created
await sendBookingConfirmation(phone, name, id, in, out, room);

// 2. Guest checked in
await sendCheckInNotification(phone, name, room);

// 3. Payment received
await sendPaymentConfirmation(phone, name, amount, 'Card');

// 4. Check-out reminder
await sendCheckOutReminder(phone, name, date);

// 5. Bulk announcement
await sendPromotionalMessage([p1, p2, p3], 'Offer', 'Message');
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Credentials not configured" | Check `.env.local` exists |
| "Invalid phone format" | Use country code (234 for Nigeria) |
| Messages not sending | Check eBulkSMS balance and console logs |

## 📞 Help

- Check console logs
- Review documentation files
- Test with `whatsapp-examples.ts`
- Use `whatsapp-test-utils.ts`

---

**Version:** 2.0 | **Status:** ✅ Production Ready
