'use client';

import * as React from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Palette, Rows3, RotateCcw } from 'lucide-react';
import { firestoreCache, CacheKeys, CacheTTL } from '@/lib/firestore-cache';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

const DEFAULTS = {
  menuItemsPerPage: 6,
  menuCardBorderEnabled: true,
  menuCardBorderColor: '#E5E7EB',
  menuButtonColor: '#2563EB',
};

const MIN_ITEMS_PER_PAGE = 1;
const MAX_ITEMS_PER_PAGE = 48;

function normalizeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function MenuProductCardSettingsForm() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { toast } = useToast();
  const [itemsPerPage, setItemsPerPage] = React.useState(DEFAULTS.menuItemsPerPage);
  const [borderEnabled, setBorderEnabled] = React.useState(DEFAULTS.menuCardBorderEnabled);
  const [borderColor, setBorderColor] = React.useState(DEFAULTS.menuCardBorderColor);
  const [buttonColor, setButtonColor] = React.useState(DEFAULTS.menuButtonColor);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const savedCount = Number(settings?.menuItemsPerPage);
    setItemsPerPage(Number.isFinite(savedCount)
      ? Math.min(MAX_ITEMS_PER_PAGE, Math.max(MIN_ITEMS_PER_PAGE, Math.round(savedCount)))
      : DEFAULTS.menuItemsPerPage);
    setBorderEnabled(settings?.menuCardBorderEnabled ?? DEFAULTS.menuCardBorderEnabled);
    setBorderColor(normalizeHexColor(settings?.menuCardBorderColor, DEFAULTS.menuCardBorderColor));
    setButtonColor(normalizeHexColor(settings?.menuButtonColor, DEFAULTS.menuButtonColor));
  }, [settings]);

  const handleSave = async () => {
    if (!firestore || !user) {
      toast({
        title: 'Settings unavailable',
        description: 'Please wait until your account and local database are ready, then try again.',
        variant: 'destructive',
      });
      return;
    }

    const safeCount = Math.min(MAX_ITEMS_PER_PAGE, Math.max(MIN_ITEMS_PER_PAGE, Math.round(Number(itemsPerPage) || DEFAULTS.menuItemsPerPage)));
    const data = {
      menuItemsPerPage: safeCount,
      menuCardBorderEnabled: borderEnabled,
      menuCardBorderColor: normalizeHexColor(borderColor, DEFAULTS.menuCardBorderColor),
      menuButtonColor: normalizeHexColor(buttonColor, DEFAULTS.menuButtonColor),
    };

    setIsSaving(true);
    try {
      // Firestore persistence is offline-first in this project: writes are queued
      // locally while disconnected and synchronized when connectivity returns.
      await setDoc(doc(firestore, 'settings', 'global'), data, { merge: true });

      const mergedSettings = { ...settings, ...data };
      try {
        localStorage.setItem('app_saved_settings', JSON.stringify(mergedSettings));
      } catch (storageError) {
        console.warn('[Menu Card Settings] Could not update local settings snapshot:', storageError);
      }
      firestoreCache.set(CacheKeys.settings(), mergedSettings, CacheTTL.HOUR);

      // On the Local Master, mirror the same global settings document into the
      // filesystem-backed LAN store so connected offline devices read one value.
      if (isLocalMasterHost()) {
        try {
          const response = await fetch('/api/lan-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectionName: 'settings',
              docId: 'global',
              action: 'set',
              data,
            }),
          });
          if (!response.ok) {
            console.warn('[Menu Card Settings] Local Master mirror was not accepted:', response.status);
          }
        } catch (lanError) {
          // Firestore has already accepted/queued the offline-first write.
          console.warn('[Menu Card Settings] Local Master mirror is temporarily unavailable:', lanError);
        }
      }

      toast({
        title: 'Product Card Settings Saved',
        description: 'Your card layout, border and button colors have been updated.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Could not save settings',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setItemsPerPage(DEFAULTS.menuItemsPerPage);
    setBorderEnabled(DEFAULTS.menuCardBorderEnabled);
    setBorderColor(DEFAULTS.menuCardBorderColor);
    setButtonColor(DEFAULTS.menuButtonColor);
  };

  const isBusy = settingsLoading || isSaving;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle>Menu Product Card Display</CardTitle>
            <CardDescription>
              Control how many menu products appear on each page and customize their card borders and action button.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
          <div className="space-y-1">
            <Label htmlFor="menu-items-per-page" className="font-medium">Products per page</Label>
            <p className="text-sm text-muted-foreground">
              Number of product cards to load and display before Previous / Next pagination is used. Choose between 1 and 48.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Rows3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              id="menu-items-per-page"
              type="number"
              min={MIN_ITEMS_PER_PAGE}
              max={MAX_ITEMS_PER_PAGE}
              step={1}
              value={itemsPerPage}
              disabled={isBusy}
              onChange={(event) => setItemsPerPage(Number(event.target.value))}
              onBlur={() => setItemsPerPage(current => Math.min(MAX_ITEMS_PER_PAGE, Math.max(MIN_ITEMS_PER_PAGE, Math.round(Number(current) || DEFAULTS.menuItemsPerPage))))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="menu-card-border-enabled" className="font-medium">Show product card border</Label>
            <p className="text-sm text-muted-foreground">Turn the outline around each product card on or off.</p>
          </div>
          <Switch id="menu-card-border-enabled" checked={borderEnabled} disabled={isBusy} onCheckedChange={setBorderEnabled} />
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_220px] sm:items-center">
          <div className="space-y-1">
            <Label htmlFor="menu-card-border-color" className="font-medium">Product card border color</Label>
            <p className="text-sm text-muted-foreground">Choose the border color used when product card borders are enabled.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="menu-card-border-color"
              type="color"
              value={borderColor}
              disabled={isBusy || !borderEnabled}
              onChange={(event) => setBorderColor(event.target.value)}
              className="h-10 w-14 cursor-pointer p-1"
            />
            <Input
              value={borderColor}
              disabled={isBusy || !borderEnabled}
              onChange={(event) => setBorderColor(event.target.value)}
              aria-label="Product card border hex color"
              maxLength={7}
              className="font-mono uppercase"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_220px] sm:items-center">
          <div className="space-y-1">
            <Label htmlFor="menu-button-color" className="font-medium">Product button color</Label>
            <p className="text-sm text-muted-foreground">Changes the Add to Cart and Place Order buttons in the menu ordering screen.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="menu-button-color"
              type="color"
              value={buttonColor}
              disabled={isBusy}
              onChange={(event) => setButtonColor(event.target.value)}
              className="h-10 w-14 cursor-pointer p-1"
            />
            <Input
              value={buttonColor}
              disabled={isBusy}
              onChange={(event) => setButtonColor(event.target.value)}
              aria-label="Product button hex color"
              maxLength={7}
              className="font-mono uppercase"
            />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">Live preview</p>
          <div
            className="rounded-xl bg-card p-4"
            style={{
              borderStyle: 'solid',
              borderWidth: borderEnabled ? 1 : 0,
              borderColor: borderEnabled ? borderColor : 'transparent',
            }}
          >
            <p className="font-semibold">Sample menu product</p>
            <p className="mt-1 text-sm text-muted-foreground">Preview of the product card outline and action button.</p>
            <div className="mt-3">
              <Button type="button" style={{ backgroundColor: buttonColor }} disabled> Add to Cart </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3 border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={handleReset} disabled={isBusy}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Preview
        </Button>
        <Button type="button" onClick={handleSave} disabled={isBusy}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Product Card Settings
        </Button>
      </CardFooter>
    </Card>
  );
}
