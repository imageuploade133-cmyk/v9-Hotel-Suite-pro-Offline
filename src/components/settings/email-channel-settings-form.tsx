'use client';

import * as React from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, Save, Send, Paperclip, X } from 'lucide-react';

import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

type ChannelId = 'newReservation' | 'stockTransfer' | 'dailyIncome' | 'guestNotifications' | 'otherNotifications';
type ChannelMap = Record<ChannelId, boolean>;
type EmailConfig = { enabled: boolean; baseUrl: string; apiKey: string; username: string; password: string; senderName: string; logoDataUrl: string; channels: ChannelMap };

const DEFAULT_CHANNELS: ChannelMap = {
  newReservation: true,
  stockTransfer: true,
  dailyIncome: true,
  guestNotifications: true,
  otherNotifications: false,
};
const DEFAULT_CONFIG: EmailConfig = {
  enabled: false,
  baseUrl: 'https://what-1vs4.onrender.com',
  apiKey: '',
  username: '',
  password: '',
  senderName: '',
  logoDataUrl: '',
  channels: { ...DEFAULT_CHANNELS },
};
const CHANNELS: Array<{ id: ChannelId; title: string; description: string }> = [
  { id: 'newReservation', title: 'New Reservation Alerts', description: 'Email the configured recipients when a new reservation is created.' },
  { id: 'stockTransfer', title: 'Stock Transfer Alerts', description: 'Email stock transfer notifications and receipts.' },
  { id: 'dailyIncome', title: 'Daily Income Reports', description: 'Send daily income summaries by email.' },
  { id: 'guestNotifications', title: 'Guest Notifications', description: 'Send booking, billing, and guest service notifications.' },
  { id: 'otherNotifications', title: 'Other Notifications', description: 'Allow other supported email notification events.' },
];

function normalizeConfig(value: unknown): EmailConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CONFIG, channels: { ...DEFAULT_CHANNELS } };
  const saved = value as Partial<EmailConfig>;
  return {
    enabled: saved.enabled === true,
    baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl : DEFAULT_CONFIG.baseUrl,
    apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
    username: typeof saved.username === 'string' ? saved.username : '',
    password: typeof saved.password === 'string' ? saved.password : '',
    senderName: typeof saved.senderName === 'string' ? saved.senderName : '',
    logoDataUrl: typeof saved.logoDataUrl === 'string' ? saved.logoDataUrl : '',
    channels: { ...DEFAULT_CHANNELS, ...(saved.channels && typeof saved.channels === 'object' ? saved.channels : {}) },
  };
}

