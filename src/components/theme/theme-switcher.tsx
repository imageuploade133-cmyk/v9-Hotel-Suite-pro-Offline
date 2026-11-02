'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of your dashboard. Select a theme below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the look and feel of your dashboard. Select a theme below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme === 'dark' ? 'dark' : 'light'}
          onValueChange={setTheme}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <Label
            htmlFor="light"
            className={cn(
              'relative flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground',
              theme === 'light' && 'border-primary'
            )}
          >
            <RadioGroupItem value="light" id="light" className="sr-only" />
            <span className="mb-2 w-full text-center font-semibold">Light</span>
            <div className="w-full rounded-md bg-white p-2 shadow-sm">
              <div className="space-y-2 rounded-sm bg-slate-100 p-2">
                <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-2 w-4/5 rounded-lg bg-slate-300" />
                  <div className="h-2 w-full rounded-lg bg-slate-300" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-300" />
                  <div className="h-2 w-2/3 rounded-lg bg-slate-300" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-300" />
                  <div className="h-2 w-2/3 rounded-lg bg-slate-300" />
                </div>
              </div>
            </div>
          </Label>

          <Label
            htmlFor="dark"
            className={cn(
              'relative flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground',
              theme === 'dark' && 'border-primary'
            )}
          >
            <RadioGroupItem value="dark" id="dark" className="sr-only" />
            <span className="mb-2 w-full text-center font-semibold">Dark</span>
            <div className="w-full rounded-md bg-slate-900 p-2 shadow-sm">
              <div className="space-y-2 rounded-sm bg-slate-800 p-2">
                <div className="space-y-2 rounded-md bg-slate-900 p-2 shadow-sm">
                  <div className="h-2 w-4/5 rounded-lg bg-slate-600" />
                  <div className="h-2 w-full rounded-lg bg-slate-600" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-900 p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-600" />
                  <div className="h-2 w-2/3 rounded-lg bg-slate-600" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-900 p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-600" />
                  <div className="h-2 w-2/3 rounded-lg bg-slate-600" />
                </div>
              </div>
            </div>
          </Label>

        </RadioGroup>
      </CardContent>
    </Card>
  );
}
