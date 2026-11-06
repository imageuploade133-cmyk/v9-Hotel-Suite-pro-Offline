'use client';

import * as React from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { PagePermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, Users, UserRound } from 'lucide-react';

export function POSCustomerAccessSettings() {
  const firestore = useFirestore();
  const { settings, refreshSettings, isLoading } = useSettings();
  const { user, userProfile, permissions } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const canManage = permissions.includes(PagePermission.MANAGE_GENERAL_SETTINGS);
  const allowAllCustomers = settings?.posUsersCanViewAllCustomers === true;

  const updateVisibility = async (enabled: boolean) => {
    if (!canManage) {
      toast({ title: 'Permission denied', description: 'You do not have permission to change POS customer access.', variant: 'destructive' });
      return;
    }
    if (!firestore || !user) {
      toast({ title: 'Unable to save', description: 'The settings service is not ready. Please try again.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const update = {
      posUsersCanViewAllCustomers: enabled,
      posCustomerAccessUpdatedAt: new Date().toISOString(),
      posCustomerAccessUpdatedByUid: user.uid,
      posCustomerAccessUpdatedByName: userProfile?.name || user.displayName || user.email || 'Administrator',
    };

    try {
      await setDoc(doc(firestore, 'settings', 'global'), update, { merge: true });
      try {
        const response = await fetch('/api/lan-sync/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionName: 'settings', docId: 'global', action: 'set', data: update }),
        });
        if (!response.ok) console.warn('[POS Customer Access] LAN settings mirror returned:', response.status);
      } catch (lanError) {
        console.warn('[POS Customer Access] LAN settings mirror failed:', lanError);
      }
      refreshSettings();
      toast({
        title: 'POS Customer Access Updated',
        description: enabled
          ? 'All POS users can now search every existing POS customer.'
          : 'POS users can now search only customers they registered.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: 'Could not update setting', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return (
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Administrator permission required</AlertTitle>
        <AlertDescription>Only users with Manage General Settings permission can change POS customer visibility.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>POS Customer Visibility</CardTitle>
          <Badge variant={allowAllCustomers ? 'default' : 'secondary'}>{allowAllCustomers ? 'Shared access' : 'Private access'}</Badge>
        </div>
        <CardDescription>Control whether POS staff can search all registered POS customers or only the customers they personally registered.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex min-w-0 items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <Label htmlFor="pos-all-customer-access" className="text-base font-semibold">Allow users to see all POS customers</Label>
              <p className="text-sm text-muted-foreground">ON: every POS user can search all existing POS customers, including customers registered by other staff.</p>
            </div>
          </div>
          <Switch id="pos-all-customer-access" checked={allowAllCustomers} onCheckedChange={updateVisibility} disabled={isSaving || isLoading} aria-label="Allow all POS users to see all POS customers" />
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">{allowAllCustomers ? 'Shared customer directory is enabled' : 'Private customer access is enabled'}</p>
            <p className="text-sm text-muted-foreground">
              {allowAllCustomers
                ? 'POS customer search includes every customer in the active branch or global POS customer collection.'
                : 'POS customer search is limited to records carrying the signed-in user’s creator ID. Newly registered POS customers are automatically tagged with that ID.'}
            </p>
          </div>
        </div>
        {isSaving && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Saving customer access policy…</p>}
      </CardContent>
    </Card>
  );
}
