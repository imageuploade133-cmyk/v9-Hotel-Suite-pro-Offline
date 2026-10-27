
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Globe, Loader2, Palette, Settings2 } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/ui/top-header';
import WebsiteStudioLoading from '@/app/(protected)/settings/website-studio/loading';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Accordion } from '@/components/ui/accordion';
import { WebsitePreview } from '@/components/settings/website-preview';
import { BookingProvider, useBooking } from '@/components/website/booking-provider';
import { BookingDialog } from '@/components/website/booking-dialog';
import type { Room, Amenity, Review, Settings, SiteData } from '@/components/website/types';
import { ServerCrash } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HeroSettingsForm } from '@/components/settings/website-studio2/hero-settings-form';
import { AccommodationsSettingsForm } from '@/components/settings/website-studio2/accommodations-settings';
import { VisionMissionSettings } from '@/components/settings/vision-mission-settings';
import { uploadImage } from '@/lib/helpers';
import { GallerySettingsForm } from '@/components/settings/website-studio2/gallery-settings-form';
import { FooterSettingsForm } from '@/components/settings/website/footer-settings';


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
        <form id="website-content-form" onSubmit={methods.handleSubmit(onSubmit)} className="h-full flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <TopHeader name="Website Studio" icon={<Globe className="h-10 w-10" />} description="Visually edit your public-facing website content and appearance." />
            <div className="flex items-center gap-2">
               <Button asChild variant="outline">
                  <Link href="/settings/website-studio2">
                      <Settings2 className="mr-2 h-4 w-4" />
                      Advanced Settings
                  </Link>
              </Button>
              <Button type="submit" className="shadow-lg" disabled={isSaving || !methods.formState.isDirty}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Save Website Content
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 flex-1 min-h-0">
             <ScrollArea className="h-full max-h-[calc(100vh-200px)] border rounded-lg p-4 bg-card">
                 <Accordion type="multiple" defaultValue={['hero-section']}>
                    <HeroSettingsForm form={methods} sectionId="hero-section" />
                    <AccommodationsSettingsForm form={methods} sectionId="accommodations-section" />
                    <GallerySettingsForm form={methods} sectionId="gallery-section" />
                    <VisionMissionSettings form={methods} sectionId="vision-mission-section" />
                    <FooterSettingsForm form={methods} sectionId="footer-section" />
                 </Accordion>
             </ScrollArea>
              <div className="h-full max-h-[calc(100vh-200px)]">
                  <WebsitePreview />
              </div>
          </div>
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
