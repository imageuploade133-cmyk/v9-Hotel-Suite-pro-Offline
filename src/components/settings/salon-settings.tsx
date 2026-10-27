'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Scissors } from 'lucide-react';
import { SalonServiceManagement } from './salon-service-management';

export function SalonSettings() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Scissors className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle>Barbing Salon Settings</CardTitle>
            <CardDescription>
              Manage the services and prices offered at your salon.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <SalonServiceManagement />
      </CardContent>
    </Card>
  );
}
