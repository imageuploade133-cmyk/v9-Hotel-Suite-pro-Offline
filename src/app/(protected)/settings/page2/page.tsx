
'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Settings2, FileText } from 'lucide-react';
import { TopHeader } from '@/components/ui/top-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { WhatsAppSettingsForm } from '@/components/settings/whatsapp-settings-form';
import { DailyReportSettingsForm } from '@/components/settings/daily-report-settings-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TagManagement } from '@/components/settings/tag-management';
import { CreditSaleBankAccountForm } from '@/components/settings/credit-sale-bank-account-form';
import { EbulkSmsSettingsForm } from '@/components/settings/ebulk-sms-settings-form';
import { GoogleAppsScriptSettingsForm } from '@/components/settings/google-apps-script-settings-form';

function SettingsPage2() {
  return (
    <div className="flex flex-col gap-6">
      <TopHeader
        name="Settings Page 2"
        icon={<Settings2 className="h-10 w-10" />}
        description="This is a second settings page for additional configurations."
      />
      <GoogleAppsScriptSettingsForm />
      <WhatsAppSettingsForm />
      <DailyReportSettingsForm />
      <CreditSaleBankAccountForm />
      <EbulkSmsSettingsForm />

      <Card>
        <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
            <CardDescription>Manage the categories for your business expenses.</CardDescription>
        </CardHeader>
        <CardContent>
            <TagManagement
                title="Expense Categories"
                description="Define categories to organize your expenses (e.g., Utilities, Maintenance, Marketing)."
                collectionName="expenseCategories"
                icon={FileText}
            />
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="w-fit">
        <Link href="/settings">
            Back to Main Settings
        </Link>
      </Button>
    </div>
  );
}

export default withAuth(SettingsPage2, PagePermission.MANAGE_GENERAL_SETTINGS);
