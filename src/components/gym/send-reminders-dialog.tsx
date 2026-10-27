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
import { useToast } from '@/hooks/use-toast';
import type { GymMember } from '@/lib/types';
import { MessageSquareText, Copy, Loader2, Phone } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';

interface SendRemindersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  members: GymMember[];
  onSendReminder: (member: GymMember, copyTo?: string) => void;
}

const createReminderMessage = (memberName: string, expiryDate: Date, businessName: string, template?: string) => {
    const defaultTemplate = `Hi {{MEMBER_NAME}},\n\nThis is a friendly reminder from {{BUSINESS_NAME}} that your gym membership is set to expire on {{EXPIRY_DATE}}. We'd love for you to continue your fitness journey with us!\n\nPlease visit the front desk to renew your membership at your earliest convenience.\n\nThank you,\n{{BUSINESS_NAME}} Team`;

    const messageTemplate = template || defaultTemplate;

    return messageTemplate
        .replace(/{{MEMBER_NAME}}/g, memberName)
        .replace(/{{EXPIRY_DATE}}/g, format(expiryDate, 'EEEE, PPP'))
        .replace(/{{BUSINESS_NAME}}/g, businessName);
};

function MemberReminderCard({ member, onSend }: { member: GymMember, onSend: (member: GymMember) => void }) {

    const { settings } = useSettings();
    const businessName = settings?.businessName || 'our gym';

    const expiryDate = getSafeDate(member.expiresAt);
    if (!expiryDate) return null;

    const message = createReminderMessage(member.name, expiryDate, businessName, settings?.gymReminderMessage);

    const handleSendClick = async () => {
        onSend(member);
    }

    return (
        <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                     <Avatar className="h-10 w-10">
                        <AvatarImage src={member.photoURL} alt={member.name} />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.phoneNumber || 'No phone number'}</p>
                    </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleSendClick} disabled={!member.phoneNumber}>
                    <MessageSquareText className="mr-2 h-4 w-4" /> Send
                </Button>
            </div>
            <Separator />
            <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{message}</p>
        </div>
    )
}

export function SendRemindersDialog({ isOpen, onClose, members, onSendReminder }: SendRemindersDialogProps) {
  const [isSendingAll, setIsSendingAll] = React.useState(false);
  const [isConfirmingSendAll, setIsConfirmingSendAll] = React.useState(false);
  const [copyToPhoneNumber, setCopyToPhoneNumber] = React.useState('');
  const { toast } = useToast();
  const { settings } = useSettings();

  const membersWithPhone = members.filter(m => !!m.phoneNumber);

  const handleSendAll = async () => {
    setIsConfirmingSendAll(false);

    if (membersWithPhone.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Members to Message',
        description: 'None of the members in this list have a phone number.',
      });
      return;
    }

    setIsSendingAll(true);

    for (const member of membersWithPhone) {
      onSendReminder(member, copyToPhoneNumber);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({
      variant: 'success',
      title: 'Bulk Reminders Triggered',
      description: `Initiated sending reminders to ${membersWithPhone.length} member(s). Please confirm each message.`,
    });

    setIsSendingAll(false);
    onClose();
  };

  const getButtonStyle = (color?: string) => {
    if (!color) {
        return {
            backgroundImage: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary) / 0.8))',
        };
    }
    if (color.startsWith('linear-gradient')) {
      return { backgroundImage: color };
    }
    return { backgroundColor: color };
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareText />
              Send Renewal Reminders
            </DialogTitle>
            <DialogDescription>
              Click "Send" to trigger a confirmation for each member's message.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
              <div className="space-y-4">
              {members.length > 0 ? (
                  members.map(member => (
                      <MemberReminderCard key={member.id} member={member} onSend={onSendReminder} />
                  ))
              ) : (
                  <p className="text-center text-muted-foreground py-10">No members to remind in this category.</p>
              )}
              </div>
          </ScrollArea>
          <DialogFooter className="sm:justify-between">
              <Button onClick={() => setIsConfirmingSendAll(true)} disabled={isSendingAll || membersWithPhone.length === 0} style={getButtonStyle(settings?.menuButtonColor)}>
                  {isSendingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send All Reminders
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={isSendingAll}>
                  Close
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmingSendAll} onOpenChange={setIsConfirmingSendAll}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Bulk Send</AlertDialogTitle>
                <AlertDialogDescription>
                    You are about to trigger reminder messages for <span className="font-bold">{membersWithPhone.length}</span> member(s). Are you sure you want to continue?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
                <Label htmlFor="bulk-copy-phone">Send copies to (optional):</Label>
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="bulk-copy-phone"
                        placeholder="Enter phone number"
                        value={copyToPhoneNumber}
                        onChange={(e) => setCopyToPhoneNumber(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendAll}>Confirm & Send All</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