export function EmailChannelSettingsForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { settings, isLoading, refreshSettings } = useSettings();
  const [config, setConfig] = React.useState<EmailConfig>(DEFAULT_CONFIG);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [showGatewayPassword, setShowGatewayPassword] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [testTo, setTestTo] = React.useState('');
  const [testSubject, setTestSubject] = React.useState('Email integration test');
  const [testMessage, setTestMessage] = React.useState('This is a test email from your hotel management system. If you received this message, your email integration is working.');
  const [testFiles, setTestFiles] = React.useState<File[]>([]);
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const testFileInputRef = React.useRef<HTMLInputElement>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setConfig(normalizeConfig((settings as any)?.emailChannel));
  }, [settings]);

  const updateConfig = (patch: Partial<EmailConfig>) => {
    setConfig(current => ({ ...current, ...patch }));
    setIsSaved(false);
  };
  const updateChannel = (id: ChannelId, enabled: boolean) => {
    setConfig(current => ({ ...current, channels: { ...current.channels, [id]: enabled } }));
    setIsSaved(false);
  };

  async function saveSettings() {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Sign-in required', description: 'Sign in with an authorized account to save Email settings.' });
      return;
    }
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    if (config.enabled && (!baseUrl || !config.apiKey.trim())) {
      toast({ variant: 'destructive', title: 'Email configuration incomplete', description: 'Enter the API Base URL and API Key before enabling Email.' });
      return;
    }
    if (config.enabled && !Object.values(config.channels).some(Boolean)) {
      toast({ variant: 'destructive', title: 'Select at least one channel', description: 'Choose which notification channels should use this Email connection.' });
      return;
    }
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      toast({ variant: 'destructive', title: 'Invalid API Base URL', description: 'The Base URL must begin with http:// or https://.' });
      return;
    }
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'settings', 'global');
      const savedConfig = { ...config, baseUrl, updatedAt: new Date().toISOString() };
      try {
        await updateDoc(ref, { emailChannel: savedConfig });
      } catch (error: any) {
        if (error?.code === 'not-found') await setDoc(ref, { emailChannel: savedConfig }, { merge: true });
        else throw error;
      }
      setConfig(savedConfig);
      setIsSaved(true);
      refreshSettings();
      toast({ title: 'Email settings saved', description: 'One Email connection is now configured for your selected channels.' });
    } catch (error: any) {
      console.error('Failed to save Email settings:', error);
      toast({ variant: 'destructive', title: 'Could not save Email settings', description: error?.message || 'Check your connection and try again.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function sendTestEmail() {
    const recipient = testTo.trim();
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
    if (!config.enabled) { toast({ variant: 'destructive', title: 'Email Integration is disabled', description: 'Enable the Email provider before sending a test email.' }); return; }
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { toast({ variant: 'destructive', title: 'Enter a valid recipient', description: 'Provide the email address that should receive the test message.' }); return; }
    if (!baseUrl || !config.apiKey.trim()) { toast({ variant: 'destructive', title: 'Email configuration incomplete', description: 'Enter and save the API Base URL and API Key first.' }); return; }
    if (!testSubject.trim() || !testMessage.trim()) { toast({ variant: 'destructive', title: 'Complete the test email', description: 'A subject and message are required.' }); return; }
    setIsSendingTest(true);
    try {
      const attachments = await Promise.all(testFiles.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const result = String(reader.result || ''); const comma = result.indexOf(','); if (comma < 0) return reject(new Error('Could not read attachment: ' + file.name)); resolve({ filename: file.name, contentType: file.type || 'application/octet-stream', content: result.slice(comma + 1) }); };
        reader.onerror = () => reject(new Error('Could not read attachment: ' + file.name));
        reader.readAsDataURL(file);
      })));
      const escapedMessage = testMessage.replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] || char));
      const response = await fetch(baseUrl + '/api/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey.trim() }, body: JSON.stringify({ to: recipient, subject: testSubject.trim(), senderName: config.senderName.trim() || undefined, fromName: config.senderName.trim() || undefined, html: '<div style="font-family:Arial,sans-serif;line-height:1.6">' + (config.logoDataUrl ? '<img src="' + config.logoDataUrl + '" alt="' + (config.senderName || 'Business') + '" style="max-width:180px;max-height:80px;object-fit:contain;margin-bottom:16px" />' : '') + (config.senderName.trim() ? '<h2 style="margin:0 0 12px">' + config.senderName.replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char] || char)) + '</h2>' : '') + '<div style="white-space:pre-wrap">' + escapedMessage + '</div></div>', ...(attachments.length ? { attachments } : {}) }) });
      const raw = await response.text(); let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) }; }
      if (!response.ok || payload.success === false || payload.error) throw new Error(payload.message || payload.error || ('Email gateway returned HTTP ' + response.status));
      toast({ title: 'Test email sent successfully', description: 'A test email was accepted for delivery to ' + recipient + '.' });
    } catch (error: any) { console.error('Email test failed:', error); toast({ variant: 'destructive', title: 'Test email failed', description: error?.message || 'Check your API URL, API key, gateway and attachment format.' }); }
    finally { setIsSendingTest(false); }
  }

  if (isLoading) return <Card><CardHeader><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Integration</CardTitle>
            <CardDescription>Connect Email once, then select every hotel channel that should use this same connection. Credentials are shared globally across selected channels.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="email-master-enabled">{config.enabled ? 'Email Enabled' : 'Email Disabled'}</Label>
            <Switch id="email-master-enabled" checked={config.enabled} onCheckedChange={enabled => updateConfig({ enabled })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4 rounded-lg border p-4" aria-disabled={!config.enabled}>
          {!config.enabled && <p className="mb-2 text-xs font-medium text-muted-foreground">Email provider is OFF. Settings are minimised and inputs are disabled.</p>}
          <fieldset disabled={!config.enabled} className="space-y-4 disabled:pointer-events-none">
          <div>
            <h3 className="font-medium">Shared Email connection</h3>
            <p className="text-sm text-muted-foreground">Enter the API details once. All selected notification channels will use this connection.</p>
          </div>
          <div>
            <h3 className="font-medium">Shared Email connection</h3>
            <p className="text-sm text-muted-foreground">Enter the API details once. All selected notification channels will use this connection.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label htmlFor="email-sender-name">Sender / business name</Label><Input id="email-sender-name" maxLength={120} placeholder="Your hotel or business name" value={config.senderName} onChange={event => updateConfig({ senderName: event.target.value })} /><p className="text-xs text-muted-foreground">Shown as the branded sender name in supported email gateway messages.</p></div>
            <div className="space-y-2 md:col-span-2"><Label>Business logo</Label><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1024 * 1024) { toast({ variant: 'destructive', title: 'Logo too large', description: 'Choose an image smaller than 1 MB.' }); event.target.value = ''; return; } const reader = new FileReader(); reader.onload = () => updateConfig({ logoDataUrl: String(reader.result || '') }); reader.readAsDataURL(file); }} /><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>Upload logo</Button>{config.logoDataUrl && <><img src={config.logoDataUrl} alt="Business logo preview" className="h-12 w-12 rounded border object-contain" /><Button type="button" variant="ghost" onClick={() => updateConfig({ logoDataUrl: '' })}>Remove logo</Button></>}</div><p className="text-xs text-muted-foreground">PNG, JPG, WEBP or GIF. Maximum 1 MB. The logo is embedded in branded test email content.</p></div>
            <div className="space-y-2">
              <Label htmlFor="email-gateway-username">Render Saver Username</Label>
              <Input id="email-gateway-username" autoComplete="username" placeholder="Gateway account username" value={config.username} onChange={event => updateConfig({ username: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-gateway-password">Render Saver Password</Label>
              <div className="relative">
                <Input id="email-gateway-password" type={showGatewayPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Gateway account password" value={config.password} onChange={event => updateConfig({ password: event.target.value })} className="pr-11" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showGatewayPassword ? 'Hide gateway password' : 'Show gateway password'} onClick={() => setShowGatewayPassword(value => !value)}>
                  {showGatewayPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-api-base-url">API Base URL</Label>
              <Input id="email-api-base-url" type="url" autoComplete="url" placeholder="https://your-email-api.example.com" value={config.baseUrl} onChange={event => updateConfig({ baseUrl: event.target.value })} />
              <p className="text-xs text-muted-foreground">Email send endpoint: {config.baseUrl.trim().replace(/\/+$/, '') || 'your Base URL'}/api/email/send.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-api-key">Email API Key</Label>
              <div className="relative">
                <Input id="email-api-key" type={showApiKey ? 'text' : 'password'} autoComplete="new-password" placeholder="Paste your Email API Key" value={config.apiKey} onChange={event => updateConfig({ apiKey: event.target.value })} className="pr-11" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showApiKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowApiKey(value => !value)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          </fieldset>
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <fieldset disabled={!config.enabled} className="space-y-3 disabled:pointer-events-none">
          <div>
            <h3 className="font-medium">Select Email channels</h3>
            <p className="text-sm text-muted-foreground">Turn ON the events that should use this shared Email connection.</p>
          </div>
          {CHANNELS.map(channel => (
            <div key={channel.id} className="flex items-center justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`email-channel-${channel.id}`} className="text-sm font-medium">{channel.title}</Label>
                <p className="text-xs text-muted-foreground">{channel.description}</p>
              </div>
              <Switch id={`email-channel-${channel.id}`} checked={config.channels[channel.id]} disabled={!config.enabled} onCheckedChange={enabled => updateChannel(channel.id, enabled)} />
            </div>
          ))}
          </fieldset>
        </section>

        <section className="space-y-4 rounded-lg border p-4" aria-disabled={!config.enabled}>
          <div><h3 className="flex items-center gap-2 font-medium"><Send className="h-4 w-4" /> Test Email & Attachments</h3><p className="text-sm text-muted-foreground">Send a real test email to verify delivery. Images, PDFs, documents and other file types are supported.</p></div>
          <fieldset disabled={!config.enabled || isSendingTest} className="space-y-3 disabled:pointer-events-none">
            <div className="space-y-2"><Label htmlFor="email-test-recipient">Recipient email address</Label><Input id="email-test-recipient" type="email" placeholder="you@example.com" value={testTo} onChange={event => setTestTo(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email-test-subject">Subject</Label><Input id="email-test-subject" value={testSubject} onChange={event => setTestSubject(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email-test-message">Message</Label><Textarea id="email-test-message" value={testMessage} onChange={event => setTestMessage(event.target.value)} rows={4} /></div>
            <div className="space-y-2"><Label>Attachments</Label><input ref={testFileInputRef} type="file" multiple className="hidden" onChange={event => { const selected = Array.from(event.target.files || []); const total = [...testFiles, ...selected]; if (total.length > 10) { toast({ variant: "destructive", title: "Too many attachments", description: "You can attach up to 10 files." }); event.target.value = ""; return; } if (total.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) { toast({ variant: "destructive", title: "Attachments too large", description: "Combined attachment size must not exceed 20 MB." }); event.target.value = ""; return; } setTestFiles(total); event.target.value = ""; }} /><Button type="button" variant="outline" onClick={() => testFileInputRef.current?.click()}><Paperclip className="mr-2 h-4 w-4" />Add files</Button>
              {testFiles.map((file, index) => <div key={file.name + index} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm"><span className="min-w-0 truncate">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span><Button type="button" size="icon" variant="ghost" aria-label={"Remove " + file.name} onClick={() => setTestFiles(current => current.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button></div>)}
              <p className="text-xs text-muted-foreground">Up to 10 files and 20 MB combined. Files are Base64-encoded for the gateway JSON attachment interface.</p></div>
            <Button type="button" onClick={sendTestEmail} disabled={isSendingTest || !testTo.trim()}>{isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{isSendingTest ? "Sending test email..." : "Send Test Email"}</Button>
          </fieldset>
          {!config.enabled && <p className="text-xs text-muted-foreground">Enable Email Integration to test delivery and manage attachments.</p>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">{isSaved ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span> : 'Save once to apply this Email connection and selected channels globally.'}</p>
          <Button type="button" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Email Settings'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This stores the shared connection and channel preferences. Automatic event delivery must be wired to the email service separately; your reference documents /api/email/send, /api/email/send-template, and /api/email/otp. Keep the API key restricted to administrators and use a server-side sender before production.</p>
      </CardContent>
    </Card>
  );
}
