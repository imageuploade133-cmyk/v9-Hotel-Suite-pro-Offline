'use client';

import * as React from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { Eye, EyeOff, Loader2, MessageSquareText, Save, CheckCircle2 } from 'lucide-react';

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

type ProviderId =
  | 'newReservation'
  | 'stockTransfer'
  | 'dailyIncome'
  | 'bulkMessages'
  | 'guestNotifications'
  | 'otherNotifications';

type ProviderConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  instanceId: string;
};

type ProviderMap = Partial<Record<ProviderId, ProviderConfig>>;

const PROVIDERS: Array<{
  id: ProviderId;
  title: string;
  description: string;
}> = [
  {
    id: 'newReservation',
    title: 'New Reservation Alerts',
    description: 'Send WhatsApp alerts when a new reservation is created.',
  },
  {
    id: 'stockTransfer',
    title: 'Stock Transfer Alerts',
    description: 'Send stock transfer notifications and receipts.',
  },
  {
    id: 'dailyIncome',
    title: 'Daily Income Reports',
    description: 'Send daily income summaries to your configured recipients.',
  },
  {
    id: 'bulkMessages',
    title: 'Bulk WhatsApp Messaging',
    description: 'Configure the independent connection used for approved bulk messages.',
  },
  {
    id: 'guestNotifications',
    title: 'Guest Notifications',
    description: 'Send guest-related booking, billing, and service notifications.',
  },
  {
    id: 'otherNotifications',
    title: 'Other Notifications',
    description: 'Reserve a separate WhatsApp connection for additional hotel alerts.',
  },
];

const EMPTY_CONFIG: ProviderConfig = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  instanceId: '',
};

function normalizeConfig(value: unknown): ProviderConfig {
  if (!value || typeof value !== 'object') return { ...EMPTY_CONFIG };
  const config = value as Partial<ProviderConfig>;
  return {
    enabled: config.enabled === true,
    baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : '',
    apiKey: typeof config.apiKey === 'string' ? config.apiKey : '',
    instanceId: typeof config.instanceId === 'string' ? config.instanceId : '',
  };
}

