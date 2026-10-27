/**
 * WhatsApp Service Test Utilities
 *
 * This file provides utilities for testing the WhatsApp messaging service
 * in a development environment.
 */

import {
  sendWhatsAppMessage,
  formatPhoneNumber,
  checkWhatsAppServiceConfig,
} from './whatsapp';

// ==============================================================================
// Test Phone Numbers
// ==============================================================================

export const TEST_PHONE_NUMBERS = {
  // Nigerian numbers (various formats)
  NIGERIA_LOCAL: '08012345678',
  NIGERIA_INTERNATIONAL: '+2348012345678',
  NIGERIA_FORMATTED: '2348012345678',

  // Other formats (for testing)
  US_FORMAT: '+1 (555) 123-4567',
  UK_FORMAT: '+44 20 7946 0958',
};

// ==============================================================================
// Test Messages
// ==============================================================================

export const TEST_MESSAGES = {
  SHORT: 'This is a short test message.',
  MEDIUM:
    'This is a medium-length test message. It contains more text but is still under the character limit.',
  LONG: `This is a longer test message that provides a realistic example of what a hotel might send to a guest. It includes multiple lines of text and provides useful information.

Dear Guest,
Welcome to our hotel! We are delighted to have you with us. Your room is ready and we have prepared everything for your comfort. If you need anything during your stay, please do not hesitate to contact our front desk staff who are available 24/7.

We hope you enjoy your stay with us!

Best regards,
Hotel Management`,
};

// ==============================================================================
// Test Subjects
// ==============================================================================

export const TEST_SUBJECTS = {
  SHORT: 'Test',
  MEDIUM: 'Test Message for WhatsApp',
  LONG: 'This is a longer subject that tests the 100 character limit',
};

// ==============================================================================
// Test Configuration
// ==============================================================================

export const TEST_CONFIG = {
  ENABLED: process.env.NODE_ENV === 'development',
  LOG_RESULTS: true,
  SAVE_TO_DB: false, // Set to true to save test results to Firestore
};

// ==============================================================================
// Test Runner
// ==============================================================================

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

export class WhatsAppTestRunner {
  results: TestResult[] = [];

  constructor() {
    this.results = [];
  }

  /**
   * Run a test and record the result
   */
  async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    const timestamp = new Date().toISOString();

    try {
      console.log(`\n🧪 Running test: ${testName}`);
      const data = await testFn();
      const result: TestResult = {
        testName,
        passed: true,
        message: 'Test passed',
        data,
        timestamp,
      };
      this.results.push(result);
      console.log(`✅ ${testName} - PASSED`);
      return result;
    } catch (error: any) {
      const result: TestResult = {
        testName,
        passed: false,
        message: error.message || 'Test failed',
        data: error,
        timestamp,
      };
      this.results.push(result);
      console.error(`❌ ${testName} - FAILED:`, error.message);
      return result;
    }
  }

  /**
   * Get test summary
   */
  getSummary() {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    return {
      total: this.results.length,
      passed,
      failed,
      passRate: ((passed / this.results.length) * 100).toFixed(1) + '%',
    };
  }

  /**
   * Print detailed results
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    this.results.forEach((result) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.testName}`);
      if (!result.passed) {
        console.log(`    Error: ${result.message}`);
      }
    });

    const summary = this.getSummary();
    console.log('\n' + '-'.repeat(60));
    console.log('SUMMARY');
    console.log('-'.repeat(60));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Pass Rate: ${summary.passRate}`);
    console.log('='.repeat(60) + '\n');
  }
}

// ==============================================================================
// Pre-defined Test Suites
// ==============================================================================

/**
 * Test Suite 1: Configuration Tests
 */
export async function runConfigurationTests(runner: WhatsAppTestRunner) {
  // Test 1.1: Service configuration check
  await runner.runTest('Service Configuration Check', async () => {
    const config = checkWhatsAppServiceConfig();
    if (!config.configured) {
      throw new Error('Service not configured: ' + config.issues.join(', '));
    }
    return config;
  });
}

/**
 * Test Suite 2: Phone Number Formatting Tests
 */
export async function runPhoneNumberTests(runner: WhatsAppTestRunner) {
  // Test 2.1: Nigerian local format
  await runner.runTest('Format Nigerian Local Number', async () => {
    const formatted = formatPhoneNumber(TEST_PHONE_NUMBERS.NIGERIA_LOCAL);
    if (formatted !== TEST_PHONE_NUMBERS.NIGERIA_FORMATTED) {
      throw new Error(`Expected ${TEST_PHONE_NUMBERS.NIGERIA_FORMATTED}, got ${formatted}`);
    }
    return formatted;
  });

  // Test 2.2: Nigerian international format
  await runner.runTest('Format Nigerian International Number', async () => {
    const formatted = formatPhoneNumber(TEST_PHONE_NUMBERS.NIGERIA_INTERNATIONAL);
    if (formatted !== TEST_PHONE_NUMBERS.NIGERIA_FORMATTED) {
      throw new Error(`Expected ${TEST_PHONE_NUMBERS.NIGERIA_FORMATTED}, got ${formatted}`);
    }
    return formatted;
  });

  // Test 2.3: Invalid phone number
  await runner.runTest('Reject Invalid Phone Number', async () => {
    try {
      formatPhoneNumber('123');
      throw new Error('Should have thrown error for invalid number');
    } catch (error: any) {
      if (!error.message.includes('Invalid phone number format')) {
        throw new Error('Wrong error message: ' + error.message);
      }
      return { errorCaught: true };
    }
  });
}

/**
 * Test Suite 3: Message Sending Tests
 * NOTE: These tests will send actual messages to eBulkSMS
 * Use your own test number and disable in production
 */
