'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { WashingMachine } from 'lucide-react';
import { LaundryItemManagement } from './laundry-item-management';
import { Separator } from '../ui/separator';

export function LaundrySettings() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <WashingMachine className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle>Laundry Service Settings</CardTitle>
            <CardDescription>
              Manage the items and prices for your laundry service.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <LaundryItemManagement />
      </CardContent>
    </Card>
  );
}
