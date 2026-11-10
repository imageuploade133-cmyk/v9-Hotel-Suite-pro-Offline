
'use client';

import * as React from 'react';
import { MessageSquareText, Users, Hotel, ShoppingCart, Dumbbell, Send, TrendingUp, TrendingDown } from 'lucide-react';
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
import { sendWhatsAppMessage, formatPhoneNumber } from '@/lib/whatsapp';
import { Input } from '@/components/ui/input';
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
  const [manualRecipients, setManualRecipients] = React.useState<Recipient[]>([]);
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = React.useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = React.useState('');
  const [sendProgress, setSendProgress] = React.useState({ completed: 0, total: 0 });

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


  const allRecipients: Recipient[] = React.useMemo(() => {
    const unique = new Map<string, Recipient>();
    const add = (item: any, group: Recipient['group'], idPrefix: string) => {
      const rawPhone = String(item?.phoneNumber || '').trim();
      if (!rawPhone) return;
      let phoneNumber: string;
      try { phoneNumber = formatPhoneNumber(rawPhone); } catch { return; }
      if (!unique.has(phoneNumber)) {
        unique.set(phoneNumber, { id: `${idPrefix}-${String(item?.id || phoneNumber)}`, name: String(item?.name || item?.fullName || 'Contact').trim() || 'Contact', phoneNumber, group });
      }
    };
    recipientGroups.forEach(group => (group.data || []).forEach((item: any) => add(item, group.name as Recipient['group'], group.name)));
    manualRecipients.forEach(item => add(item, 'Manual', 'manual'));
    return Array.from(unique.values());
  }, [recipientGroups, manualRecipients]);

  const recipients = React.useMemo(() => allRecipients.filter(item => selectedRecipientIds.includes(item.id)), [allRecipients, selectedRecipientIds]);
  const visibleRecipients = React.useMemo(() => {
    const term = recipientSearch.trim().toLowerCase();
    return term ? allRecipients.filter(item => item.name.toLowerCase().includes(term) || (item.phoneNumber || '').includes(term) || item.group.toLowerCase().includes(term)) : allRecipients;
  }, [allRecipients, recipientSearch]);

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    const groupIds = allRecipients.filter(item => item.group === groupName).map(item => item.id);
    setSelectedRecipientIds(prev => checked ? [...new Set([...prev, ...groupIds])] : prev.filter(id => !groupIds.includes(id)));
  };
  const handleRecipientToggle = (recipientId: string, checked: boolean) => {
    setSelectedRecipientIds(prev => checked ? [...new Set([...prev, recipientId])] : prev.filter(id => id !== recipientId));
  };

  const handleAddManualRecipients = (numbers: string[]) => {
    const existing = new Set(allRecipients.map(item => item.phoneNumber));
    const additions: Recipient[] = [];
    let invalid = 0; let duplicate = 0;
    numbers.forEach(raw => {
      try {
        const phoneNumber = formatPhoneNumber(raw);
        if (existing.has(phoneNumber)) { duplicate += 1; return; }
        existing.add(phoneNumber);
        additions.push({ id: `manual-${phoneNumber}`, name: 'Manual recipient', phoneNumber, group: 'Manual' });
      } catch { invalid += 1; }
    });
    if (!additions.length) {
      toast({ variant: 'destructive', title: 'No new valid numbers', description: invalid ? 'Check the numbers and include a country code, for example +2348012345678.' : 'All entered numbers are already in the recipient list.' });
      return;
    }
    setManualRecipients(prev => [...prev, ...additions]);
    setSelectedRecipientIds(prev => [...new Set([...prev, ...additions.map(item => item.id)])]);
    toast({ title: 'Manual recipients added', description: `${additions.length} valid number(s) added and selected.${duplicate ? ` ${duplicate} duplicate(s) skipped.` : ''}${invalid ? ` ${invalid} invalid number(s) skipped.` : ''}` });
  };

  const handleSend = async () => {
    setShowConfirmation(false);
    const messageText = message.trim();
    if (!messageText || recipients.length === 0) { toast({ variant: 'destructive', title: 'Cannot send message', description: 'Select at least one valid recipient and enter a message.' }); return; }
    if (messageText.length > 1000) { toast({ variant: 'destructive', title: 'Message is too long', description: 'The WhatsApp provider accepts up to 1,000 characters per message.' }); return; }
    setIsSending(true); setSendProgress({ completed: 0, total: recipients.length });
    let successCount = 0; let failedCount = 0;
    const numbers = recipients.map(item => item.phoneNumber!).filter(Boolean);
    try {
      for (let index = 0; index < numbers.length; index += 100) {
        const chunk = numbers.slice(index, index + 100);
        const result = await sendWhatsAppMessage({ recipients: chunk, subject: `Bulk Message from ${settings?.businessName || 'Hotel Suite Pro'}`.slice(0, 100), message: messageText });
        successCount += result.acceptedRecipients ?? (result.success ? chunk.length : 0);
        failedCount += result.failedRecipients ?? (result.success ? 0 : chunk.length);
        setSendProgress({ completed: Math.min(successCount + failedCount, numbers.length), total: numbers.length });
      }
      if (failedCount === 0) { toast({ title: 'Messages submitted', description: `The existing WhatsApp provider accepted the message for all ${successCount} recipient(s).` }); setMessage(''); }
      else toast({ variant: 'destructive', title: 'Bulk send completed with failures', description: `${successCount} accepted; ${failedCount} failed. Check the provider response and retry failed recipients.` });
    } catch (error: any) { toast({ variant: 'destructive', title: 'Bulk send failed', description: error?.message || 'The WhatsApp provider could not process this campaign.' }); }
    finally { setIsSending(false); }
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
            <p className="text-muted-foreground">Choose saved contacts individually or by group, add manual phone numbers, and send through your existing WhatsApp provider.</p>
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
                  const count = allRecipients.filter(item => item.group === group.name).length;
                  return (
                    <div key={group.name} className="flex items-center space-x-3">
                      <Checkbox id={group.name} checked={count > 0 && allRecipients.filter(item => item.group === group.name).every(item => selectedRecipientIds.includes(item.id))} onCheckedChange={checked => handleGroupToggle(group.name, !!checked)} disabled={count === 0} />
                      <Label htmlFor={group.name} className="flex items-center gap-2 font-medium cursor-pointer">
                        <group.icon className="h-5 w-5 text-muted-foreground" />{group.name}<Badge variant="secondary">{count}</Badge>
                      </Label>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <ManualRecipientInput onAdd={handleAddManualRecipients} />

            <Card>
              <CardHeader>
                <CardTitle>Select Individual Recipients</CardTitle>
                <CardDescription>{recipients.length} of {allRecipients.length} valid contact(s) selected.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={recipientSearch} onChange={event => setRecipientSearch(event.target.value)} placeholder="Search by name, phone number or group..." aria-label="Search recipients" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRecipientIds(prev => [...new Set([...prev, ...visibleRecipients.map(item => item.id)])])} disabled={!visibleRecipients.length}>Select visible</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedRecipientIds([])} disabled={!recipients.length}>Clear selection</Button>
                </div>
                <ScrollArea className="h-72 rounded-md border">
                  <div className="space-y-1 p-3">
                    {visibleRecipients.length ? visibleRecipients.map(recipient => (
                      <label key={recipient.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                        <Checkbox checked={selectedRecipientIds.includes(recipient.id)} onCheckedChange={checked => handleRecipientToggle(recipient.id, !!checked)} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{recipient.name}</span><span className="block text-xs text-muted-foreground">{recipient.phoneNumber}</span></span>
                        <Badge variant="outline">{recipient.group}</Badge>
                      </label>
                    )) : <p className="p-6 text-center text-sm text-muted-foreground">No matching phone numbers found.</p>}
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
              You are about to send a WhatsApp message to <span className="font-bold">{recipients.length}</span> unique recipient(s). Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <Button onClick={handleSend} loading={isSending}>
                {isSending ? `Sending ${sendProgress.completed}/${sendProgress.total}...` : 'Yes, Send Message'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withAuth(WhatsAppPage, PagePermission.MANAGE_WHATSAPP_MESSAGING);
