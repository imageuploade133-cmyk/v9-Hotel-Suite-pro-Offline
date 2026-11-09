'use client';

import * as React from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, Save } from 'lucide-react';

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

type EmailChannelConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  notifications: {
    newReservation: boolean;
    stockTransfer: boolean;
    dailyIncome: boolean;
    guestNotifications: boolean;
    otherNotifications: boolean;
  };
};

const DEFAULT_CONFIG: EmailChannelConfig = {
  enabled: false,
  baseUrl: 'https://what-1vs4.onrender.com',
  apiKey: '',
  notifications: {
    newReservation: true,
    stockTransfer: true,
    dailyIncome: true,
    guestNotifications: true,
    otherNotifications: false,
  },
};

const NOTIFICATION_OPTIONS: Array<{ id: keyof EmailChannelConfig['notifications']; title: string; description: string }> = [
  { id: 'newReservation', title: 'New Reservation Alerts', description: 'Email the configured recipients when a new reservation is created.' },
  { id: 'stockTransfer', title: 'Stock Transfer Alerts', description: 'Email stock transfer notifications and receipts.' },
  { id: 'dailyIncome', title: 'Daily Income Reports', description: 'Send daily income summaries by email.' },
  { id: 'guestNotifications', title: 'Guest Notifications', description: 'Send booking, billing, and guest service notifications.' },
  { id: 'otherNotifications', title: 'Other Notifications', description: 'Allow additional email notifications when supported by the app.' },
];

function normalizeEmailConfig(value: unknown): EmailChannelConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CONFIG, notifications: { ...DEFAULT_CONFIG.notifications } };
  const saved = value as Partial<EmailChannelConfig>;
  return {
    enabled: saved.enabled === true,
    baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl : DEFAULT_CONFIG.baseUrl,
    apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
    notifications: {
      ...DEFAULT_CONFIG.notifications,
      ...(saved.notifications && typeof saved.notifications === 'object' ? saved.notifications : {}),
    },
  };
}

export function EmailChannelSettingsForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { settings, isLoading, refreshSettings } = useSettings();
  const [config, setConfig] = React.useState<EmailChannelConfig>(DEFAULT_CONFIG);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

  React.useEffect(() => {
    setConfig(normalizeEmailConfig((settings as any)?.emailChannel));
  }, [settings]);

  const updateConfig = (patch: Partial<EmailChannelConfig>) => {
    setConfig(current => ({ ...current, ...patch }));
    setIsSaved(false);
  };

  const updateNotification = (id: keyof EmailChannelConfig['notifications'], enabled: boolean) => {
    setConfig(current => ({
      ...current,
      notifications: { ...current.notifications, [id]: enabled },
    }));
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
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      toast({ variant: 'destructive', title: 'Invalid API Base URL', description: 'The Base URL must begin with http:// or https://.' });
      return;
    }

    setIsSaving(true);
    try {
      const settingsRef = doc(firestore, 'settings', 'global');
      const savedConfig = { ...config, baseUrl, updatedAt: new Date().toISOString() };
      try {
        await updateDoc(settingsRef, { emailChannel: savedConfig });
      } catch (error: any) {
        if (error?.code === 'not-found') {
          await setDoc(settingsRef, { emailChannel: savedConfig }, { merge: true });
        } else {
          throw error;
        }
      }
      setConfig(savedConfig);
      setIsSaved(true);
      refreshSettings();
      toast({ title: 'Email settings saved', description: 'Email channel configuration and notification switches have been saved.' });
    } catch (error: any) {
      console.error('Failed to save Email channel settings:', error);
      toast({ variant: 'destructive', title: 'Could not save Email settings', description: error?.message || 'Check your connection and try again.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Notifications</CardTitle>
            <CardDescription>Connect your Email REST API and control which hotel events are allowed to send email notifications.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="email-channel-enabled">{config.enabled ? 'Email Enabled' : 'Email Disabled'}</Label>
            <Switch id="email-channel-enabled" checked={config.enabled} onCheckedChange={(enabled) => updateConfig({ enabled })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email-api-base-url">API Base URL</Label>
            <Input id="email-api-base-url" type="url" autoComplete="url" placeholder="https://your-email-api.example.com" value={config.baseUrl} onChange={event => updateConfig({ baseUrl: event.target.value })} />
            <p className="text-xs text-muted-foreground">The send endpoint will be called at {config.baseUrl.trim().replace(/\/+$/, '') || 'your Base URL'}/api/email/send.</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email-api-key">Email API Key</Label>
            <div className="relative">
              <Input id="email-api-key" type={showApiKey ? 'text' : 'password'} autoComplete="new-password" placeholder="Paste your Email API Key" value={config.apiKey} onChange={event => updateConfig({ apiKey: event.target.value })} className="pr-11" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showApiKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowApiKey(value => !value)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Email notification controls</h3>
            <p className="text-sm text-muted-foreground">Turn each event type ON or OFF independently. The master Email switch overrides all event switches.</p>
          </div>
          {NOTIFICATION_OPTIONS.map(option => (
            <div key={option.id} className="flex items-center justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`email-notification-${option.id}`} className="text-sm font-medium">{option.title}</Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              <Switch id={`email-notification-${option.id}`} checked={config.notifications[option.id]} disabled={!config.enabled} onCheckedChange={enabled => updateNotification(option.id, enabled)} />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {isSaved ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span> : 'Remember to save after changing the Email switch or API credentials.'}
          </p>
          <Button type="button" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Email Settings'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The supplied API supports sending HTML email, template email, OTP email, and email attachments. This screen saves channel configuration; existing event handlers must be connected to the Email API separately before automatic delivery can occur. API keys should be protected by administrator-only Firestore rules and moved behind server-side sending endpoints before production messaging is enabled.
        </p>
      </CardContent>
    </Card>
  );
}
