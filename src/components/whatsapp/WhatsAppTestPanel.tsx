/**
 * WhatsApp Test Panel Component
 *
 * A simple React component for testing the WhatsApp messaging service
 * from the UI. Useful for development and testing.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Send, CheckCircle, XCircle, Loader2, Settings } from 'lucide-react';
import {
  sendWhatsAppMessage,
  formatPhoneNumber,
  checkWhatsAppServiceConfig,
} from '@/lib/whatsapp';
import type { WhatsAppSendResult } from '@/lib/whatsapp';

interface SendResult {
  success: boolean;
  message: string;
  timestamp: Date;
}

export function WhatsAppTestPanel() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [formattedPhone, setFormattedPhone] = useState('');

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    try {
      const formatted = formatPhoneNumber(value);
      setFormattedPhone(formatted);
    } catch {
      setFormattedPhone('');
    }
  };

  const handleSendMessage = async () => {
    if (!phoneNumber || !subject || !message) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);

    try {
      const result: WhatsAppSendResult = await sendWhatsAppMessage({
        recipients: phoneNumber,
        subject,
        message,
      });

      const sendResult: SendResult = {
        success: result.success,
        message: result.message,
        timestamp: new Date(),
      };

      setResults([sendResult, ...results]);

      toast({
        title: result.success ? 'Success' : 'Error',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });

      // Clear form on success
      if (result.success) {
        setSubject('');
        setMessage('');
      }
    } catch (error: any) {
      const sendResult: SendResult = {
        success: false,
        message: error.message || 'Unknown error',
        timestamp: new Date(),
      };
      setResults([sendResult, ...results]);

      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleTestConfig = () => {
    const config = checkWhatsAppServiceConfig();

    if (config.configured) {
      toast({
        title: 'Configuration Check',
        description: '✅ WhatsApp service is properly configured',
      });
    } else {
      toast({
        title: 'Configuration Issues',
        description: config.issues.join(', '),
        variant: 'destructive',
      });
    }
  };

  const handleClearResults = () => {
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>WhatsApp Test Panel</CardTitle>
              <CardDescription>
                Test the WhatsApp messaging service directly from here
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleTestConfig}>
              <Settings className="h-4 w-4 mr-2" />
              Check Config
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="08012345678 or +2348012345678"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
            />
            {formattedPhone && (
              <p className="text-sm text-muted-foreground">
                Formatted: {formattedPhone}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {subject.length}/100 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/1000 characters
            </p>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={sending || !phoneNumber || !subject || !message}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Send History</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClearResults}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        result.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {result.success ? 'Success' : 'Failed'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {result.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Templates</CardTitle>
          <CardDescription>
            Use pre-configured message templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setSubject('Test Message');
              setMessage('This is a test message from Hotel Suite Pro.');
            }}
          >
            Test Message
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setSubject('Booking Confirmation');
              setMessage(
                `Dear Guest,\n\nYour booking has been confirmed!\n\n📋 Booking Details:\n• Booking ID: TEST-001\n• Check-in: 2025-02-15\n• Check-out: 2025-02-18\n• Room Number: 101\n\nWe look forward to welcoming you!\n\nThank you for choosing our hotel! 🏨`
              );
            }}
          >
            Booking Confirmation
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setSubject('Welcome - Check-in Complete');
              setMessage(
                `Dear Guest,\n\n🎉 Welcome! You have successfully checked in.\n\n📍 Room: 101\n\nWiFi credentials and room information are available at the front desk.\nWe hope you enjoy your stay!\n\nNeed assistance? Just message us anytime. 🛎️`
              );
            }}
          >
            Check-in Welcome
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setSubject('Payment Confirmation');
              setMessage(
                `Dear Guest,\n\n💳 Payment Received Successfully!\n\nAmount: ₦45,000.00\nMethod: Credit Card\n\nYour payment has been processed and your booking is confirmed.\nThank you for your payment! ✅`
              );
            }}
          >
            Payment Confirmation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default WhatsAppTestPanel;
