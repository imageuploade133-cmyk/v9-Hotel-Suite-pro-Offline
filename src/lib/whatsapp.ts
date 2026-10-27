/**
 * WhatsApp Messaging Service - eBulkSMS Integration
 *
 * This service provides a robust, production-ready implementation for sending
 * WhatsApp messages through the eBulkSMS WhatsApp API.
 *
 * API Documentation: https://api.ebulksms.com/sendwhatsapp.json
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface WhatsAppMessageParams {
  recipients: string | string[];
  subject: string;
  message: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  message: string;
  messageId?: string;
  status?: string;
  cost?: number;
  rawResponse?: any;
}

export interface WhatsAppError {
  code: string;
  message: string;
  details?: any;
}

// ============================================================================
// Configuration
// ============================================================================

const EWHATSAPP_CONFIG = {
  API_URL: 'https://api.ebulksms.com/sendwhatsapp.json',
  USERNAME: process.env.NEXT_PUBLIC_EWHATSAPP_USERNAME || 'electro1@emakemrnd.com.ng',
  API_KEY: process.env.NEXT_PUBLIC_EWHATSAPP_API_KEY || '4e72ff9e21f1e875834598daeacfd997a892bca332fce1a90804cb15ca2da398',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  TIMEOUT: 30000, // 30 seconds
};

// ============================================================================
// Validation and Formatting Utilities
// ============================================================================

/**
 * Validates and formats a phone number for eBulkSMS API
 * Expected format: 2348012345678 (country code + number, no + prefix)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove + prefix if present (eBulkSMS expects numbers without +)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading zeros for Nigerian numbers (0801 -> 234801)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '234' + cleaned.substring(1);
  }

  // Validate: must start with country code (minimum 10 digits total)
  if (cleaned.length < 10) {
    throw new Error(
      `Invalid phone number format: ${phone}. Must include country code (e.g., 2348012345678 or +2348012345678)`
    );
  }

  return cleaned;
}

/**
 * Validates an array of phone numbers
 */
export function validateRecipients(recipients: string[]): string[] {
  if (!recipients || recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }

  if (recipients.length > 100) {
    throw new Error('Maximum 100 recipients allowed per message');
  }

  return recipients.map((recipient) => formatPhoneNumber(recipient));
}

/**
 * Validates message content
 */
export function validateMessage(subject: string, message: string): void {
  if (!subject || subject.trim().length === 0) {
    throw new Error('Message subject is required');
  }

  if (subject.length > 100) {
    throw new Error('Subject must be less than 100 characters');
  }

  if (!message || message.trim().length === 0) {
    throw new Error('Message content is required');
  }

  if (message.length > 1000) {
    throw new Error('Message must be less than 1000 characters');
  }
}

// ============================================================================
// Main WhatsApp Send Function
// ============================================================================

/**
 * Sends a WhatsApp message via eBulkSMS API
 *
 * @param params - Message parameters including recipients, subject, and message
 * @returns Promise<WhatsAppSendResult> - Result of the send operation
 */
export async function sendWhatsAppMessage(
  params: WhatsAppMessageParams
): Promise<WhatsAppSendResult> {
  const { recipients, subject, message } = params;

  try {
    // Validate inputs
    const formattedRecipients = validateRecipients(
      Array.isArray(recipients) ? recipients : [recipients]
    );
    validateMessage(subject, message);

    // Prepare API request payload
    const payload = {
      WA: {
        auth: {
          username: EWHATSAPP_CONFIG.USERNAME,
          apikey: EWHATSAPP_CONFIG.API_KEY,
        },
        message: {
          subject: subject.trim(),
          messagetext: message.trim(),
        },
        recipients: formattedRecipients,
      },
    };

    console.log('📱 Sending WhatsApp message...');
    console.log('Recipients:', formattedRecipients.join(', '));
    console.log('Subject:', subject);
    console.log('Message length:', message.length);

    // Send request with retry logic
    const response = await sendWithRetry(payload);

    console.log('✅ WhatsApp message sent successfully');
    return {
      success: true,
      message: 'Message sent successfully',
      messageId: response.messageId,
      status: response.status,
      cost: response.cost,
      rawResponse: response,
    };

  } catch (error: any) {
    console.error('❌ WhatsApp message send failed:', error);

    const errorResult: WhatsAppSendResult = {
      success: false,
      message: error.message || 'Failed to send message',
      rawResponse: error,
    };

    return errorResult;
  }
}

/**
 * Sends a request to the eBulkSMS API with retry logic
 */
