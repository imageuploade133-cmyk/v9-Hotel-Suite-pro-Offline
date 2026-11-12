'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, CreditCard, Loader2, Save, ShieldCheck } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/branch-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import {
  EMPTY_POS_BANK_DETAILS,
  normalizePosBankDetails,
  posStaffBankPendingKey,
  posStaffBankStorageKey,
  type PosBankDetails,
  getOfflinePosBankLogoKey,
  getOfflinePosBankLogo,
  saveOfflinePosBankLogo,
  uploadPosBankLogo,
} from '@/components/pos/pos-receipt-bank-details';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';
import { useSettings } from '@/contexts/settings-context';
import { Switch } from '@/components/ui/switch';

function MyPOSAccountSettingsPage() {
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [bankLogoFile, setBankLogoFile] = React.useState<File | null>(null);
  const uid = user?.uid;
  const [valuesState, setValuesState] = React.useState<{ uid?: string; values: PosBankDetails }>({
    uid,
    values: EMPTY_POS_BANK_DETAILS,
  });
  const values = valuesState.uid === uid ? valuesState.values : EMPTY_POS_BANK_DETAILS;
  const setValues = React.useCallback<React.Dispatch<React.SetStateAction<PosBankDetails>>>((nextValues) => {
    setValuesState(current => ({
      uid,
      values: typeof nextValues === 'function'
        ? (nextValues as (current: PosBankDetails) => PosBankDetails)(current.uid === uid ? current.values : EMPTY_POS_BANK_DETAILS)
        : nextValues,
    }));
  }, [uid]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!uid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      const cached = localStorage.getItem(posStaffBankStorageKey(uid));
      if (cached) setValues(normalizePosBankDetails(JSON.parse(cached)));
    } catch {}

    const loadFromLocalMaster = async () => {
      if (!isLocalMasterHost()) return;
      try {
        const response = await fetch('/api/lan-sync?collection=posStaffAccountSettings');
        if (!response.ok) return;
        const payload = await response.json();
        const record = payload?.data?.[uid];
        if (record && active) {
          const data = normalizePosBankDetails(record);
          setValues(data);
          try { localStorage.setItem(posStaffBankStorageKey(uid), JSON.stringify(data)); } catch {}
        }
      } catch (error) {
        console.warn('[My POS Account Settings] Local Master lookup failed:', error);
      }
    };

    const load = async () => {
      if (!firestore) {
        await loadFromLocalMaster();
        if (active) setIsLoading(false);
        return;
      }
      try {
        const ref = doc(firestore, 'posStaffAccountSettings', uid);
        const pending = (() => {
          try { return localStorage.getItem(posStaffBankPendingKey(uid)) === '1'; }
          catch { return false; }
        })();
        if (pending && typeof navigator !== 'undefined' && navigator.onLine) {
          let cached = normalizePosBankDetails(JSON.parse(localStorage.getItem(posStaffBankStorageKey(uid)) || '{}'));
          const offlineLogoKey = getOfflinePosBankLogoKey(cached.bankLogoUrl);
          if (offlineLogoKey) {
            const offlineLogo = await getOfflinePosBankLogo(offlineLogoKey);
            if (offlineLogo) cached.bankLogoUrl = await uploadPosBankLogo(offlineLogo, settings?.imgbbApiKey || '162d7a9c40da4493e504e77f14e5efb4');
          }
          await setDoc(ref, { ...cached, uid, updatedAt: new Date().toISOString() }, { merge: true });
          setValues(cached);
          localStorage.setItem(posStaffBankStorageKey(uid), JSON.stringify(cached));
          localStorage.removeItem(posStaffBankPendingKey(uid));
          return;
        }
        const snapshot = await getDoc(ref);
        if (!active) return;
        if (snapshot.exists()) {
          const data = normalizePosBankDetails(snapshot.data() as Partial<PosBankDetails>);
          setValues(data);
          try {
            localStorage.setItem(posStaffBankStorageKey(uid), JSON.stringify(data));
            localStorage.removeItem(posStaffBankPendingKey(uid));
          } catch {}
        } else {
          await loadFromLocalMaster();
        }
      } catch (error) {
        console.warn('[My POS Account Settings] Using local account details:', error);
        const pending = (() => {
          try { return localStorage.getItem(posStaffBankPendingKey(uid)) === '1'; }
          catch { return false; }
        })();
        if (!pending) await loadFromLocalMaster();
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [uid, firestore]);

  const update = <K extends keyof PosBankDetails>(field: K, value: PosBankDetails[K]) => {
    setValues(current => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uid) return;

    const cleaned = normalizePosBankDetails(values);
    if (cleaned.accountNumber && !/^[0-9]{4,34}$/.test(cleaned.accountNumber)) {
      toast({ variant: 'destructive', title: 'Check account number', description: 'Enter 4–34 digits without spaces.' });
      return;
    }
    if ((cleaned.accountName || cleaned.accountNumber) && !cleaned.bankName) {
      toast({ variant: 'destructive', title: 'Bank name required', description: 'Enter the bank name when adding account details.' });
      return;
    }
    if ((cleaned.bankName || cleaned.accountNumber) && !cleaned.accountName) {
      toast({ variant: 'destructive', title: 'Account name required', description: 'Enter the account holder name.' });
      return;
    }

    setIsSaving(true);
    try {
      if (bankLogoFile) {
        const apiKey = settings?.imgbbApiKey || '162d7a9c40da4493e504e77f14e5efb4';
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            cleaned.bankLogoUrl = await uploadPosBankLogo(bankLogoFile, apiKey);
          } catch (uploadError) {
            cleaned.bankLogoUrl = await saveOfflinePosBankLogo(`staff:${uid}`, bankLogoFile);
            console.warn('[My POS Account Settings] ImgBB upload deferred:', uploadError);
          }
        } else {
          cleaned.bankLogoUrl = await saveOfflinePosBankLogo(`staff:${uid}`, bankLogoFile);
        }
      }
      setBankLogoFile(null);
      // Save locally first so the details are immediately available for offline printing.
      localStorage.setItem(posStaffBankStorageKey(uid), JSON.stringify(cleaned));
      localStorage.setItem(posStaffBankPendingKey(uid), '1');
      setValues(cleaned);

      let savedToCloud = false;
      if (isLocalMasterHost()) {
        try {
          const response = await fetch('/api/lan-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectionName: 'posStaffAccountSettings',
              docId: uid,
              action: 'set',
              data: { ...cleaned, uid, updatedAt: new Date().toISOString() },
            }),
          });
          if (!response.ok) throw new Error('Local Master save failed');
        } catch (error) {
          console.warn('[My POS Account Settings] Local Master save deferred:', error);
        }
      }

      if (firestore && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await setDoc(doc(firestore, 'posStaffAccountSettings', uid), {
            ...cleaned,
            uid,
            staffName: userProfile?.name || user?.displayName || '',
            staffEmail: user?.email || '',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          savedToCloud = true;
        } catch (error) {
          console.warn('[My POS Account Settings] Cloud save deferred:', error);
        }
      }

      if (savedToCloud) {
        localStorage.removeItem(posStaffBankPendingKey(uid));
        toast({ title: 'Account details saved', description: 'Your personal bank details will now appear on your POS printouts, taking priority over the business default.' });
      } else {
        toast({ title: 'Saved on this device', description: 'Your details are available for offline POS printing and will sync when the cloud connection is available.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not save details', description: error?.message || 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!uid || isSaving) return;
    const cleared = { ...EMPTY_POS_BANK_DETAILS };
    setBankLogoFile(null);
    setIsSaving(true);
    setValues(cleared);
    try {
      localStorage.setItem(posStaffBankStorageKey(uid), JSON.stringify(cleared));
      localStorage.setItem(posStaffBankPendingKey(uid), '1');
      if (isLocalMasterHost()) {
        try {
          await fetch('/api/lan-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectionName: 'posStaffAccountSettings',
              docId: uid,
              action: 'set',
              data: { ...cleared, uid, updatedAt: new Date().toISOString() },
            }),
          });
        } catch (error) {
          console.warn('[My POS Account Settings] Local Master clear deferred:', error);
        }
      }
      if (firestore && typeof navigator !== 'undefined' && navigator.onLine) {
        await setDoc(doc(firestore, 'posStaffAccountSettings', uid), {
          ...cleared, uid, updatedAt: new Date().toISOString(),
        }, { merge: true });
        localStorage.removeItem(posStaffBankPendingKey(uid));
      }
      toast({ title: 'Personal account details cleared', description: 'Your POS printouts will now use the default account details from POS Settings.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Clear sync pending', description: 'The local details were cleared. Cloud sync will need to complete when online.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3"><CreditCard className="h-7 w-7 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My POS Account Settings</h1>
            <p className="text-sm text-muted-foreground">Manage the bank details displayed on your own POS receipts and dockets.</p>
          </div>
        </div>
        <Button variant="outline" asChild><Link href="/pos"><ArrowLeft className="mr-2 h-4 w-4" />Back to POS</Link></Button>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Your account details are personal to your staff login</AlertTitle>
        <AlertDescription>Only your own POS printouts use these details. If you leave them empty, receipts automatically use the default bank account configured by the administrator in POS Settings.</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Bank Transfer Details</CardTitle>
          <CardDescription>These details can appear on your paid sales, invoices, running-table dockets, draft dockets and terminal receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your saved account details…</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="staff-bank-name">Bank Name</Label>
                <Input id="staff-bank-name" value={values.bankName} onChange={e => update('bankName', e.target.value)} placeholder="e.g. Access Bank" maxLength={100} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-account-name">Account Name</Label>
                <Input id="staff-account-name" value={values.accountName} onChange={e => update('accountName', e.target.value)} placeholder="Name registered with the bank" maxLength={120} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-account-number">Account Number</Label>
                <Input id="staff-account-number" value={values.accountNumber} onChange={e => update('accountNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 34))} placeholder="Enter account number" inputMode="numeric" maxLength={34} autoComplete="off" />
                <p className="text-xs text-muted-foreground">Digits only. Keep this blank to use the administrator’s default account number.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-bank-logo">Bank Logo</Label>
                <Input id="staff-bank-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
                    toast({ variant: 'destructive', title: 'Invalid bank logo', description: 'Choose an image file no larger than 5 MB.' });
                    event.target.value = '';
                    return;
                  }
                  setBankLogoFile(file);
                }} />
                {(bankLogoFile || values.bankLogoUrl) && <div className="flex items-center gap-3 rounded-lg border p-3">
                  {bankLogoFile ? <span className="text-sm">{bankLogoFile.name}</span> : <img src={values.bankLogoUrl} alt="Bank logo" className="max-h-12 max-w-32 object-contain" />}
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setBankLogoFile(null); update('bankLogoUrl', ''); }}>Remove</Button>
                </div>}
                <p className="text-xs text-muted-foreground">This logo appears beside your bank details on terminal and invoice printouts. Maximum 5 MB.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                  <div><Label>Show account details on Docket</Label><p className="text-xs text-muted-foreground">Draft and running-table dockets.</p></div>
                  <Switch checked={values.showAccountOnDocket !== false} onCheckedChange={checked => setValues(current => ({ ...current, showAccountOnDocket: checked }))} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                  <div><Label>Show account details on Paid</Label><p className="text-xs text-muted-foreground">Paid terminal receipts and invoices.</p></div>
                  <Switch checked={values.showAccountOnPaid !== false} onCheckedChange={checked => setValues(current => ({ ...current, showAccountOnPaid: checked }))} />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={handleClear} disabled={isSaving}>Use POS default account</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save My Account Details
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How the account selection works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Your own saved account details are used first.</li>
            <li>Any field you leave empty falls back to the matching business default from POS Settings.</li>
            <li>If neither source has a value, that field is not printed.</li>
          </ol>
          {currentBranch?.name && <p className="mt-3 text-xs">Current branch: {currentBranch.name}. Your personal account details follow your staff login across branches.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(MyPOSAccountSettingsPage, PagePermission.VIEW_POS);
