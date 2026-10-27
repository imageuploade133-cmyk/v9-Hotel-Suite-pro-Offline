
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { AppWindow, Scissors, WashingMachine } from 'lucide-react';
import { GymSettingsForm } from '@/components/settings/gym-settings-form';
import { SalonSettings } from '@/components/settings/salon-settings';
import { LaundrySettings } from '@/components/settings/laundry-settings';
import { Accordion } from '@/components/ui/accordion';

function ServicesSettingsPage() {
  return (
    <Accordion type="multiple" defaultValue={['gym-management']} className="w-full space-y-4">
      <GymSettingsForm />
      <SalonSettings />
      <LaundrySettings />
    </Accordion>
  );
}

export default withAuth(ServicesSettingsPage, PagePermission.MANAGE_GENERAL_SETTINGS);