async function sendWithRetry(
  payload: any,
  attempt: number = 1
): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      EWHATSAPP_CONFIG.TIMEOUT
    );

    const response = await fetch(EWHATSAPP_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Check API response for errors
    if (data.WA?.response?.status === 'ERROR') {
      const errorMessage =
        data.WA.response?.data?.message || 'Unknown API error';
      throw new Error(`API Error: ${errorMessage}`);
    }

    // Extract relevant information from response
    const responseData = data.WA?.response?.data;
    return {
      messageId: responseData?.messageid,
      status: responseData?.status,
      cost: responseData?.cost,
      fullResponse: data,
    };

  } catch (error: any) {
    // Retry on network errors or 5xx server errors
    if (
      attempt < EWHATSAPP_CONFIG.MAX_RETRIES &&
      (error.name === 'AbortError' ||
        error.message.includes('fetch') ||
        error.message.includes('network'))
    ) {
      console.log(
        `⚠️  Retry ${attempt}/${EWHATSAPP_CONFIG.MAX_RETRIES} after error: ${error.message}`
      );

      // Exponential backoff
      const delay = EWHATSAPP_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return sendWithRetry(payload, attempt + 1);
    }

    throw error;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Sends a booking confirmation message
 */
export async function sendBookingConfirmation(
  phoneNumber: string,
  guestName: string,
  bookingId: string,
  checkInDate: string,
  checkOutDate: string,
  roomNumber: string
): Promise<WhatsAppSendResult> {
  const subject = `Booking Confirmation - ${bookingId}`;
  const message = `Dear ${guestName},

Your booking has been confirmed!

📋 Booking Details:
• Booking ID: ${bookingId}
• Check-in: ${checkInDate}
• Check-out: ${checkOutDate}
• Room Number: ${roomNumber}

We look forward to welcoming you!
For any inquiries, please contact us.

Thank you for choosing our hotel! 🏨`;

  return sendWhatsAppMessage({
    recipients: phoneNumber,
    subject,
    message,
  });
}

/**
 * Sends a check-in notification
 */
export async function sendCheckInNotification(
  phoneNumber: string,
  guestName: string,
  roomNumber: string
): Promise<WhatsAppSendResult> {
  const subject = 'Welcome - Check-in Complete';
  const message = `Dear ${guestName},

🎉 Welcome! You have successfully checked in.

📍 Room: ${roomNumber}

WiFi credentials and room information are available at the front desk.
We hope you enjoy your stay!

Need assistance? Just message us anytime. 🛎️`;

  return sendWhatsAppMessage({
    recipients: phoneNumber,
    subject,
    message,
  });
}

/**
 * Sends a check-out reminder
 */
export async function sendCheckOutReminder(
  phoneNumber: string,
  guestName: string,
  checkOutDate: string
): Promise<WhatsAppSendResult> {
  const subject = 'Reminder - Check-out Tomorrow';
  const message = `Dear ${guestName},

⏰ Reminder: Check-out is tomorrow (${checkOutDate})

Please ensure you:
• Return room keys
• Settle any outstanding bills
• Check personal belongings

Thank you for staying with us! We hope to see you again soon. 👋`;

  return sendWhatsAppMessage({
    recipients: phoneNumber,
    subject,
    message,
  });
}

/**
 * Sends a payment confirmation
 */
export async function sendPaymentConfirmation(
  phoneNumber: string,
  guestName: string,
  amount: number,
  paymentMethod: string
): Promise<WhatsAppSendResult> {
  const subject = 'Payment Confirmation';
  const message = `Dear ${guestName},

💳 Payment Received Successfully!

Amount: ${amount.toFixed(2)}
Method: ${paymentMethod}

Your payment has been processed and your booking is confirmed.
Thank you for your payment! ✅`;

  return sendWhatsAppMessage({
    recipients: phoneNumber,
    subject,
    message,
  });
}

/**
 * Sends a promotional message (bulk)
 */
export async function sendPromotionalMessage(
  recipients: string[],
  subject: string,
  message: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage({
    recipients,
    subject,
    message,
  });
}

// ============================================================================
// Logging and Analytics
// ============================================================================

/**
 * Logs message send attempt to console (can be extended to send to Firestore)
 */
export async function logWhatsAppMessage(
  params: WhatsAppMessageParams,
  result: WhatsAppSendResult
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    recipients: Array.isArray(params.recipients)
      ? params.recipients
      : [params.recipients],
    subject: params.subject,
    message: params.message,
    success: result.success,
    status: result.status,
    messageId: result.messageId,
    error: result.success ? null : result.message,
  };

  console.log('📊 WhatsApp Message Log:', JSON.stringify(logEntry, null, 2));

  // TODO: Add Firestore logging if needed
  // await addDoc(collection(db, 'whatsapp-logs'), logEntry);
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Checks if the WhatsApp service is properly configured
 */
export function checkWhatsAppServiceConfig(): {
  configured: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!EWHATSAPP_CONFIG.USERNAME) {
    issues.push('WhatsApp username is not configured');
  }

  if (!EWHATSAPP_CONFIG.API_KEY) {
    issues.push('WhatsApp API key is not configured');
  }

  if (!EWHATSAPP_CONFIG.API_URL) {
    issues.push('WhatsApp API URL is not configured');
  }

  return {
    configured: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Export All
// ============================================================================

export default {
  sendWhatsAppMessage,
  formatPhoneNumber,
  validateRecipients,
  validateMessage,
  sendBookingConfirmation,
  sendCheckInNotification,
  sendCheckOutReminder,
  sendPaymentConfirmation,
  sendPromotionalMessage,
  logWhatsAppMessage,
  checkWhatsAppServiceConfig,
};
