
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { AppWindow, Loader2 } from 'lucide-react';
import { TopHeader } from '@/components/ui/top-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SocialBrandingSettings } from '@/components/settings/website-studio2/social-branding-settings';
import { Accordion } from '@/components/ui/accordion';
import { PublicBankAccountForm } from '@/components/settings/website-studio2/public-bank-account-form';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { uploadImage } from '@/lib/helpers';

const websiteDataSchema = z.object({
  websiteData: z.object({
      footer: z.object({
          publicBankName: z.string().optional(),
          publicAccountName: z.string().optional(),
          publicAccountNumber: z.string().optional(),
          publicBankLogoUrl: z.string().url().optional().or(z.literal('')),
          publicBankLogoFile: z.instanceof(File).optional(),
      }).optional(),
      socialAndBranding: z.object({
        instagramUrl: z.string().url().optional().or(z.literal('')),
        twitterUrl: z.string().url().optional().or(z.literal('')),
        youtubeUrl: z.string().url().optional().or(z.literal('')),
        websiteLogoUrl: z.string().url().optional().or(z.literal('')),
        websiteLogoFile: z.instanceof(File).optional(),
      }).optional(),
  }).optional(),
});

type WebsiteDataFormValues = z.infer<typeof websiteDataSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

function WebsiteStudio2Page() {
    const { settings, refreshSettings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const methods = useForm<WebsiteDataFormValues>({
      resolver: zodResolver(websiteDataSchema),
      defaultValues: {
        websiteData: {
          socialAndBranding: {},
          footer: {},
        }
      },
    });

    React.useEffect(() => {
        if (settings) {
            const defaultVals = { footer: {}, socialAndBranding: {} };
            const mergedData = { ...defaultVals, ...settings.websiteData };
            methods.reset({ websiteData: mergedData });
        }
    }, [settings, methods]);

    const onSubmit = async (data: WebsiteDataFormValues) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const processedData = JSON.parse(JSON.stringify(data.websiteData));
            const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;

            if (data.websiteData?.socialAndBranding?.websiteLogoFile) {
                toast({ title: 'Uploading Website Logo...' });
                const url = await uploadImage(data.websiteData.socialAndBranding.websiteLogoFile, imgbbApiKey, `website-logo-${Date.now()}`);
                processedData.socialAndBranding.websiteLogoUrl = url;
            }
            if (processedData.socialAndBranding) delete processedData.socialAndBranding.websiteLogoFile;

            if (data.websiteData?.footer?.publicBankLogoFile) {
                toast({ title: 'Uploading Public Bank Logo...' });
                const url = await uploadImage(data.websiteData.footer.publicBankLogoFile, imgbbApiKey, `public-bank-logo-${Date.now()}`);
                if (!processedData.footer) processedData.footer = {};
                processedData.footer.publicBankLogoUrl = url;
            }
            if (processedData.footer) delete processedData.footer.publicBankLogoFile;

            const settingsDocRef = doc(firestore, 'settings', 'global');
            await setDoc(settingsDocRef, { websiteData: processedData }, { merge: true });
            toast({ variant: 'success', title: 'Website Content Saved' });
            refreshSettings();
            methods.reset({ websiteData: processedData }, { keepDirty: false });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };


  return (
    <FormProvider {...methods}>
    <form onSubmit={methods.handleSubmit(onSubmit)}>
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <TopHeader
            name="Website Studio 2"
            icon={<AppWindow className="h-10 w-10" />}
            description="Configure advanced sections and integrations for your public website."
        />
         <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/settings/website-studio">Back to Main Studio</Link>
              </Button>
              <Button type="submit" disabled={isSaving || !methods.formState.isDirty}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save All Changes
              </Button>
          </div>
      </div>

      <Accordion type="multiple" defaultValue={['social-branding', 'public-bank-details']} className="w-full space-y-4">
        <SocialBrandingSettings />
        <PublicBankAccountForm />
      </Accordion>

    </div>
    </form>
    </FormProvider>
  );
}

export default withAuth(WebsiteStudio2Page, PagePermission.MANAGE_GENERAL_SETTINGS);
