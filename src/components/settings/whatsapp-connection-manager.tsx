'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, CircleAlert, Loader2, MessageSquare, QrCode, RefreshCw, RotateCcw, Send, Signal, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export type WhatsAppConnectionConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  instanceId: string;
};

type ConnectionState = 'unknown' | 'connected' | 'connecting' | 'disconnected';
type GatewayPayload = Record<string, any>;

function readValue(payload: GatewayPayload, keys: string[]): any {
  const sources = [payload, payload?.data, payload?.instance, payload?.data?.instance].filter(Boolean);
  for (const source of sources) {
    for (const key of keys) if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

function normalizeStatus(payload: GatewayPayload): ConnectionState {
  const raw = String(readValue(payload, ['status', 'connectionStatus', 'state']) ?? '').toLowerCase();
  if (['connected', 'open', 'ready', 'authenticated', 'online'].includes(raw) || readValue(payload, ['connected', 'isConnected']) === true) return 'connected';
  if (['connecting', 'qr', 'pairing', 'initializing', 'starting'].includes(raw)) return 'connecting';
  if (['disconnected', 'close', 'closed', 'offline', 'logged_out', 'logout'].includes(raw) || readValue(payload, ['connected', 'isConnected']) === false) return 'disconnected';
  return 'unknown';
}

function getQr(payload: GatewayPayload): string {
  const value = readValue(payload, ['qr', 'qrCode', 'qrcode', 'qr_code', 'pairingCode', 'pairing_code']);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return String(value.data ?? value.qr ?? value.code ?? '');
  return '';
}

function getExpiryMs(payload: GatewayPayload): number {
  const expiresAt = readValue(payload, ['expiresAt', 'expires_at', 'qrExpiresAt', 'qr_expires_at']);
  if (expiresAt) {
    const parsed = typeof expiresAt === 'number' ? (expiresAt < 1e12 ? expiresAt * 1000 : expiresAt) : Date.parse(String(expiresAt));
    if (Number.isFinite(parsed) && parsed > Date.now()) return parsed;
  }
  const seconds = Number(readValue(payload, ['expiresIn', 'expires_in', 'qrExpiresIn', 'qr_expires_in']));
  return Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
}

async function readResponse(response: Response): Promise<GatewayPayload> {
  const text = await response.text();
  let body: GatewayPayload = {};
  if (text) {
    try { body = JSON.parse(text); } catch { body = { message: text }; }
  }
  if (!response.ok) throw new Error(body.message || body.error || `Gateway request failed (${response.status})`);
  if (body.success === false || body.ok === false) throw new Error(body.message || body.error || 'The WhatsApp gateway rejected the request.');
  return body;
}

export function WhatsAppConnectionManager({ config }: { config: WhatsAppConnectionConfig }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [connectionState, setConnectionState] = React.useState<ConnectionState>('unknown');
  const [qrValue, setQrValue] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [testNumber, setTestNumber] = React.useState('');
  const [testMessage, setTestMessage] = React.useState('This is a test message from your hotel management system. WhatsApp connection is working.');
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const previousState = React.useRef<ConnectionState>('unknown');
  const refreshInFlight = React.useRef(false);

  const configured = Boolean(config.baseUrl.trim() && config.apiKey.trim() && config.instanceId.trim());
  const endpoint = React.useMemo(() => config.baseUrl.trim().replace(/\/+$/, '').replace(/\/api$/i, ''), [config.baseUrl]);

  const request = React.useCallback(async (path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) => {
    if (!configured) throw new Error('Save the WhatsApp API URL, API Key, and Instance ID first.');
    const headers: Record<string, string> = { Accept: 'application/json', 'X-API-Key': config.apiKey.trim(), 'X-Instance-ID': config.instanceId.trim() };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${endpoint}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
    });
    return readResponse(response);
  }, [configured, config.apiKey, config.instanceId, endpoint]);

  const applyStatus = React.useCallback((payload: GatewayPayload, notify = true) => {
    const next = normalizeStatus(payload);
    setLastChecked(new Date());
    if (next !== 'unknown') {
      const previous = previousState.current;
      setConnectionState(next);
      previousState.current = next;
      if (notify && previous !== 'unknown' && previous !== next) {
        if (next === 'connected') toast({ title: 'WhatsApp connected successfully', description: 'Your WhatsApp device is linked and ready to send messages.' });
        if (next === 'disconnected') toast({ variant: 'destructive', title: 'WhatsApp disconnected', description: 'The linked WhatsApp device is no longer connected.' });
      } else if (notify && next === 'connected' && previous === 'unknown') {
        toast({ title: 'WhatsApp is connected', description: 'Your linked WhatsApp device is ready.' });
      }
    }
    const qr = getQr(payload);
    if (qr) {
      setQrValue(qr);
      setExpiresAt(getExpiryMs(payload));
    }
    return next;
  }, [toast]);

  const checkStatus = React.useCallback(async (showToast = false) => {
    if (!configured) {
      if (showToast) toast({ variant: 'destructive', title: 'WhatsApp is not configured', description: 'Enter and save the API URL, API Key, and Instance ID first.' });
      return;
    }
    setIsChecking(true);
    try {
      const payload = await request(`/api/instances/${encodeURIComponent(config.instanceId.trim())}`);
      const status = applyStatus(payload, showToast);
      if (showToast) toast({ title: 'WhatsApp status refreshed', description: status === 'unknown' ? 'The gateway responded, but did not include a recognized connection status.' : `Connection status: ${status}.` });
    } catch (error: any) {
      if (showToast) toast({ variant: 'destructive', title: 'Could not retrieve WhatsApp status', description: error?.message || 'Check the gateway URL and credentials.' });
    } finally {
      setIsChecking(false);
    }
  }, [applyStatus, config.instanceId, configured, request, toast]);

  const startConnection = React.useCallback(async (isReconnect = false) => {
    if (!configured) {
      toast({ variant: 'destructive', title: 'WhatsApp is not configured', description: 'Enter and save the API URL, API Key, and Instance ID first.' });
      return;
    }
    setIsConnecting(true);
    setConnectionState('connecting');
    try {
      const payload = await request(`/api/instances/${encodeURIComponent(config.instanceId.trim())}/start`, 'POST', {});
      const qr = getQr(payload);
      if (qr) {
        setQrValue(qr);
        setExpiresAt(getExpiryMs(payload));
      }
      const state = applyStatus(payload, false);
      if (state === 'connected') {
        setQrValue('');
        setDialogOpen(false);
        previousState.current = 'connected';
        toast({ title: 'WhatsApp connected successfully', description: 'Your WhatsApp device is already linked and ready.' });
      } else {
        setDialogOpen(true);
        toast({ title: isReconnect ? 'Reconnection started' : 'WhatsApp connection started', description: qr ? 'Scan the QR code with WhatsApp on your phone.' : 'Waiting for the gateway to provide a QR code.' });
      }
    } catch (error: any) {
      setConnectionState('disconnected');
      toast({ variant: 'destructive', title: 'Could not start WhatsApp connection', description: error?.message || 'Check the gateway and try again.' });
    } finally {
      setIsConnecting(false);
    }
  }, [applyStatus, config.instanceId, configured, request, toast]);

  const refreshQr = React.useCallback(async (automatic = false) => {
    if (refreshInFlight.current || !configured) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      const payload = await request(`/instances/${encodeURIComponent(config.instanceId.trim())}/start`, 'POST', {});
      const qr = getQr(payload);
      if (qr) {
        setQrValue(qr);
        setExpiresAt(getExpiryMs(payload));
        if (!automatic) toast({ title: 'New QR code generated', description: 'Scan the refreshed QR code with your WhatsApp phone.' });
      } else {
        applyStatus(payload, true);
        if (!automatic) toast({ variant: 'destructive', title: 'QR code not available', description: 'The gateway did not return a QR code. Refresh again in a moment.' });
      }
    } catch (error: any) {
      if (!automatic) toast({ variant: 'destructive', title: 'Could not refresh QR code', description: error?.message || 'Please try again.' });
    } finally {
      setIsRefreshing(false);
      refreshInFlight.current = false;
    }
  }, [applyStatus, config.instanceId, configured, request, toast]);

  React.useEffect(() => {
    if (!configured) return;
    void checkStatus(false);
    const timer = window.setInterval(() => { void checkStatus(false); }, dialogOpen ? 3000 : 15000);
    return () => window.clearInterval(timer);
  }, [configured, dialogOpen, checkStatus]);

  React.useEffect(() => {
    if (!dialogOpen || !expiresAt) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [dialogOpen, expiresAt]);

  React.useEffect(() => {
    if (!dialogOpen || !expiresAt || secondsLeft > 0 || !qrValue) return;
    void refreshQr(true);
  }, [dialogOpen, expiresAt, qrValue, secondsLeft, refreshQr]);

  const sendTestMessage = async () => {
    const number = testNumber.replace(/[^0-9]/g, '');
    if (!number || number.length < 8) {
      toast({ variant: 'destructive', title: 'Enter a valid phone number', description: 'Include the country code, for example 2348012345678.' });
      return;
    }
    if (!testMessage.trim()) {
      toast({ variant: 'destructive', title: 'Message is empty', description: 'Enter a short test message.' });
      return;
    }
    setIsSendingTest(true);
    try {
      await request('/api/send/text', 'POST', { number, message: testMessage.trim() });
      toast({ title: 'Test message sent', description: `The gateway accepted the test message for +${number}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Test message failed', description: error?.message || 'Confirm WhatsApp is connected and try again.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const statusLabel = connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting' : connectionState === 'disconnected' ? 'Disconnected' : 'Not checked';
  const StatusIcon = connectionState === 'connected' ? CheckCircle2 : connectionState === 'disconnected' ? WifiOff : connectionState === 'connecting' ? Loader2 : CircleAlert;

  return (
    <>
      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="font-medium">WhatsApp device connection</h3>
            <div className="flex items-center gap-2 text-sm">
              <StatusIcon className={`h-4 w-4 ${connectionState === 'connected' ? 'text-emerald-600' : connectionState === 'disconnected' ? 'text-destructive' : 'text-muted-foreground'} ${connectionState === 'connecting' ? 'animate-spin' : ''}`} />
              <span className="font-medium">{statusLabel}</span>
              {lastChecked && <span className="text-xs text-muted-foreground">· Checked {lastChecked.toLocaleTimeString()}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void startConnection(true)} disabled={!configured || isConnecting}><RotateCcw className="mr-2 h-4 w-4" />Reconnect</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void refreshQr(false)} disabled={!configured || isRefreshing}><RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />Refresh</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void checkStatus(true)} disabled={!configured || isChecking}><Signal className="mr-2 h-4 w-4" />Status</Button>
            <Button type="button" size="sm" onClick={() => void startConnection(false)} disabled={!configured || isConnecting}><QrCode className="mr-2 h-4 w-4" />Connect</Button>
          </div>
        </div>
        {!configured && <p className="text-xs text-muted-foreground">Save the API Base URL, API Key, and Instance ID above to enable connection controls.</p>}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /><h3 className="font-medium">Send a test message</h3></div>
        <p className="text-sm text-muted-foreground">Send a real WhatsApp message to confirm that the gateway and linked device can deliver messages.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="whatsapp-test-number">Recipient phone number</Label><Input id="whatsapp-test-number" inputMode="tel" placeholder="2348012345678" value={testNumber} onChange={event => setTestNumber(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="whatsapp-test-message">Test message</Label><Input id="whatsapp-test-message" value={testMessage} onChange={event => setTestMessage(event.target.value)} /></div>
        </div>
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => void sendTestMessage()} disabled={!configured || isSendingTest}><Send className="mr-2 h-4 w-4" />{isSendingTest ? 'Sending test...' : 'Send Test Message'}</Button></div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp</DialogTitle>
            <DialogDescription>Open WhatsApp on your phone, go to Linked devices, choose Link a device, then scan this QR code.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrValue ? <div className="flex h-64 w-64 items-center justify-center rounded-xl border bg-white p-3">{/^data:image\//i.test(qrValue) || /^https?:\/\//i.test(qrValue) ? <img src={qrValue} alt="WhatsApp device pairing QR code" className="h-full w-full object-contain" /> : <QRCodeSVG value={qrValue} size={240} level="M" includeMargin />}</div> : <div className="flex h-64 w-64 items-center justify-center rounded-xl border bg-muted/30"><div className="space-y-3 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Waiting for QR code from gateway...</p></div></div>}
            <div className="w-full rounded-lg bg-muted/50 p-3 text-center">
              {connectionState === 'connected' ? <p className="font-medium text-emerald-600">Device linked successfully</p> : <p className="text-sm font-medium">{secondsLeft > 0 ? `QR code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'QR code expired — generating a new one...'}</p>}
              <p className="mt-1 text-xs text-muted-foreground">The connection status is checked automatically while this window is open.</p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => void refreshQr(false)} disabled={isRefreshing}><RefreshCw className="mr-2 h-4 w-4" />Generate New QR</Button>
            <Button type="button" onClick={() => void checkStatus(true)} disabled={isChecking}><Signal className="mr-2 h-4 w-4" />Check Connection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