export function WhatsAppSettingsForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { settings, isLoading: isSettingsLoading, refreshSettings } = useSettings();
  const [providers, setProviders] = React.useState<ProviderMap>({});
  const [savingProvider, setSavingProvider] = React.useState<ProviderId | null>(null);
  const [visibleKeys, setVisibleKeys] = React.useState<Partial<Record<ProviderId, boolean>>>({});
  const [savedProviders, setSavedProviders] = React.useState<Partial<Record<ProviderId, boolean>>>({});

  React.useEffect(() => {
    const saved = (settings as any)?.whatsappProviders || {};
    const next: ProviderMap = {};
    PROVIDERS.forEach((provider) => {
      next[provider.id] = normalizeConfig(saved[provider.id]);
    });
    setProviders(next);
  }, [settings]);

  const updateProvider = (id: ProviderId, patch: Partial<ProviderConfig>) => {
    setProviders((current) => ({
      ...current,
      [id]: { ...normalizeConfig(current[id]), ...patch },
    }));
    setSavedProviders((current) => ({ ...current, [id]: false }));
  };

  async function saveProvider(id: ProviderId) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Sign-in required',
        description: 'You must be logged in to save WhatsApp provider settings.',
      });
      return;
    }

    const config = normalizeConfig(providers[id]);
    const normalizedBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    if (config.enabled && (!normalizedBaseUrl || !config.apiKey.trim() || !config.instanceId.trim())) {
      toast({
        variant: 'destructive',
        title: 'Incomplete provider configuration',
        description: 'Enter the API Base URL, API Key, and Instance ID before enabling this provider.',
      });
      return;
    }
    if (normalizedBaseUrl && !/^https?:\/\//i.test(normalizedBaseUrl)) {
      toast({
        variant: 'destructive',
        title: 'Invalid API Base URL',
        description: 'The Base URL must start with http:// or https://.',
      });
      return;
    }

    setSavingProvider(id);
    try {
      const settingsRef = doc(firestore, 'settings', 'global');
      const savedConfig = { ...config, baseUrl: normalizedBaseUrl, updatedAt: new Date().toISOString() };
      try {
        // Dot-path update keeps every provider independent and prevents one save
        // from replacing the credentials of another provider.
        await updateDoc(settingsRef, { [`whatsappProviders.${id}`]: savedConfig });
      } catch (updateError: any) {
        // First-time setup: create the settings document if it does not exist.
        if (updateError?.code === 'not-found') {
          await setDoc(settingsRef, { whatsappProviders: { [id]: savedConfig } }, { merge: true });
        } else {
          throw updateError;
        }
      }
      setProviders((current) => ({ ...current, [id]: savedConfig }));
      setSavedProviders((current) => ({ ...current, [id]: true }));
      refreshSettings();
      toast({
        title: 'Provider settings saved',
        description: `${PROVIDERS.find((provider) => provider.id === id)?.title} configuration was saved independently.`,
      });
    } catch (error: any) {
      console.error(`Failed to save WhatsApp provider ${id}:`, error);
      toast({
        variant: 'destructive',
        title: 'Could not save provider',
        description: error?.message || 'Please check your connection and try again.',
      });
    } finally {
      setSavingProvider(null);
    }
  }

  if (isSettingsLoading) {
    return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            WhatsApp Providers
          </CardTitle>
          <CardDescription>
            Configure each WhatsApp connection separately. Every provider has its own Base URL, API Key,
            Instance ID, and enable switch. Saving one provider does not replace another provider's settings.
          </CardDescription>
        </CardHeader>
      </Card>

      {PROVIDERS.map((provider) => {
        const config = normalizeConfig(providers[provider.id]);
        const isSaving = savingProvider === provider.id;
        return (
          <Card key={provider.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{provider.title}</CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`whatsapp-${provider.id}-enabled`} className="text-sm">
                    {config.enabled ? 'Enabled' : 'Disabled'}
                  </Label>
                  <Switch
                    id={`whatsapp-${provider.id}-enabled`}
                    checked={config.enabled}
                    onCheckedChange={(enabled) => updateProvider(provider.id, { enabled })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`whatsapp-${provider.id}-base-url`}>API Base URL</Label>
                  <Input
                    id={`whatsapp-${provider.id}-base-url`}
                    type="url"
                    autoComplete="url"
                    placeholder="https://your-whatsapp-gateway.example.com"
                    value={config.baseUrl}
                    onChange={(event) => updateProvider(provider.id, { baseUrl: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the gateway address only, without the /api/send/... endpoint.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`whatsapp-${provider.id}-api-key`}>API Key</Label>
                  <div className="relative">
                    <Input
                      id={`whatsapp-${provider.id}-api-key`}
                      type={visibleKeys[provider.id] ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Paste this provider's API Key"
                      value={config.apiKey}
                      onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })}
                      className="pr-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      aria-label={visibleKeys[provider.id] ? 'Hide API key' : 'Show API key'}
                      onClick={() => setVisibleKeys((current) => ({ ...current, [provider.id]: !current[provider.id] }))}
                    >
                      {visibleKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`whatsapp-${provider.id}-instance-id`}>Instance ID</Label>
                  <Input
                    id={`whatsapp-${provider.id}-instance-id`}
                    placeholder="Paste this provider's Instance ID"
                    value={config.instanceId}
                    onChange={(event) => updateProvider(provider.id, { instanceId: event.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  {savedProviders[provider.id] ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>
                  ) : 'Changes are not saved until you select Save Provider.'}
                </p>
                <Button type="button" onClick={() => saveProvider(provider.id)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSaving ? 'Saving...' : 'Save Provider'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        QR-code pairing, live connection checks, and message delivery require the gateway's instance-management
        endpoints. The supplied API reference currently documents sending endpoints only; no QR or connection
        endpoint is assumed here.
      </p>
    </div>
  );
}
