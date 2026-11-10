'use client';

import * as React from 'react';
import { CalendarDays, ChefHat, Loader2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

type PreferenceKey = 'expandBookingAvailabilityCalendarOnOpen' | 'expandRoomServiceOrdersOnOpen';

export function RoomStatusDisplaySettings() {
  const firestore = useFirestore();
  const { settings, isLoading } = useSettings();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState<PreferenceKey | null>(null);

  const preferences: { key: PreferenceKey; title: string; description: string; icon: React.ElementType }[] = [
    {
      key: 'expandBookingAvailabilityCalendarOnOpen',
      title: 'Booking Availability Calendar',
      description: 'Automatically expand the booking availability calendar when you open Room Status & Bookings.',
      icon: CalendarDays,
    },
    {
      key: 'expandRoomServiceOrdersOnOpen',
      title: 'Room Service & Orders',
      description: 'Automatically expand Room Service & Orders when you open Room Status & Bookings.',
      icon: ChefHat,
    },
  ];

  const handleToggle = async (key: PreferenceKey, enabled: boolean) => {
    if (!firestore || saving) {
      toast({ title: 'Unable to save setting', description: 'Settings storage is not available. Please try again.', variant: 'destructive' });
      return;
    }

    setSaving(key);
    try {
      await setDoc(doc(firestore, 'settings', 'global'), { [key]: enabled }, { merge: true });

      // Keep the existing offline startup cache in sync with this preference.
      try {
        const raw = localStorage.getItem('app_saved_settings');
        const cached = raw ? JSON.parse(raw) : {};
        const nextSettings = cached && typeof cached === 'object' && !Array.isArray(cached) ? cached : {};
        localStorage.setItem('app_saved_settings', JSON.stringify({ ...nextSettings, [key]: enabled }));
      } catch {}

      toast({
        title: 'Display preference saved',
        description: enabled ? 'This section will open expanded by default.' : 'This section will stay collapsed by default.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Could not save display preference',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room Status & Bookings Display Settings</CardTitle>
        <CardDescription>Choose which sections should automatically expand whenever the Room Status & Bookings page is opened. Each preference works independently.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {preferences.map(({ key, title, description, icon: Icon }, index) => (
          <React.Fragment key={key}>
            {index > 0 && <div className="border-t" />}
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {saving === key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  checked={settings?.[key] === true}
                  onCheckedChange={(checked) => void handleToggle(key, checked)}
                  disabled={isLoading || saving !== null || !firestore}
                  aria-label={`Automatically expand ${title}`}
                />
              </div>
            </div>
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}
