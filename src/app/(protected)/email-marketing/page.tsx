'use client';

import * as React from 'react';
import { addDoc, collection, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { Mail, Users, UserRound, Plus, Search, Send, Loader2, CheckCircle2, AlertCircle, FileUp } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/branch-context';
import type { Customer, UserProfile, Booking } from '@/lib/types';
import { TopHeader } from '@/components/top-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type MarketingContact = {
  id: string;
  email: string;
  name: string;
  source: 'Staff' | 'Hotel Customer' | 'POS Customer' | 'Guest' | 'Manual';
  marketingOptIn?: boolean;
};

type ContactDoc = {
  email: string;
  name: string;
  source: 'Manual' | 'Import';
  createdAt?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseContactFile(text: string): Array<{ email: string; name: string }> {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const found = new Map<string, { email: string; name: string }>();
  for (const line of lines) {
    // Accept plain-text email lists and CSV columns in either email,name or name,email order.
    const cells = line.match(/("(?:[^"]|"")*"|[^,;\t]+)/g)?.map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')) || [line.trim()];
    const emails = Array.from(
      line.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
      match => normalizeEmail(match[0])
    ).filter(email => EMAIL_RE.test(email));
    if (!emails.length) continue;
    const name = (cells.find(cell =>
      cell.trim() &&
      !EMAIL_RE.test(normalizeEmail(cell)) &&
      !/^(email|e-mail|name|full name)$/i.test(cell.trim())
    ) || '').trim();
    emails.forEach(email => {
      if (!found.has(email)) found.set(email, { email, name });
    });
  }
  return Array.from(found.values());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function renderTemplate(template: string, contact: MarketingContact, businessName: string, message: string): string {
  return template
    .replace(/\{\{\s*name\s*\}\}|\{name\}/gi, contact.name || 'there')
    .replace(/\{\{\s*email\s*\}\}|\{email\}/gi, contact.email)
    .replace(/\{\{\s*businessName\s*\}\}|\{businessName\}/gi, businessName)
    .replace(/\{\{\s*message\s*\}\}|\{message\}/gi, message)
    .replace(/\{\{\s*date\s*\}\}|\{date\}/gi, new Date().toLocaleDateString());
}

function EmailMarketingPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { getCollectionPath } = useBranch();
  const [search, setSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState('All');
  const [selectedEmails, setSelectedEmails] = React.useState<string[]>([]);
  const [manualEmail, setManualEmail] = React.useState('');
  const [manualName, setManualName] = React.useState('');
  const [subjectTemplate, setSubjectTemplate] = React.useState('{{businessName}} - Special update for you');
  const [messageTemplate, setMessageTemplate] = React.useState('Hello {{name}},\n\n{{message}}\n\nThank you,\n{{businessName}}');
  const [campaignMessage, setCampaignMessage] = React.useState('We have an update to share with you.');
  const [isSending, setIsSending] = React.useState(false);
  const [confirmMarketingConsent, setConfirmMarketingConsent] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, sent: 0, failed: 0 });
  const [sendResults, setSendResults] = React.useState<Array<{ email: string; status: 'sent' | 'failed'; error?: string }>>([]);
  const importRef = React.useRef<HTMLInputElement>(null);

  const customersQuery = React.useMemo(() => firestore ? collection(firestore, 'customers') : null, [firestore]);
  const posCustomersQuery = React.useMemo(() => firestore ? collection(firestore, 'posCustomers') : null, [firestore]);
  const staffQuery = React.useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const bookingsQuery = React.useMemo(() => firestore ? collection(firestore, getCollectionPath('bookings')) : null, [firestore, getCollectionPath]);
  const manualQuery = React.useMemo(() => firestore ? collection(firestore, 'email-marketing-contacts') : null, [firestore]);

  const { data: customers, isLoading: customersLoading } = useCollection<Customer>(customersQuery);
  const { data: posCustomers, isLoading: posLoading } = useCollection<Customer>(posCustomersQuery);
  const { data: staff, isLoading: staffLoading } = useCollection<UserProfile>(staffQuery);
  const { data: bookings, isLoading: bookingsLoading } = useCollection<Booking>(bookingsQuery);
  const { data: manualContacts, isLoading: manualLoading } = useCollection<ContactDoc>(manualQuery);
  const isLoading = customersLoading || posLoading || staffLoading || bookingsLoading || manualLoading;

  const contacts = React.useMemo(() => {
    const map = new Map<string, MarketingContact>();
    const add = (emailValue: unknown, nameValue: unknown, source: MarketingContact['source'], id: string, optIn?: boolean) => {
      const email = normalizeEmail(emailValue);
      if (!EMAIL_RE.test(email)) return;
      const existing = map.get(email);
      if (existing) {
        if (!existing.name && typeof nameValue === 'string') existing.name = nameValue;
        if (existing.source === 'Guest' && source !== 'Guest') existing.source = source;
        return;
      }
      map.set(email, { id, email, name: typeof nameValue === 'string' ? nameValue.trim() : '', source, marketingOptIn: optIn });
    };
    (staff || []).forEach(item => add(item.email, item.name, 'Staff', item.id || item.uid));
    (customers || []).forEach(item => add(item.email, item.name, 'Hotel Customer', item.id));
    (posCustomers || []).forEach(item => add(item.email, item.name, 'POS Customer', item.id));
    (bookings || []).forEach(item => add(item.guestEmail, item.guestName, 'Guest', item.id));
    (manualContacts || []).forEach(item => add(item.email, item.name, item.source === 'Import' ? 'Manual' : 'Manual', item.email));
    return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [staff, customers, posCustomers, bookings, manualContacts]);

  const filteredContacts = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter(contact =>
      (sourceFilter === 'All' || contact.source === sourceFilter) &&
      (!term || contact.email.includes(term) || contact.name.toLowerCase().includes(term))
    );
  }, [contacts, search, sourceFilter]);

  const selectedContacts = React.useMemo(() => contacts.filter(contact => selectedEmails.includes(contact.email)), [contacts, selectedEmails]);
  const emailConfig = (settings as any)?.emailChannel || {};
  const emailEnabled = emailConfig.enabled === true;
  const businessName = String(emailConfig.senderName || settings?.businessName || 'Hotel').trim();
  const logoUrl = typeof emailConfig.logoDataUrl === 'string' && /^https:\/\/i\.ibb\.co\//i.test(emailConfig.logoDataUrl) ? emailConfig.logoDataUrl : '';
  const baseUrl = String(emailConfig.baseUrl || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  const apiKey = String(emailConfig.apiKey || '').trim();

  const toggleContact = (email: string, checked: boolean) => {
    setSelectedEmails(prev => checked ? [...new Set([...prev, email])] : prev.filter(value => value !== email));
  };

  const addManualContact = async (emailValue: string, name: string, source: 'Manual' | 'Import' = 'Manual') => {
    const email = normalizeEmail(emailValue);
    if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
    if (!firestore) throw new Error('Database is not ready. Please try again.');
    const id = encodeURIComponent(email);
    await setDoc(doc(firestore, 'email-marketing-contacts', id), {
      email,
      name: name.trim(),
      source,
      createdAt: serverTimestamp(),
    }, { merge: true });
    return email;
  };

  const handleAddManual = async () => {
    const email = normalizeEmail(manualEmail);
    if (!EMAIL_RE.test(email)) {
      toast({ variant: 'destructive', title: 'Invalid email address', description: 'Enter a valid email address before adding the contact.' });
      return;
    }
    setIsAdding(true);
    try {
      await addManualContact(email, manualName);
      setSelectedEmails(prev => [...new Set([...prev, email])]);
      setManualEmail('');
      setManualName('');
      toast({ title: 'Contact added', description: 'The email contact has been saved and selected.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not add contact', description: error?.message || 'Please try again.' });
    } finally { setIsAdding(false); }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Upload a CSV or TXT contact list up to 5 MB.' });
      return;
    }
    setIsImporting(true);
    try {
      const parsed = parseContactFile(await file.text());
      if (!parsed.length) throw new Error('No valid email addresses were found. Use CSV or TXT with an email column.');
      if (!firestore) throw new Error('Database is not ready. Please try again.');
      const existing = new Set(contacts.map(item => item.email));
      const imported = parsed.map(item => item.email);
      // Firestore batches are limited to 500 writes; use 400 per batch to
      // leave headroom and avoid one network round-trip per imported address.
      for (let index = 0; index < parsed.length; index += 400) {
        const batch = writeBatch(firestore);
        parsed.slice(index, index + 400).forEach(item => {
          const contactRef = doc(firestore, 'email-marketing-contacts', encodeURIComponent(item.email));
          batch.set(contactRef, {
            email: item.email,
            name: item.name,
            source: 'Import',
            createdAt: serverTimestamp(),
          }, { merge: true });
        });
        await batch.commit();
      }
      setSelectedEmails(prev => [...new Set([...prev, ...imported])]);
      toast({ title: 'Contacts imported', description: `${imported.length} valid contact(s) saved and selected. ${parsed.filter(item => existing.has(item.email)).length} were already in your contacts and updated.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Import failed', description: error?.message || 'Could not import this contact file.' });
    } finally {
      setIsImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const handleSendCampaign = async () => {
    if (!emailEnabled || !baseUrl || !apiKey) {
      toast({ variant: 'destructive', title: 'Email integration is not ready', description: 'Enable Email Integration and save its API Base URL and API Key in Settings first.' });
      return;
    }
    if (!confirmMarketingConsent) {
      toast({ variant: 'destructive', title: 'Confirm recipient permission', description: 'Confirm that the selected contacts have agreed to receive these marketing emails.' });
      return;
    }
    if (!selectedContacts.length) {
      toast({ variant: 'destructive', title: 'No recipients selected', description: 'Select at least one email contact.' });
      return;
    }
    if (!subjectTemplate.trim() || !messageTemplate.trim() || !campaignMessage.trim()) {
      toast({ variant: 'destructive', title: 'Complete the campaign', description: 'A subject, message template and campaign message are required.' });
      return;
    }
    const confirmed = window.confirm(`Send this email campaign to ${selectedContacts.length} selected contact(s)?`);
    if (!confirmed) return;

    setIsSending(true);
    setSendResults([]);
    setProgress({ done: 0, total: selectedContacts.length, sent: 0, failed: 0 });
    const results: Array<{ email: string; status: 'sent' | 'failed'; error?: string }> = [];
    let sent = 0;
    let failed = 0;
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(String(emailConfig.topBannerColor || '')) ? emailConfig.topBannerColor : '#0f766e';
    const banner = String(emailConfig.topBannerText || businessName);

    try {
      // Send one recipient per request: avoids exposing the contact list to other recipients.
      // Requests are sequential to limit gateway load and make partial failures recoverable.
      for (const [index, contact] of selectedContacts.entries()) {
        const renderedSubject = renderTemplate(subjectTemplate, contact, businessName, campaignMessage).trim().slice(0, 180);
        const renderedText = renderTemplate(messageTemplate, contact, businessName, campaignMessage);
        const logoMarkup = logoUrl ? '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(businessName) + '" width="180" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto 18px;border:0" />' : '';
        const html = '<!doctype html><html><body style="margin:0;padding:24px 10px;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#fff;border-collapse:collapse"><tr><td style="background:' + safeColor + ';padding:13px 20px;text-align:center;color:#fff;font-size:13px;font-weight:bold">' + escapeHtml(banner) + '</td></tr><tr><td style="padding:28px 30px 12px;text-align:center">' + logoMarkup + '<h2 style="margin:0;font-size:22px;color:#0f172a">' + escapeHtml(businessName) + '</h2></td></tr><tr><td style="padding:18px 30px 28px;font-size:15px;line-height:1.7;white-space:pre-wrap">' + escapeHtml(renderedText) + '</td></tr><tr><td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:18px 24px;text-align:center;color:#64748b;font-size:12px">' + escapeHtml(String(emailConfig.footerText || 'Thank you for choosing us.')) + '</td></tr></table></body></html>';
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 30000);
          let response: Response;
          try {
            response = await fetch(baseUrl + '/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
              body: JSON.stringify({ to: contact.email, subject: renderedSubject, html, text: renderedText, fromName: businessName, attachments: [] }),
              signal: controller.signal,
            });
          } finally {
            window.clearTimeout(timeoutId);
          }
          const raw = await response.text();
          let payload: any = {};
          try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) }; }
          if (!response.ok || payload.success !== true || payload.error || !payload.messageId) {
            throw new Error(payload.message || payload.error || `Gateway rejected this email (HTTP ${response.status}).`);
          }
          sent += 1;
          results.push({ email: contact.email, status: 'sent' });
        } catch (error: any) {
          failed += 1;
          results.push({ email: contact.email, status: 'failed', error: error?.message || 'Send failed' });
        }
        setProgress({ done: index + 1, total: selectedContacts.length, sent, failed });
        setSendResults([...results]);
      }

      if (firestore) {
        try {
          await addDoc(collection(firestore, 'email-marketing-campaigns'), {
            subject: subjectTemplate,
            recipientCount: selectedContacts.length,
            sentCount: sent,
            failedCount: failed,
            results,
            createdAt: serverTimestamp(),
            createdBy: 'Email Marketing',
          });
        } catch (error) {
          console.warn('Campaign summary could not be saved:', error);
        }
      }

      toast({
        title: failed ? 'Campaign completed with some failures' : 'Campaign submitted',
        description: `${sent} email(s) accepted by the gateway; ${failed} failed. Gateway acceptance is not proof of final inbox delivery.`,
        variant: failed ? 'destructive' : 'default',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <TopHeader name="Email Marketing" icon={<Mail className="h-9 w-9" />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-5"><Users className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">All contacts</p><p className="text-2xl font-bold">{contacts.length.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><UserRound className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Staff emails</p><p className="text-2xl font-bold">{contacts.filter(item => item.source === 'Staff').length.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><Mail className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Customer & guest emails</p><p className="text-2xl font-bold">{contacts.filter(item => item.source !== 'Staff' && item.source !== 'Manual').length.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><CheckCircle2 className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Selected recipients</p><p className="text-2xl font-bold">{selectedEmails.length.toLocaleString()}</p></div></CardContent></Card>
      </div>

      {!emailEnabled && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Email Integration is currently disabled. Enable and configure it in Settings before sending a campaign.</div>}

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Card>
            <CardHeader><CardTitle>Contact Directory</CardTitle><CardDescription>Staff, hotel customers, POS customers, booking guests and your saved manual contacts. Duplicate email addresses are combined automatically.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or email..." /></div>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option>All</option><option>Staff</option><option>Hotel Customer</option><option>POS Customer</option><option>Guest</option><option>Manual</option></select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEmails(prev => [...new Set([...prev, ...filteredContacts.map(item => item.email)])])} disabled={!filteredContacts.length}>Select filtered ({filteredContacts.length})</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEmails([])} disabled={!selectedEmails.length}>Clear selection</Button>
                <Badge variant="secondary">{selectedEmails.length} selected</Badge>
              </div>
              <ScrollArea className="h-[360px] rounded-md border">
                {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading contacts...</div> : filteredContacts.length ? <div className="divide-y">
                  {filteredContacts.map(contact => <label key={contact.email} className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted/50">
                    <Checkbox checked={selectedEmails.includes(contact.email)} onCheckedChange={checked => toggleContact(contact.email, !!checked)} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{contact.name || 'Unnamed contact'}</span><span className="block truncate text-xs text-muted-foreground">{contact.email}</span></span>
                    <Badge variant="outline">{contact.source}</Badge>
                  </label>)}
                </div> : <div className="p-8 text-center text-sm text-muted-foreground">No matching email contacts found.</div>}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Manage manual contacts</CardTitle><CardDescription>Add an individual address or upload a CSV/TXT list. Imported contacts are saved in the hotel's Firestore database.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="marketing-contact-name">Contact name (optional)</Label><Input id="marketing-contact-name" value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Customer name" /></div>
                <div className="space-y-2"><Label htmlFor="marketing-contact-email">Email address</Label><Input id="marketing-contact-email" type="email" value={manualEmail} onChange={event => setManualEmail(event.target.value)} placeholder="customer@example.com" /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleAddManual} disabled={isAdding || !manualEmail.trim()}>{isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add contact</Button>
                <input ref={importRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={event => handleImport(event.target.files?.[0])} />
                <Button type="button" variant="outline" onClick={() => importRef.current?.click()} disabled={isImporting}>{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}Import CSV / TXT</Button>
              </div>
              <p className="text-xs text-muted-foreground">Maximum file size: 5 MB. The importer detects valid email addresses and optional names, removes duplicates and selects the imported contacts.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Compose campaign</CardTitle><CardDescription>Send individually addressed, personalized emails through your existing hotel Email API connection.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="marketing-subject">Email subject template</Label><Input id="marketing-subject" value={subjectTemplate} onChange={event => setSubjectTemplate(event.target.value)} placeholder="{{businessName}} - Hello {{name}}" /></div>
              <div className="space-y-2"><Label htmlFor="marketing-message">Campaign message</Label><Textarea id="marketing-message" rows={4} value={campaignMessage} onChange={event => setCampaignMessage(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="marketing-template">Customized email body template</Label><Textarea id="marketing-template" rows={8} value={messageTemplate} onChange={event => setMessageTemplate(event.target.value)} /></div>
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{businessName}}'}</code>, <code>{'{{message}}'}</code>, <code>{'{{date}}'}</code>. Your saved Email Settings logo, banner colour, sender name and footer are used automatically.</div>
              <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Recipients selected</span><strong>{selectedContacts.length}</strong></div>
              <label className="flex items-start gap-2 rounded-md border p-3 text-xs"><Checkbox checked={confirmMarketingConsent} onCheckedChange={checked => setConfirmMarketingConsent(!!checked)} /><span>I confirm that the selected recipients have permission to receive this marketing email and that opt-out requests will be honoured.</span></label>
              <Button type="button" className="w-full" onClick={handleSendCampaign} disabled={isSending || !selectedContacts.length || !campaignMessage.trim() || !confirmMarketingConsent}>
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isSending ? `Sending ${progress.done}/${progress.total}` : `Send campaign to ${selectedContacts.length} recipient(s)`}
              </Button>
              {isSending && <div className="space-y-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: progress.total ? (progress.done / progress.total * 100) + '%' : '0%' }} /></div><p className="text-xs text-muted-foreground">{progress.sent} accepted · {progress.failed} failed</p></div>}
            </CardContent>
          </Card>

          {sendResults.length > 0 && <Card><CardHeader><CardTitle>Campaign results</CardTitle><CardDescription>{progress.sent} accepted · {progress.failed} failed</CardDescription></CardHeader><CardContent><ScrollArea className="h-56"><div className="space-y-2">{sendResults.map((result, index) => <div key={result.email + index} className="flex items-start gap-2 text-sm">{result.status === 'sent' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}<span className="min-w-0 flex-1 break-all">{result.email}{result.error && <span className="block text-xs text-destructive">{result.error}</span>}</span><Badge variant={result.status === 'sent' ? 'secondary' : 'destructive'}>{result.status === 'sent' ? 'Accepted' : 'Failed'}</Badge></div>)}</div></ScrollArea></CardContent></Card>}
          <p className="text-xs text-muted-foreground">Only send marketing messages to contacts who have given permission to receive them. Include a clear opt-out method in your campaign content and honour opt-out requests. “Accepted” means the gateway queued the message; it does not confirm delivery to the inbox.</p>
        </div>
      </div>
    </div>
  );
}

export default withAuth(EmailMarketingPage, PagePermission.MANAGE_EMAIL_MARKETING);
