'use client';

import * as React from 'react';
import { Receipt, ArrowLeft, Globe, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POSSettingsForm } from '@/components/pos/pos-settings-form';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { useBranch } from '@/contexts/branch-context';
import { Badge } from '@/components/ui/badge';

function POSSettingsPage() {
  const { currentBranch, isGlobalMode } = useBranch();
  const contextLabel = isGlobalMode ? 'Global' : (currentBranch?.name || 'Branch');
  const ContextIcon = isGlobalMode ? Globe : Building2;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Receipt className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">POS Settings</h1>
              <Badge variant={isGlobalMode ? 'secondary' : 'default'} className="flex items-center gap-1">
                <ContextIcon className="h-3 w-3" />
                {contextLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {isGlobalMode
                ? 'Configure global POS settings that serve as defaults for all branches.'
                : `Configure POS settings specifically for ${currentBranch?.name}. These are separate from Global settings.`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/pos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to POS
            </Link>
          </Button>
        </div>
      </div>

      <Separator />

      {/* Settings Form with Preview */}
      <POSSettingsForm />
    </div>
  );
}

export default withAuth(POSSettingsPage, PagePermission.MANAGE_POS_SETTINGS);
