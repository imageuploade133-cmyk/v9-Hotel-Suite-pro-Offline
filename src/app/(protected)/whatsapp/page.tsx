
'use client';

import * as React from 'react';
import { MessageSquareText, Users, Hotel, ShoppingCart, Dumbbell, Send, Bot, Loader2, User, Phone, Mail, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Customer, UserProfile, GymMember, WhatsAppReminder } from '@/lib/types';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { WhatsAppHistory } from './history';
import { useSettings } from '@/contexts/settings-context';
import WhatsAppLoading from './loading';
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
import { StatCard } from '@/components/ui/stat-card';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { ManualRecipientInput } from '@/components/messaging/manual-recipient-input';

interface Recipient {
  id: string;
  name: string;
  phoneNumber?: string;
  group: 'Hotel Customers' | 'POS Customers' | 'Staff' | 'Gym Members' | 'Manual';
}

function WhatsAppPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = React.useState<Recipient[]>([]);
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [showConfirmation, setShowConfirmation] = React.useState(false);

  const { data: hotelCustomers, isLoading: hotelLoading } = useCollection<Customer>(React.useMemo(() => firestore ? query(collection(firestore, 'customers')) : null, [firestore]));
  const { data: posCustomers, isLoading: posLoading } = useCollection<Customer>(React.useMemo(() => firestore ? query(collection(firestore, 'posCustomers')) : null, [firestore]));
  const { data: staff, isLoading: staffLoading } = useCollection<UserProfile>(React.useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]));
  const { data: gymMembers, isLoading: gymLoading } = useCollection<GymMember>(React.useMemo(() => firestore ? query(collection(firestore, 'gym-members')) : null, [firestore]));

  const { data: whatsAppLogs, isLoading: logsLoading } = useCollection<any>(React.useMemo(() => firestore ? query(collection(firestore, 'whatsapp-logs')) : null, [firestore]));

  const isLoading = hotelLoading || posLoading || staffLoading || gymLoading || logsLoading;

  const recipientGroups = React.useMemo(() => [
    { name: 'Hotel Customers', data: hotelCustomers, icon: Hotel },
    { name: 'POS Customers', data: posCustomers, icon: ShoppingCart },
    { name: 'Staff', data: staff, icon: Users },
    { name: 'Gym Members', data: gymMembers, icon: Dumbbell },
  ], [hotelCustomers, posCustomers, staff, gymMembers]);

  const whatsAppStats = React.useMemo(() => {
    if (!whatsAppLogs) {
      return { totalSent: 0, uniqueRecipients: 0, totalFailed: 0 };
    }
    const successfulSends = whatsAppLogs.filter(log => log.status === 'success');
    const failedSends = whatsAppLogs.filter(log => log.status === 'error');
    const uniquePhones = new Set(successfulSends.map(log => log.recipientPhone));

    return {
        totalSent: successfulSends.length,
        uniqueRecipients: uniquePhones.size,
        totalFailed: failedSends.length
    }
  }, [whatsAppLogs]);


  const recipients: Recipient[] = React.useMemo(() => {
    const allRecipients: Recipient[] = [];
    const addedPhoneNumbers = new Set<string>();

    const addRecipient = (recipient: Recipient) => {
      if (recipient.phoneNumber && !addedPhoneNumbers.has(recipient.phoneNumber)) {
        allRecipients.push(recipient);
        addedPhoneNumbers.add(recipient.phoneNumber);
      }
    };

    selectedGroups.forEach(groupName => {
      const group = recipientGroups.find(g => g.name === groupName);
      if (group?.data) {
        group.data.forEach((item: any) => {
          addRecipient({
            id: item.id,
            name: item.name,
            phoneNumber: item.phoneNumber,
            group: group.name as Recipient['group'],
          });
        });
      }
    });

    manualRecipients.forEach(addRecipient);

    return allRecipients;
  }, [selectedGroups, manualRecipients, recipientGroups]);

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    setSelectedGroups(prev =>
      checked ? [...prev, groupName] : prev.filter(g => g !== groupName)
    );
  };

  const handleAddManualRecipients = (numbers: string[]) => {
    const newRecipients: Recipient[] = numbers.map((num, i) => ({
      id: `manual-${Date.now()}-${i}`,
      name: `Manual Entry`,
      phoneNumber: num,
      group: 'Manual',
    }));
    setManualRecipients(prev => [...prev, ...newRecipients]);
    toast({
      title: 'Recipients Added',
      description: `${newRecipients.length} manual numbers have been added to the recipient list.`
    })
  };

  const handleSend = async () => {
    setShowConfirmation(false);
    if (!message || recipients.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select recipients and write a message.' });
      return;
    }
    setIsSending(true);

    try {
      const phoneNumbers = recipients.map(r => r.phoneNumber!).filter(Boolean);

      const result = await sendWhatsAppMessage({
        phone: phoneNumbers,
        message: message,
        senderName: settings?.businessName || 'Your Business',
        greeting: 'Bulk Message'
      });

      if (result.status === 'success') {
          toast({ variant: 'success', title: 'Messages Sent', description: `Your message is being sent to ${recipients.length} recipient(s).` });
          setMessage('');
      } else {
          throw new Error(result.message || 'Failed to send messages.');
      }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to Send', description: error.message });
    } finally {
        setIsSending(false);
    }
  };

  if (isLoading) {
    return <WhatsAppLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <MessageSquareText className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Bulk WhatsApp Messaging</h1>
            <p className="text-muted-foreground">Send messages to selected groups of users.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
                title="Total Messages Sent"
                value={whatsAppStats.totalSent.toLocaleString()}
                icon={TrendingUp}
                description="Total successful messages sent all time."
            />
             <StatCard
                title="Unique Recipients"
                value={whatsAppStats.uniqueRecipients.toLocaleString()}
                icon={Users}
                description="Unique phone numbers reached."
            />
             <StatCard
                title="Total Failed Messages"
                value={whatsAppStats.totalFailed.toLocaleString()}
                icon={TrendingDown}
                description="Messages that failed to send."
                className={whatsAppStats.totalFailed > 0 ? "border-destructive text-destructive" : ""}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Recipient Groups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recipientGroups.map(group => {
                  const count = group.data?.filter(item => !!item.phoneNumber).length || 0;
                  return (
                    <div key={group.name} className="flex items-center space-x-3">
                      <Checkbox
                        id={group.name}
                        checked={selectedGroups.includes(group.name)}
                        onCheckedChange={(checked) => handleGroupToggle(group.name, !!checked)}
                        disabled={count === 0}
                      />
                      <Label htmlFor={group.name} className="flex items-center gap-2 font-medium cursor-pointer">
                        <group.icon className="h-5 w-5 text-muted-foreground" />
                        {group.name}
                        <Badge variant="secondary">{count}</Badge>
                      </Label>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <ManualRecipientInput onAdd={handleAddManualRecipients} />

            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
                <CardDescription>{recipients.length} unique recipient(s) selected.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-4 space-y-2">
                    {recipients.length > 0 ? recipients.map(r => (
                      <div key={r.id} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{r.name}</span>
                        <Badge variant="outline">{r.group}</Badge>
                      </div>
                    )) : <p className="text-center text-muted-foreground pt-10">Select a group or add numbers manually.</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
             <Card>
                <CardHeader>
                    <CardTitle>Compose Message</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="Type your WhatsApp message here..."
                        rows={10}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    />
                </CardContent>
                <CardFooter>
                    <Button onClick={() => setShowConfirmation(true)} disabled={!message || recipients.length === 0 || isSending}>
                       <Send className="mr-2 h-4 w-4" />
                       Send Message
                    </Button>
                </CardFooter>
            </Card>

            <WhatsAppHistory />
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Message</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send a WhatsApp message to <span className="font-bold">{recipients.length}</span> recipient(s). Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <Button onClick={handleSend} loading={isSending}>
                {isSending ? 'Sending...' : 'Yes, Send Message'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withAuth(WhatsAppPage, PagePermission.MANAGE_WHATSAPP_MESSAGING);
