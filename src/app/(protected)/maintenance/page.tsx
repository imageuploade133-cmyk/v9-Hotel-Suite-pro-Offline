'use client';

import * as React from 'react';
import { Wrench } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { MaintenanceList } from '@/components/maintenance/maintenance-list';
import { TopHeader } from '@/components/top-header';

function MaintenancePage() {
  return (
    <div className="flex flex-col gap-6">
      <TopHeader
        name="Rooms for Maintenance"
        icon={<Wrench />}
        description="A real-time list of all rooms requiring maintenance."
      />
      <MaintenanceList />
    </div>
  );
}

export default withAuth(MaintenancePage, PagePermission.VIEW_MAINTENANCE_PAGE);
