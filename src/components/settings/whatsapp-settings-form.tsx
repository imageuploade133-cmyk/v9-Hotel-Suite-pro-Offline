'use client';

import * as React from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Eye, EyeOff, Loader2, MessageSquareText, Save } from 'lucide-react';
import { WhatsAppConnectionManager } from '@/components/settings/whatsapp-connection-manager';

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

type ChannelId = 'newReservation' | 'stockTransfer' | 'dailyIncome' | 'bulkMessages' | 'guestNotifications' | 'otherNotifications';
type ChannelMap = Record<ChannelId, boolean>;
type WhatsAppConfig = { enabled: boolean; baseUrl: string; apiKey: string; instanceId: string; username: string; password: string; senderName: string; channels: ChannelMap };

const DEFAULT_CHANNELS: ChannelMap = {
  newReservation: true,
  stockTransfer: true,
  dailyIncome: true,
  bulkMessages: false,
  guestNotifications: true,
  otherNotifications: false,
};
const DEFAULT_CONFIG: WhatsAppConfig = {
  enabled: false, baseUrl: '', apiKey: '', instanceId: '', username: '', password: '', senderName: '', channels: { ...DEFAULT_CHANNELS },
};
const CHANNELS: Array<{ id: ChannelId; title: string; description: string }> = [
  { id: 'newReservation', title: 'New Reservation Alerts', description: 'Notify staff about newly created reservations.' },
  { id: 'stockTransfer', title: 'Stock Transfer Alerts', description: 'Send stock transfer notifications and receipts.' },
  { id: 'dailyIncome', title: 'Daily Income Reports', description: 'Send scheduled or manually requested daily income summaries.' },
  { id: 'bulkMessages', title: 'Bulk WhatsApp Messages', description: 'Use this connection for authorized bulk messaging.' },
  { id: 'guestNotifications', title: 'Guest Notifications', description: 'Send booking, billing, and guest service updates to guests.' },
  { id: 'otherNotifications', title: 'Other Notifications', description: 'Allow other supported hotel notification events.' },
];

function normalizeConfig(value: unknown): WhatsAppConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CONFIG, channels: { ...DEFAULT_CHANNELS } };
  const saved = value as Partial<WhatsAppConfig>;
  return {
    enabled: saved.enabled === true,
    baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl : '',
    apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
    instanceId: typeof saved.instanceId === 'string' ? saved.instanceId : '',
    username: typeof saved.username === 'string' ? saved.username : '',
    password: typeof saved.password === 'string' ? saved.password : '',
    senderName: typeof saved.senderName === 'string' ? saved.senderName : '',
    channels: { ...DEFAULT_CHANNELS, ...(saved.channels && typeof saved.channels === 'object' ? saved.channels : {}) },
  };
}