export async function runMessageSendingTests(runner: WhatsAppTestRunner, testPhoneNumber?: string) {
  if (!testPhoneNumber) {
    console.log('\n⚠️  Skipping message sending tests - no test phone number provided');
    console.log('   To enable, provide a phone number: runMessageSendingTests(runner, "your-phone")');
    return;
  }

  // Test 3.1: Send short message
  await runner.runTest('Send Short Message', async () => {
    const result = await sendWhatsAppMessage({
      recipients: testPhoneNumber,
      subject: TEST_SUBJECTS.SHORT,
      message: TEST_MESSAGES.SHORT,
    });
    if (!result.success) {
      throw new Error(result.message);
    }
    return result;
  });

  // Test 3.2: Send long message
  await runner.runTest('Send Long Message', async () => {
    const result = await sendWhatsAppMessage({
      recipients: testPhoneNumber,
      subject: TEST_SUBJECTS.MEDIUM,
      message: TEST_MESSAGES.LONG,
    });
    if (!result.success) {
      throw new Error(result.message);
    }
    return result;
  });
}

/**
 * Test Suite 4: Error Handling Tests
 */
export async function runErrorHandlingTests(runner: WhatsAppTestRunner) {
  // Test 4.1: Missing subject
  await runner.runTest('Reject Missing Subject', async () => {
    try {
      await sendWhatsAppMessage({
        recipients: TEST_PHONE_NUMBERS.NIGERIA_FORMATTED,
        subject: '',
        message: TEST_MESSAGES.SHORT,
      });
      throw new Error('Should have thrown error for missing subject');
    } catch (error: any) {
      if (!error.message.includes('subject')) {
        throw new Error('Wrong error message: ' + error.message);
      }
      return { errorCaught: true };
    }
  });

  // Test 4.2: Missing message
  await runner.runTest('Reject Missing Message', async () => {
    try {
      await sendWhatsAppMessage({
        recipients: TEST_PHONE_NUMBERS.NIGERIA_FORMATTED,
        subject: TEST_SUBJECTS.SHORT,
        message: '',
      });
      throw new Error('Should have thrown error for missing message');
    } catch (error: any) {
      if (!error.message.includes('message')) {
        throw new Error('Wrong error message: ' + error.message);
      }
      return { errorCaught: true };
    }
  });

  // Test 4.3: No recipients
  await runner.runTest('Reject No Recipients', async () => {
    try {
      await sendWhatsAppMessage({
        recipients: [] as any,
        subject: TEST_SUBJECTS.SHORT,
        message: TEST_MESSAGES.SHORT,
      });
      throw new Error('Should have thrown error for no recipients');
    } catch (error: any) {
      if (!error.message.includes('recipient')) {
        throw new Error('Wrong error message: ' + error.message);
      }
      return { errorCaught: true };
    }
  });
}

// ==============================================================================
// Master Test Runner
// =============================================================================

/**
 * Run all test suites
 *
 * @param options - Test options
 * @param options.testPhoneNumber - Optional phone number for actual message tests
 * @param options.skipMessageTests - Skip tests that send actual messages
 */
export async function runAllTests(options: {
  testPhoneNumber?: string;
  skipMessageTests?: boolean;
}) {
  console.log('\n🚀 Starting WhatsApp Service Tests\n');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Timestamp:', new Date().toISOString());

  const runner = new WhatsAppTestRunner();

  try {
    // Configuration tests
    await runConfigurationTests(runner);

    // Phone number formatting tests
    await runPhoneNumberTests(runner);

    // Error handling tests (no API calls)
    await runErrorHandlingTests(runner);

    // Message sending tests (actual API calls - skip by default)
    if (!options.skipMessageTests) {
      await runMessageSendingTests(runner, options.testPhoneNumber);
    } else {
      console.log('\n⚠️  Message sending tests skipped (skipMessageTests=true)');
    }

    // Print results
    runner.printResults();

    return runner.getSummary();

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    throw error;
  }
}

// ==============================================================================
// Quick Test Functions
// ==============================================================================

/**
 * Quick test: Check configuration only
 */
export function quickConfigCheck() {
  console.log('🔍 Quick Configuration Check\n');
  const config = checkWhatsAppServiceConfig();

  if (config.configured) {
    console.log('✅ Service is properly configured');
    console.log('   Username:', process.env.NEXT_PUBLIC_EWHATSAPP_USERNAME);
    console.log('   API Key: ***' + process.env.NEXT_PUBLIC_EWHATSAPP_API_KEY?.slice(-10));
  } else {
    console.log('❌ Service has configuration issues:');
    config.issues.forEach((issue) => console.log(`   - ${issue}`));
  }

  return config;
}

/**
 * Quick test: Send a test message
 */
export async function quickTestMessage(phoneNumber: string) {
  console.log('📱 Sending Test Message\n');
  console.log('To:', phoneNumber);
  console.log('Message:', TEST_MESSAGES.SHORT);

  const result = await sendWhatsAppMessage({
    recipients: phoneNumber,
    subject: 'Test Message',
    message: TEST_MESSAGES.SHORT,
  });

  console.log('\nResult:');
  if (result.success) {
    console.log('✅ Message sent successfully');
    console.log('   Message ID:', result.messageId);
    console.log('   Status:', result.status);
  } else {
    console.log('❌ Message failed');
    console.log('   Error:', result.message);
  }

  return result;
}

// ==============================================================================
// Export
// ==============================================================================

export default {
  WhatsAppTestRunner,
  runAllTests,
  runConfigurationTests,
  runPhoneNumberTests,
  runMessageSendingTests,
  runErrorHandlingTests,
  quickConfigCheck,
  quickTestMessage,
  TEST_PHONE_NUMBERS,
  TEST_MESSAGES,
  TEST_SUBJECTS,
};
