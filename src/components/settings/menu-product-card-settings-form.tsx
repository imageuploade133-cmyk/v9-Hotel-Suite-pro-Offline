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
import { Loader2, Palette, Rows3, RotateCcw, Monitor, Smartphone, LayoutGrid } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { firestoreCache, CacheKeys, CacheTTL } from '@/lib/firestore-cache';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

const DEFAULTS = {
  menuItemsPerPage: 6,
  menuCardBorderEnabled: true,
  menuCardBorderColor: '#E5E7EB',
  menuButtonColor: '#2563EB',
  menuProductGridColumnsDesktop: 2,
  menuProductGridColumnsMobile: 2,
};

const MIN_DESKTOP_COLUMNS = 1;
const MAX_DESKTOP_COLUMNS = 6;
const MIN_MOBILE_COLUMNS = 1;
const MAX_MOBILE_COLUMNS = 3;

function normalizeGridColumns(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

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
  const [desktopColumns, setDesktopColumns] = React.useState(DEFAULTS.menuProductGridColumnsDesktop);
  const [mobileColumns, setMobileColumns] = React.useState(DEFAULTS.menuProductGridColumnsMobile);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const savedCount = Number(settings?.menuItemsPerPage);
    setItemsPerPage(Number.isFinite(savedCount)
      ? Math.min(MAX_ITEMS_PER_PAGE, Math.max(MIN_ITEMS_PER_PAGE, Math.round(savedCount)))
      : DEFAULTS.menuItemsPerPage);
    setBorderEnabled(settings?.menuCardBorderEnabled ?? DEFAULTS.menuCardBorderEnabled);
    setBorderColor(normalizeHexColor(settings?.menuCardBorderColor, DEFAULTS.menuCardBorderColor));
    setButtonColor(normalizeHexColor(settings?.menuButtonColor, DEFAULTS.menuButtonColor));
    setDesktopColumns(normalizeGridColumns(
      settings?.menuProductGridColumnsDesktop,
      MIN_DESKTOP_COLUMNS,
      MAX_DESKTOP_COLUMNS,
      DEFAULTS.menuProductGridColumnsDesktop
    ));
    setMobileColumns(normalizeGridColumns(
      settings?.menuProductGridColumnsMobile,
      MIN_MOBILE_COLUMNS,
      MAX_MOBILE_COLUMNS,
      DEFAULTS.menuProductGridColumnsMobile
    ));
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
    if (!/^#[0-9a-fA-F]{6}$/.test(borderColor) || !/^#[0-9a-fA-F]{6}$/.test(buttonColor)) {
      toast({ title: 'Invalid color', description: 'Enter a valid six-digit HEX color, for example #2563EB.', variant: 'destructive' });
      return;
    }

    const data = {
      menuItemsPerPage: safeCount,
      menuCardBorderEnabled: borderEnabled,
      menuCardBorderColor: borderColor.toUpperCase(),
      menuButtonColor: buttonColor.toUpperCase(),
      menuProductGridColumnsDesktop: normalizeGridColumns(
        desktopColumns,
        MIN_DESKTOP_COLUMNS,
        MAX_DESKTOP_COLUMNS,
        DEFAULTS.menuProductGridColumnsDesktop
      ),
      menuProductGridColumnsMobile: normalizeGridColumns(
        mobileColumns,
        MIN_MOBILE_COLUMNS,
        MAX_MOBILE_COLUMNS,
        DEFAULTS.menuProductGridColumnsMobile
      ),
    };

    setIsSaving(true);
    try {
      // Publish the new values to this device immediately. Firestore's persistent
      // cache then synchronizes the same settings when internet becomes available.
      const mergedSettings = { ...settings, ...data };
      try {
        localStorage.setItem('app_saved_settings', JSON.stringify(mergedSettings));
      } catch (storageError) {
        console.warn('[Menu Card Settings] Could not update local settings snapshot:', storageError);
      }
      firestoreCache.set(CacheKeys.settings(), mergedSettings, CacheTTL.HOUR);

      // Mirror to the Local Master first so LAN-only devices can use the setting
      // even when the internet connection is unavailable.
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
          console.warn('[Menu Card Settings] Local Master mirror is temporarily unavailable:', lanError);
        }
      }

      // Firestore persistent local cache queues this write while offline and
      // synchronizes it after reconnecting. Do not block the local UI indefinitely.
      let writeTimer: ReturnType<typeof setTimeout> | undefined;
      const firestoreWrite = setDoc(doc(firestore, 'settings', 'global'), data, { merge: true });
      const writeResult = await Promise.race([
        firestoreWrite.then(() => 'synced' as const),
        new Promise<'queued'>((resolve) => { writeTimer = setTimeout(() => resolve('queued'), 4000); }),
      ]);
      if (writeTimer) clearTimeout(writeTimer);
      if (writeResult === 'queued') {
        firestoreWrite.catch(error => console.warn('[Menu Card Settings] Firestore sync is still pending:', error));
      }

      toast({
        title: writeResult === 'synced' ? 'Product Card Settings Saved' : 'Settings Saved on This Device',
        description: writeResult === 'synced'
          ? 'Your POS card layout, page size, border and button colors have been updated.'
          : 'Your settings are available locally and will synchronize with Firestore when the connection is restored.',
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
    setDesktopColumns(DEFAULTS.menuProductGridColumnsDesktop);
    setMobileColumns(DEFAULTS.menuProductGridColumnsMobile);
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
              Customize the Point of Sale product grid for desktop and mobile, choose how many products appear before pagination, and style card borders and buttons.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
          <div className="space-y-1">
            <Label htmlFor="menu-items-per-page" className="font-medium">Products per page</Label>
            <p className="text-sm text-muted-foreground">
              Total products shown on each POS page before Previous / Next is used. This is separate from the number of cards in each row. Choose between 1 and 48.
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

        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Point of Sale product grid</p>
              <p className="text-sm text-muted-foreground">
                Choose how many product cards fit across each row. Fewer columns make cards larger and easier to tap. These settings affect the POS product list only.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pos-desktop-grid-columns" className="flex items-center gap-2 font-medium">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Desktop cards per row
              </Label>
              <Select
                value={String(desktopColumns)}
                onValueChange={(value) => setDesktopColumns(normalizeGridColumns(value, MIN_DESKTOP_COLUMNS, MAX_DESKTOP_COLUMNS, DEFAULTS.menuProductGridColumnsDesktop))}
                disabled={isBusy}
              >
                <SelectTrigger id="pos-desktop-grid-columns">
                  <SelectValue placeholder="Choose desktop columns" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_DESKTOP_COLUMNS }, (_, index) => index + 1).map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} {count === 1 ? 'card' : 'cards'} per row
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Choose 1–6 cards per row on tablet/desktop-sized screens.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-mobile-grid-columns" className="flex items-center gap-2 font-medium">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                Mobile cards per row
              </Label>
              <Select
                value={String(mobileColumns)}
                onValueChange={(value) => setMobileColumns(normalizeGridColumns(value, MIN_MOBILE_COLUMNS, MAX_MOBILE_COLUMNS, DEFAULTS.menuProductGridColumnsMobile))}
                disabled={isBusy}
              >
                <SelectTrigger id="pos-mobile-grid-columns">
                  <SelectValue placeholder="Choose mobile columns" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_MOBILE_COLUMNS }, (_, index) => index + 1).map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} {count === 1 ? 'card' : 'cards'} per row
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Choose 1–3 cards per row on smaller phone screens.</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Monitor className="h-3.5 w-3.5" /> Desktop preview
              </p>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${desktopColumns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="min-w-0 rounded border bg-card p-1.5">
                    <div className="aspect-square rounded-sm bg-primary/10" />
                    <div className="mt-1 h-1.5 rounded-full bg-muted-foreground/25" />
                    <div className="mt-1 h-1 rounded-full bg-primary/30" />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{desktopColumns} {desktopColumns === 1 ? 'card' : 'cards'} across each row</p>
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" /> Mobile preview
              </p>
              <div className="mx-auto w-full max-w-[220px] rounded-lg border bg-background p-2">
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="min-w-0 rounded border bg-card p-1">
                      <div className="aspect-square rounded-sm bg-primary/10" />
                      <div className="mt-1 h-1 rounded-full bg-muted-foreground/25" />
                      <div className="mt-1 h-1 rounded-full bg-primary/30" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">{mobileColumns} {mobileColumns === 1 ? 'card' : 'cards'} across each row</p>
            </div>
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
            <p className="text-sm text-muted-foreground">Applies to Add to Cart buttons in Point of Sale and Add to Cart / Place Order buttons in the online menu.</p>
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
