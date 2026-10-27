
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/lib/types';
import { MessageSquareText } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

interface BulkMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Customer[];
}

export function BulkMessageDialog({ isOpen, onClose, recipients }: BulkMessageDialogProps) {
  const [isSending, setIsSending] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const { toast } = useToast();
  const { settings } = useSettings();

  const validRecipients = React.useMemo(() => {
    return recipients.filter(r => r.phoneNumber);
  }, [recipients]);

  const handleSendMessage = async () => {
    if (validRecipients.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Valid Recipients',
        description: 'None of the selected customers have a phone number.',
      });
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;

    for (const recipient of validRecipients) {
      try {
        const personalizedMessage = message.replace(/\{name\}/g, recipient.name);
        const fullMessage = `Hello ${recipient.name},\n\n${personalizedMessage}\n\n${settings.whatsAppFooter || 'Thank you.'}`;

        const result = await sendWhatsAppMessage({
          recipients: recipient.phoneNumber!,
          subject: `Message from ${settings.businessName || 'Hotel Suite Pro'}`,
          message: fullMessage,
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setIsSending(false);

    toast({
        title: 'Bulk Messaging Complete',
        description: `${successCount} message(s) sent successfully. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Bulk WhatsApp Message</DialogTitle>
          <DialogDescription>
            Compose a message to send to the selected {recipients.length} customer(s).
            Only the {validRecipients.length} customers with phone numbers will receive it.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Recipients:</Label>
            <ScrollArea className="h-24 rounded-md border p-2">
              <div className="flex flex-wrap gap-2">
                {recipients.map(r => (
                  <Badge key={r.id} variant={r.phoneNumber ? 'default' : 'secondary'}>
                    {r.name}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="bulk-message">Message</Label>
            <Textarea
              id="bulk-message"
              placeholder="Type your message here. Use {name} to personalize for each customer."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">
              Example: `Hello {`{name}`}, we have a special offer for you!`
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSending}>Cancel</Button>
          <Button onClick={handleSendMessage} loading={isSending} disabled={!message.trim() || validRecipients.length === 0}>
            <MessageSquareText className="mr-2 h-4 w-4" />
            Send to {validRecipients.length} customer(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
