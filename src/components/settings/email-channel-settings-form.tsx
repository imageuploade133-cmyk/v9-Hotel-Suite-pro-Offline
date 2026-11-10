'use client';

import * as React from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, Save, Send, Paperclip, X, FileImage, FileText, File as FileIcon, UploadCloud } from 'lucide-react';

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
type EmailAttachment = { filename: string; contentType: string; content: string; encoding: string; cid?: string };
type EmailConfig = { enabled: boolean; baseUrl: string; apiKey: string; username: string; password: string; senderName: string; logoDataUrl: string; topBannerText: string; topBannerColor: string; templateSubject: string; templateBody: string; footerText: string; channels: ChannelMap };

const DEFAULT_CHANNELS: ChannelMap = {
  newReservation: true,
  stockTransfer: true,
  dailyIncome: true,
  guestNotifications: true,
  otherNotifications: false,
};
const DEFAULT_CONFIG: EmailConfig = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  username: '',
  password: '',
  senderName: '',
  logoDataUrl: '',
  topBannerText: 'OFFICIAL HOTEL NOTIFICATION',
  topBannerColor: '#0f766e',
  templateSubject: '{{subject}}',
  templateBody: '{{message}}',
  footerText: 'Thank you for choosing us. We appreciate your business.',
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
    baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl : '',
    apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
    username: typeof saved.username === 'string' ? saved.username : '',
    password: typeof saved.password === 'string' ? saved.password : '',
    senderName: typeof saved.senderName === 'string' ? saved.senderName : '',
    logoDataUrl: typeof saved.logoDataUrl === 'string' ? saved.logoDataUrl : '',
    topBannerText: typeof saved.topBannerText === 'string' ? saved.topBannerText : DEFAULT_CONFIG.topBannerText,
    topBannerColor: typeof saved.topBannerColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved.topBannerColor) ? saved.topBannerColor : DEFAULT_CONFIG.topBannerColor,
    templateSubject: typeof saved.templateSubject === 'string' ? saved.templateSubject : DEFAULT_CONFIG.templateSubject,
    templateBody: typeof saved.templateBody === 'string' ? saved.templateBody : DEFAULT_CONFIG.templateBody,
    footerText: typeof saved.footerText === 'string' ? saved.footerText : DEFAULT_CONFIG.footerText,
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
  const [showGatewayCredentials, setShowGatewayCredentials] = React.useState(false);
  const [gatewayUsernameDraft, setGatewayUsernameDraft] = React.useState('');
  const [gatewayPasswordDraft, setGatewayPasswordDraft] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [testTo, setTestTo] = React.useState('');
  const [testSubject, setTestSubject] = React.useState('Email integration test');
  const [testMessage, setTestMessage] = React.useState('This is a test email from your hotel management system. If you received this message, your email integration is working.');
  const [testFiles, setTestFiles] = React.useState<File[]>([]);
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = React.useState(false);
  const testFileInputRef = React.useRef<HTMLInputElement>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const addTestFiles = (incoming: FileList | File[]) => {
    const selected = Array.from(incoming);
    if (!selected.length) return;
    const combined = [...testFiles, ...selected];
    if (combined.length > 10) {
      toast({ variant: 'destructive', title: 'Too many attachments', description: 'You can attach up to 10 files per email.' });
      return;
    }
    const totalBytes = combined.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > 20 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Attachments too large', description: 'The combined attachment size must not exceed 20 MB for this gateway request.' });
      return;
    }
    setTestFiles(combined);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  React.useEffect(() => {
    const normalized = normalizeConfig((settings as any)?.emailChannel);
    setConfig(normalized);
    setShowGatewayCredentials(!normalized.username && !normalized.password);
    setGatewayUsernameDraft('');
    setGatewayPasswordDraft('');
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
      const savedConfig = { ...config, username: gatewayUsernameDraft.trim() || config.username, password: gatewayPasswordDraft || config.password, baseUrl, updatedAt: new Date().toISOString() };
      try {
        await updateDoc(ref, { emailChannel: savedConfig });
      } catch (error: any) {
        if (error?.code === 'not-found') await setDoc(ref, { emailChannel: savedConfig }, { merge: true });
        else throw error;
      }
      setConfig(savedConfig);
      setGatewayUsernameDraft('');
      setGatewayPasswordDraft('');
      setShowGatewayCredentials(false);
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
      const readFileAsAttachment = (file: File) => new Promise<EmailAttachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const comma = result.indexOf(',');
          if (comma < 0) return reject(new Error('Could not read attachment: ' + file.name));
          resolve({ filename: file.name, contentType: file.type || 'application/octet-stream', content: result.slice(comma + 1), encoding: 'base64' });
        };
        reader.onerror = () => reject(new Error('Could not read attachment: ' + file.name));
        reader.readAsDataURL(file);
      });
      const attachments = await Promise.all(testFiles.map(readFileAsAttachment));
      const escapeHtml = (value: string) => value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
      const senderName = config.senderName.trim() || 'Hotel';
      const renderTemplateValue = (template: string) => template
        .replace(/\\{\\{\\s*message\\s*\\}\\}/gi, () => testMessage)
        .replace(/\\{\\{\\s*subject\\s*\\}\\}/gi, () => testSubject.trim())
        .replace(/\\{\\{\\s*businessName\\s*\\}\\}/gi, () => senderName)
        .replace(/\\{\\{\\s*recipient\\s*\\}\\}/gi, () => recipient)
        .replace(/\\{\\{\\s*date\\s*\\}\\}/gi, () => new Date().toLocaleString());
      const renderedSubject = renderTemplateValue(config.templateSubject || '{{subject}}').trim() || testSubject.trim();
      const templateText = config.templateBody
        .replace(/\{\{\s*message\s*\}\}/gi, () => testMessage)
        .replace(/\{\{\s*businessName\s*\}\}/gi, () => senderName)
        .replace(/\{\{\s*recipient\s*\}\}/gi, () => recipient)
        .replace(/\{\{\s*date\s*\}\}/gi, () => new Date().toLocaleString());
      const safeBannerColor = /^#[0-9a-fA-F]{6}$/.test(config.topBannerColor) ? config.topBannerColor : '#0f766e';
      let logoMarkup = '';
      if (config.logoDataUrl) {
        const match = config.logoDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
        if (!match) throw new Error('The saved logo image is invalid. Please upload the logo again using PNG, JPG, or WEBP.');
        const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
        const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        attachments.unshift({
          filename: 'hotel-business-logo.' + extension,
          contentType: mimeType,
          content: match[2],
          encoding: 'base64',
          cid: 'hotel-business-logo'
        });
        logoMarkup = '<img src="cid:hotel-business-logo" alt="' + escapeHtml(senderName) + '" width="180" style="display:block;width:180px;max-width:100%;max-height:84px;height:auto;object-fit:contain;margin:0 auto 18px" />';
      }
      const html = '<!doctype html><html><body style="margin:0;padding:24px 10px;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse"><tr><td style="background:' + safeBannerColor + ';padding:13px 20px;text-align:center;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:1px">' + escapeHtml(config.topBannerText.trim() || senderName) + '</td></tr><tr><td style="padding:28px 30px 12px;text-align:center">' + logoMarkup + '<h2 style="margin:0;font-size:22px;color:#0f172a">' + escapeHtml(senderName) + '</h2></td></tr><tr><td style="padding:18px 30px 28px;font-size:15px;line-height:1.7;white-space:pre-wrap">' + escapeHtml(templateText) + '</td></tr><tr><td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:18px 24px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;white-space:pre-wrap">' + escapeHtml(config.footerText) + '</td></tr></table></body></html>';
      const response = await fetch(baseUrl + '/api/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey.trim() }, body: JSON.stringify({ to: recipient, subject: renderedSubject, senderName, fromName: senderName, html, ...(attachments.length ? { attachments } : {}) }) });
      const raw = await response.text(); let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) }; }
      if (!response.ok || payload.success !== true || payload.error || !payload.messageId) {
        throw new Error(payload.message || payload.error || ('Email gateway did not confirm that the message was queued (HTTP ' + response.status + ').'));
      }

      // /send confirms queue acceptance, not final delivery. Check the gateway log
      // when this API key has email.view permission so provider failures are visible.
      let deliveryStatus: string | null = null;
      let deliveryError: string | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        try {
          const statusResponse = await fetch(baseUrl + '/api/email/status/' + encodeURIComponent(payload.messageId), {
            method: 'GET',
            headers: { 'X-API-Key': config.apiKey.trim() },
          });
          if (statusResponse.status === 401 || statusResponse.status === 403 || statusResponse.status === 404) break;
          if (!statusResponse.ok) continue;
          const statusPayload = await statusResponse.json();
          deliveryStatus = String(statusPayload.status || '').toUpperCase();
          deliveryError = statusPayload.errorMessage || null;
          if (deliveryStatus === 'SENT' || deliveryStatus === 'FAILED' || deliveryStatus === 'DELIVERED') break;
        } catch {
          // A status lookup failure must not turn a successfully queued email into a false failure.
          break;
        }
      }

      if (deliveryStatus === 'FAILED') {
        throw new Error(deliveryError || 'The gateway accepted the email but the email provider reported a sending failure. Check the gateway email logs and provider configuration.');
      }
      if (deliveryStatus === 'SENT' || deliveryStatus === 'DELIVERED') {
        toast({ title: 'Test email sent', description: 'The email gateway reports that the provider accepted the message for ' + recipient + '.' });
      } else {
        toast({ title: 'Test email queued', description: 'The gateway accepted the test email for ' + recipient + ', but final sending is not yet confirmed. Check the Email Logs in your gateway dashboard if it does not arrive.' });
      }
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label htmlFor="email-sender-name">Sender / business name</Label><Input id="email-sender-name" maxLength={120} placeholder="Your hotel or business name" value={config.senderName} onChange={event => updateConfig({ senderName: event.target.value })} /><p className="text-xs text-muted-foreground">Shown as the branded sender name in supported email gateway messages.</p></div>
            <div className="space-y-2 md:col-span-2"><Label>Business logo</Label><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 256 * 1024) { toast({ variant: 'destructive', title: 'Logo too large', description: 'Choose a compressed logo smaller than 256 KB. This keeps the saved settings within Firestore document limits.' }); event.target.value = ''; return; } const reader = new FileReader(); reader.onload = () => updateConfig({ logoDataUrl: String(reader.result || '') }); reader.readAsDataURL(file); }} /><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>Upload logo</Button>{config.logoDataUrl && <><img src={config.logoDataUrl} alt="Business logo preview" className="h-12 w-12 rounded border object-contain" /><Button type="button" variant="ghost" onClick={() => updateConfig({ logoDataUrl: '' })}>Remove logo</Button></>}</div><p className="text-xs text-muted-foreground">PNG, JPG, WEBP or GIF. Maximum 256 KB. The logo is sent as a CID inline image attachment, not a Base64 data URL in the email HTML.</p></div>
            <div className="md:col-span-2 space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-medium">Gateway account credentials</p><p className="text-xs text-muted-foreground">{config.username || config.password ? 'Credentials are saved and hidden from the settings inputs.' : 'No optional gateway account credentials have been saved.'}</p></div>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowGatewayCredentials(value => !value)}>{showGatewayCredentials ? 'Cancel' : config.username || config.password ? 'Replace credentials' : 'Add credentials'}</Button>
              </div>
              {showGatewayCredentials && <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="email-gateway-username">New username</Label><Input id="email-gateway-username" autoComplete="off" value={gatewayUsernameDraft} onChange={event => { setGatewayUsernameDraft(event.target.value); setIsSaved(false); }} placeholder="Enter new username" /></div>
                <div className="space-y-2"><Label htmlFor="email-gateway-password">New password</Label><Input id="email-gateway-password" type="password" autoComplete="new-password" value={gatewayPasswordDraft} onChange={event => { setGatewayPasswordDraft(event.target.value); setIsSaved(false); }} placeholder="Enter new password" /></div>
                <p className="text-xs text-muted-foreground md:col-span-2">Existing values are never loaded into these inputs. Leave blank to keep saved credentials unchanged.</p>
              </div>}
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

        <section className="space-y-4 rounded-lg border p-4" aria-disabled={!config.enabled}>
          <fieldset disabled={!config.enabled} className="space-y-4 disabled:pointer-events-none">
            <div>
              <h3 className="font-medium">Email Template & Branding</h3>
              <p className="text-sm text-muted-foreground">Customize the subject, branded email layout, message content and footer. The same saved design is used by this email composer.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email-top-banner-text">Top banner text</Label>
                <Input id="email-top-banner-text" maxLength={120} value={config.topBannerText} onChange={event => updateConfig({ topBannerText: event.target.value })} placeholder="OFFICIAL HOTEL NOTIFICATION" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-top-banner-color">Top banner colour</Label>
                <div className="flex items-center gap-3">
                  <Input id="email-top-banner-color" type="color" className="h-10 w-16 p-1" value={config.topBannerColor} onChange={event => updateConfig({ topBannerColor: event.target.value })} />
                  <span className="text-sm text-muted-foreground">{config.topBannerColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-footer-text">Email footer</Label>
                <Textarea id="email-footer-text" rows={3} maxLength={1000} value={config.footerText} onChange={event => updateConfig({ footerText: event.target.value })} placeholder="Thank you for choosing us." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email-template-subject">Subject template</Label>
                <Input id="email-template-subject" maxLength={180} value={config.templateSubject} onChange={event => updateConfig({ templateSubject: event.target.value })} placeholder="{{businessName}} - {{subject}}" />
                <p className="text-xs text-muted-foreground">Use {'{{subject}}'}, {'{{businessName}}'}, {'{{recipient}}'} or {'{{date}}'} to personalize the subject for each email.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email-template-body">Email message template</Label>
                <Textarea id="email-template-body" rows={7} maxLength={6000} value={config.templateBody} onChange={event => updateConfig({ templateBody: event.target.value })} placeholder="Hello,\n\n{{message}}\n\nRegards,\n{{businessName}}" />
                <p className="text-xs text-muted-foreground">Available placeholders: <code>{'{{message}}'}</code>, <code>{'{{subject}}'}</code>, <code>{'{{businessName}}'}</code>, <code>{'{{recipient}}'}</code>, <code>{'{{date}}'}</code>. Keep {'{{message}}'} in the body to include the composed message.</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border bg-background">
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground">Live email preview</div>
              <div className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-white" style={{ backgroundColor: config.topBannerColor }}>{config.topBannerText || config.senderName || 'HOTEL NOTIFICATION'}</div>
              <div className="space-y-3 p-4 text-center">
                {config.logoDataUrl && <img src={config.logoDataUrl} alt="Email logo preview" className="mx-auto max-h-16 max-w-40 object-contain" />}
                <p className="mb-1 text-xs font-medium text-muted-foreground">SUBJECT</p>
                <p className="mb-3 font-semibold">{(config.templateSubject || '{{subject}}').replace(/\\{\\{\\s*subject\\s*\\}\\}/gi, testSubject).replace(/\\{\\{\\s*businessName\\s*\\}\\}/gi, config.senderName || 'Your Hotel Name').replace(/\\{\\{\\s*recipient\\s*\\}\\}/gi, testTo || 'recipient@example.com').replace(/\\{\\{\\s*date\\s*\\}\\}/gi, new Date().toLocaleString())}</p>
                <p className="font-semibold">{config.senderName || 'Your Hotel Name'}</p>
                <p className="whitespace-pre-wrap text-left text-sm text-muted-foreground">{config.templateBody.replace(/\{\{\s*message\s*\}\}/gi, testMessage).replace(/\{\{\s*businessName\s*\}\}/gi, config.senderName || 'Your Hotel Name').replace(/\{\{\s*recipient\s*\}\}/gi, testTo || 'recipient@example.com').replace(/\{\{\s*date\s*\}\}/gi, new Date().toLocaleString())}</p>
              </div>
              <div className="border-t bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">{config.footerText}</div>
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
          <div><h3 className="flex items-center gap-2 font-medium"><Send className="h-4 w-4" /> Compose & Send Email</h3><p className="text-sm text-muted-foreground">Send a branded email to any recipient with images, PDFs, office documents or other supported file attachments.</p></div>
          <fieldset disabled={!config.enabled || isSendingTest} className="space-y-3 disabled:pointer-events-none">
            <div className="space-y-2"><Label htmlFor="email-test-recipient">To</Label><Input id="email-test-recipient" type="email" placeholder="you@example.com" value={testTo} onChange={event => setTestTo(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email-test-subject">Subject</Label><Input id="email-test-subject" value={testSubject} onChange={event => setTestSubject(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email-test-message">Email message</Label><Textarea id="email-test-message" value={testMessage} onChange={event => setTestMessage(event.target.value)} rows={4} /></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2"><Label>Attachments</Label><span className="text-xs text-muted-foreground">{testFiles.length} / 10 files · {formatFileSize(testFiles.reduce((sum, file) => sum + file.size, 0))} / 20 MB</span></div>
              <input ref={testFileInputRef} type="file" multiple className="hidden" onChange={event => { addTestFiles(event.target.files || []); event.target.value = ''; }} />
              <div
                role="button"
                tabIndex={0}
                onClick={() => testFileInputRef.current?.click()}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); testFileInputRef.current?.click(); } }}
                onDragOver={event => { event.preventDefault(); setIsDraggingFiles(true); }}
                onDragLeave={event => { event.preventDefault(); setIsDraggingFiles(false); }}
                onDrop={event => { event.preventDefault(); setIsDraggingFiles(false); addTestFiles(event.dataTransfer.files); }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${isDraggingFiles ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/20 hover:border-primary/50 hover:bg-muted/40'}`}
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-background shadow-sm"><UploadCloud className="h-5 w-5 text-primary" /></div>
                <p className="text-sm font-semibold">Drop files here or browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Images, PDF, Word, Excel, text, ZIP and other file types</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Maximum 10 files · 20 MB total · Any file type accepted by your email gateway</p>
              </div>
              {testFiles.length > 0 && <div className="space-y-2">
                {testFiles.map((file, index) => {
                  const AttachmentIcon = file.type.startsWith('image/') ? FileImage : file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? FileText : FileIcon;
                  return <div key={file.name + file.size + index} className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><AttachmentIcon className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.type || 'Unknown file type'} · {formatFileSize(file.size)}</p></div>
                    <Button type="button" size="icon" variant="ghost" aria-label={"Remove " + file.name} onClick={() => setTestFiles(current => current.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
                  </div>;
                })}
              </div>}
              <p className="text-xs text-muted-foreground">Files are attached to the outgoing email using the gateway’s Base64 attachment interface. The gateway/provider may enforce its own file-type and message-size limits.</p>
            </div>
            <Button type="button" onClick={sendTestEmail} disabled={isSendingTest || !testTo.trim()}>{isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{isSendingTest ? "Sending email..." : "Send Email"}</Button>
          </fieldset>
          {!config.enabled && <p className="text-xs text-muted-foreground">Enable Email Integration to compose messages and send attachments.</p>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">{isSaved ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span> : 'Save once to apply this Email connection and selected channels globally.'}</p>
          <Button type="button" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Email Settings'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This saves the shared connection, sender branding, email subject/body template and notification channel preferences. Manual email composition and attachments use the configured gateway. Automatic reservation, stock and daily-report event delivery remains a separate workflow and must be connected to the relevant events.</p>
      </CardContent>
    </Card>
  );
}