export function WhatsAppSettingsForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { settings, isLoading, refreshSettings } = useSettings();
  const [config, setConfig] = React.useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [showGatewayCredentials, setShowGatewayCredentials] = React.useState(false);
  const [gatewayUsernameDraft, setGatewayUsernameDraft] = React.useState('');
  const [gatewayPasswordDraft, setGatewayPasswordDraft] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

  React.useEffect(() => {
    const saved = (settings as any)?.whatsappChannel;
    if (saved) {
      const normalized = normalizeConfig(saved);
      setConfig(normalized);
      setShowGatewayCredentials(!normalized.username && !normalized.password);
      setGatewayUsernameDraft('');
      setGatewayPasswordDraft('');
      return;
    }
    // Backward-compatible migration from the first draft's per-event credentials:
    // reuse the first configured connection once, then store one shared connection.
    const legacy = (settings as any)?.whatsappProviders || {};
    const firstConfigured = Object.values(legacy).find((item: any) => item?.baseUrl || item?.apiKey || item?.instanceId) as any;
    if (firstConfigured) {
      setConfig({
        ...normalizeConfig(firstConfigured),
        channels: {
          ...DEFAULT_CHANNELS,
          newReservation: legacy.newReservation?.enabled ?? DEFAULT_CHANNELS.newReservation,
          stockTransfer: legacy.stockTransfer?.enabled ?? DEFAULT_CHANNELS.stockTransfer,
          dailyIncome: legacy.dailyIncome?.enabled ?? DEFAULT_CHANNELS.dailyIncome,
          bulkMessages: legacy.bulkMessages?.enabled ?? DEFAULT_CHANNELS.bulkMessages,
          guestNotifications: legacy.guestNotifications?.enabled ?? DEFAULT_CHANNELS.guestNotifications,
          otherNotifications: legacy.otherNotifications?.enabled ?? DEFAULT_CHANNELS.otherNotifications,
        },
      });
    } else {
      setConfig(normalizeConfig(saved));
    }
  }, [settings]);

  const updateConfig = (patch: Partial<WhatsAppConfig>) => {
    setConfig(current => ({ ...current, ...patch }));
    setIsSaved(false);
  };
  const updateChannel = (id: ChannelId, enabled: boolean) => {
    setConfig(current => ({ ...current, channels: { ...current.channels, [id]: enabled } }));
    setIsSaved(false);
  };

  async function saveSettings() {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Sign-in required', description: 'Sign in with an authorized account to save WhatsApp settings.' });
      return;
    }
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    const hasSelectedChannel = Object.values(config.channels).some(Boolean);
    if (config.enabled && (!baseUrl || !config.apiKey.trim() || !config.instanceId.trim())) {
      toast({ variant: 'destructive', title: 'WhatsApp configuration incomplete', description: 'Enter the API Base URL, API Key, and Instance ID before enabling WhatsApp.' });
      return;
    }
    if (config.enabled && !hasSelectedChannel) {
      toast({ variant: 'destructive', title: 'Select at least one channel', description: 'Choose which notification channels should use this WhatsApp connection.' });
      return;
    }
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      toast({ variant: 'destructive', title: 'Invalid API Base URL', description: 'The Base URL must start with http:// or https://.' });
      return;
    }
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'settings', 'global');
      const savedConfig = { ...config, username: gatewayUsernameDraft.trim() || config.username, password: gatewayPasswordDraft || config.password, baseUrl, updatedAt: new Date().toISOString() };
      try {
        await updateDoc(ref, { whatsappChannel: savedConfig });
      } catch (error: any) {
        if (error?.code === 'not-found') await setDoc(ref, { whatsappChannel: savedConfig }, { merge: true });
        else throw error;
      }
      setConfig(savedConfig);
      setGatewayUsernameDraft('');
      setGatewayPasswordDraft('');
      setShowGatewayCredentials(false);
      setIsSaved(true);
      refreshSettings();
      toast({ title: 'WhatsApp settings saved', description: 'One WhatsApp connection is now configured for your selected channels.' });
    } catch (error: any) {
      console.error('Failed to save WhatsApp settings:', error);
      toast({ variant: 'destructive', title: 'Could not save WhatsApp settings', description: error?.message || 'Check your connection and try again.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5" /> WhatsApp Integration</CardTitle>
            <CardDescription>Connect WhatsApp once, then select every hotel channel that should use this same connection. Credentials are shared globally across the selected channels.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="whatsapp-master-enabled">{config.enabled ? 'WhatsApp Enabled' : 'WhatsApp Disabled'}</Label>
            <Switch id="whatsapp-master-enabled" checked={config.enabled} onCheckedChange={enabled => updateConfig({ enabled })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Shared WhatsApp connection</h3>
            <p className="text-sm text-muted-foreground">Enter these details once. They will be used by all channels you enable below.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label htmlFor="whatsapp-sender-name">Business / sender name</Label><Input id="whatsapp-sender-name" maxLength={80} placeholder="Your hotel or business name" value={config.senderName} onChange={event => updateConfig({ senderName: event.target.value })} /><p className="text-xs text-muted-foreground">This name is added to outgoing WhatsApp text and media captions.</p></div>
            <div className="md:col-span-2 space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-medium">Gateway account credentials</p><p className="text-xs text-muted-foreground">{config.username || config.password ? 'Credentials are saved securely from this form and are hidden.' : 'No optional gateway account credentials have been saved.'}</p></div>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowGatewayCredentials(value => !value)}>{showGatewayCredentials ? 'Cancel' : config.username || config.password ? 'Replace credentials' : 'Add credentials'}</Button>
              </div>
              {showGatewayCredentials && <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="whatsapp-gateway-username">New username</Label><Input id="whatsapp-gateway-username" autoComplete="off" value={gatewayUsernameDraft} onChange={event => { setGatewayUsernameDraft(event.target.value); setIsSaved(false); }} placeholder="Enter new username" /></div>
                <div className="space-y-2"><Label htmlFor="whatsapp-gateway-password">New password</Label><Input id="whatsapp-gateway-password" type="password" autoComplete="new-password" value={gatewayPasswordDraft} onChange={event => { setGatewayPasswordDraft(event.target.value); setIsSaved(false); }} placeholder="Enter new password" /></div>
                <p className="text-xs text-muted-foreground md:col-span-2">Existing values are never loaded into these inputs. Leave them blank to keep the saved credentials unchanged.</p>
              </div>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="whatsapp-base-url">API Base URL</Label>
              <Input id="whatsapp-base-url" type="url" autoComplete="url" placeholder="https://your-whatsapp-gateway.example.com" value={config.baseUrl} onChange={event => updateConfig({ baseUrl: event.target.value })} />
              <p className="text-xs text-muted-foreground">Enter the gateway base address only, without /api/send/text or /api/send/media.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-api-key">API Key</Label>
              <div className="relative">
                <Input id="whatsapp-api-key" type={showApiKey ? 'text' : 'password'} autoComplete="new-password" placeholder="Paste your WhatsApp API Key" value={config.apiKey} onChange={event => updateConfig({ apiKey: event.target.value })} className="pr-11" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showApiKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowApiKey(value => !value)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-instance-id">Instance ID</Label>
              <Input id="whatsapp-instance-id" placeholder="Paste your WhatsApp Instance ID" value={config.instanceId} onChange={event => updateConfig({ instanceId: event.target.value })} />
            </div>
          </div>
        </section>

        <WhatsAppConnectionManager config={config} />

        <section className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Select WhatsApp channels</h3>
            <p className="text-sm text-muted-foreground">Turn ON only the notification channels that should use this shared WhatsApp connection.</p>
          </div>
          {CHANNELS.map(channel => (
            <div key={channel.id} className="flex items-center justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`whatsapp-channel-${channel.id}`} className="text-sm font-medium">{channel.title}</Label>
                <p className="text-xs text-muted-foreground">{channel.description}</p>
              </div>
              <Switch id={`whatsapp-channel-${channel.id}`} checked={config.channels[channel.id]} disabled={!config.enabled} onCheckedChange={enabled => updateChannel(channel.id, enabled)} />
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">{isSaved ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span> : 'Save once to apply this connection and your selected channels globally.'}</p>
          <Button type="button" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save WhatsApp Settings'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">QR pairing and live connection status still require the gateway's documented instance-management endpoints. Message delivery also requires the application event handlers to use this shared configuration; the supplied reference documents send endpoints but not QR-management endpoints.</p>
      </CardContent>
    </Card>
  );
}
