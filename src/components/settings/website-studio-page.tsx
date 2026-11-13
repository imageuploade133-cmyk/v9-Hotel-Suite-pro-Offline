
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Globe, Loader2, Palette, Settings2 } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/ui/top-header';
import WebsiteStudioLoading from '@/app/(protected)/settings/website-studio/loading';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { BookingProvider, useBooking } from '@/components/website/booking-provider';
import { BookingDialog } from '@/components/website/booking-dialog';
import type { Room, Amenity, Review, Settings, SiteData } from '@/components/website/types';
import { ServerCrash } from 'lucide-react';
import { WebsiteStudioWorkspace } from '@/components/settings/website-studio-workspace';
import Link from 'next/link';
import { uploadImage } from '@/lib/helpers';


const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const websiteDataSchema = z.object({
  websiteData: z.object({
      hero: z.object({
          show: z.boolean().default(true),
          title: z.string().optional(),
          subtitle: z.string().optional(),
          buttonText: z.string().optional(),
          imageUrl: z.string().url().optional().or(z.literal('')),
          imageFile: z.instanceof(File).optional(),
      }).optional(),
      accommodations: z.object({
          show: z.boolean().default(true),
          title: z.string().optional(),
          subtitle: z.string().optional(),
          roomSource: z.enum(['all', 'signature']).optional(),
      }).optional(),
      gallery: z.object({
        show: z.boolean().default(true),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        images: z.array(z.object({ url: z.string(), name: z.string().optional() })).optional(),
        newImageFiles: z.array(z.object({ file: z.instanceof(File), name: z.string().optional() })).optional(),
      }).optional(),
      sections: z.object({
        vision_mission: z.object({
          show: z.boolean().default(true),
          mainTitle: z.string().optional(),
          visionTitle: z.string().optional(),
          visionDescription: z.string().optional(),
          missionTitle: z.string().optional(),
          missionDescription: z.string().optional(),
          bgColor: z.string().optional(),
          imageUrl: z.string().url().optional().or(z.literal('')),
          imageFile: z.instanceof(File).optional(),
        }).optional(),
      }).optional(),
      footer: z.object({
          description: z.string().optional(),
          newsletterTitle: z.string().optional(),
          copyrightText: z.string().optional(),
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

const AdminDashboardContent = ({ pageData }: { pageData: SiteData }) => {
    const { settings, refreshSettings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const methods = useForm<WebsiteDataFormValues>({
      resolver: zodResolver(websiteDataSchema),
      defaultValues: {},
    });

    React.useEffect(() => {
        if (settings?.websiteData) {
            methods.reset({ websiteData: settings.websiteData });
        }
    }, [settings, methods]);

    const onSubmit = async (data: WebsiteDataFormValues) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const processedData = JSON.parse(JSON.stringify(data.websiteData));
            const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;

            // Handle Hero Image
            if (data.websiteData?.hero?.imageFile) {
                toast({ title: 'Uploading Hero Image...' });
                const url = await uploadImage(data.websiteData.hero.imageFile, imgbbApiKey, `hero-image-${Date.now()}`);
                processedData.hero.imageUrl = url;
            }
            if (processedData.hero) delete processedData.hero.imageFile;

            // Handle Social/Branding Logo
            if (data.websiteData?.socialAndBranding?.websiteLogoFile) {
                toast({ title: 'Uploading Website Logo...' });
                const url = await uploadImage(data.websiteData.socialAndBranding.websiteLogoFile, imgbbApiKey, `website-logo-${Date.now()}`);
                processedData.socialAndBranding.websiteLogoUrl = url;
            }
            if (processedData.socialAndBranding) delete processedData.socialAndBranding.websiteLogoFile;

            // Handle Vision & Mission Image
            if (data.websiteData?.sections?.vision_mission?.imageFile) {
                toast({ title: 'Uploading Vision/Mission Image...' });
                const url = await uploadImage(data.websiteData.sections.vision_mission.imageFile, imgbbApiKey, `vision-mission-${Date.now()}`);
                processedData.sections.vision_mission.imageUrl = url;
            }
            if (processedData.sections?.vision_mission) delete processedData.sections.vision_mission.imageFile;

            // Handle Gallery Images
            if (data.websiteData?.gallery?.newImageFiles) {
                toast({ title: `Uploading ${data.websiteData.gallery.newImageFiles.length} new gallery images...` });
                const uploadPromises = data.websiteData.gallery.newImageFiles.map(async (fileObj) => {
                    const url = await uploadImage(fileObj.file, imgbbApiKey, `gallery-${fileObj.file.name}-${Date.now()}`);
                    return { url, name: fileObj.name };
                });
                const newImageUrls = await Promise.all(uploadPromises);
                processedData.gallery.images = [...(processedData.gallery.images || []), ...newImageUrls];
            }
            if (processedData.gallery) delete processedData.gallery.newImageFiles;

            // Handle Public Bank Logo
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
        <form id="website-content-form" onSubmit={methods.handleSubmit(onSubmit)} className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-3 border-b bg-background px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button asChild type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Back to Dashboard">
                <Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <TopHeader name="Website Studio" icon={<Globe className="h-10 w-10" />} description="Visually edit your public-facing website content and appearance." />
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
               <Button asChild variant="outline" className="w-full sm:flex-1 xl:w-auto">
                  <Link href="/settings/website-studio2">
                      <Settings2 className="mr-2 h-4 w-4" />
                      Advanced Settings
                  </Link>
              </Button>
              <Button type="submit" className="w-full shadow-lg sm:flex-1 xl:w-auto" disabled={isSaving || !methods.formState.isDirty}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Save Website Content
              </Button>
            </div>
          </div>

          <WebsiteStudioWorkspace form={methods} pageData={pageData} />
        </form>
        <BookingDialog />
      </FormProvider>
    );
}

function WebsiteStudioPage({ pageData }: { pageData: SiteData }) {

    if (!pageData) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-6 p-4 text-center">
                <TopHeader
                    name="Error Loading Preview"
                    icon={<ServerCrash className="h-10 w-10 text-destructive" />}
                    description={"Could not load page data."}
                />
                <Button asChild>
                    <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
            </div>
        )
    }

    return (
        <React.Suspense fallback={<WebsiteStudioLoading />}>
            <BookingProvider>
                <AdminDashboardContent pageData={pageData} />
            </BookingProvider>
        </React.Suspense>
    );
}

export default withAuth(WebsiteStudioPage, PagePermission.MANAGE_GENERAL_SETTINGS);
