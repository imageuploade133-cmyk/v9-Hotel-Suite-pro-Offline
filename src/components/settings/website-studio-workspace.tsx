'use client';

import * as React from 'react';
import { Monitor, Image, BedDouble, GalleryHorizontal, Target, PanelBottom } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion } from '@/components/ui/accordion';
import { WebsitePreview } from '@/components/settings/website-preview';
import { HeroSettingsForm } from '@/components/settings/website-studio2/hero-settings-form';
import { AccommodationsSettingsForm } from '@/components/settings/website-studio2/accommodations-settings';
import { GallerySettingsForm } from '@/components/settings/website-studio2/gallery-settings-form';
import { VisionMissionSettings } from '@/components/settings/website/vision-mission-settings';
import { FooterSettingsForm } from '@/components/settings/website/footer-settings';
import type { SiteData } from '@/components/website/types';
import type { UseFormReturn } from 'react-hook-form';

type StudioForm = UseFormReturn<any>;

const sections = [
  { value: 'hero-section', label: 'Hero', description: 'Main banner and headline', icon: Image },
  { value: 'accommodations-section', label: 'Rooms', description: 'Room and accommodation display', icon: BedDouble },
  { value: 'gallery-section', label: 'Gallery', description: 'Website photo gallery', icon: GalleryHorizontal },
  { value: 'vision-mission-section', label: 'About us', description: 'Vision and mission content', icon: Target },
  { value: 'footer-section', label: 'Footer', description: 'Footer text and public details', icon: PanelBottom },
];

export function WebsiteStudioWorkspace({ form, pageData }: { form: StudioForm; pageData: SiteData }) {
  const [activeSection, setActiveSection] = React.useState('hero-section');

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-0 overflow-y-auto bg-muted/20 xl:grid-cols-[minmax(360px,40%)_minmax(0,1fr)] xl:overflow-hidden">
      <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden border-b bg-card xl:min-h-0 xl:border-b-0 xl:border-r">
        <Tabs value={activeSection} onValueChange={setActiveSection} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-3 pb-3 pt-4 sm:px-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Website sections</h2>
                <p className="text-xs text-muted-foreground">Choose a section to edit its content</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">5 sections</span>
            </div>
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted/70 p-1">
              {sections.map(section => {
                const Icon = section.icon;
                return (
                  <TabsTrigger key={section.value} value={section.value} className="min-w-[76px] flex-1 gap-1.5 px-2 py-2 text-xs sm:min-w-[82px] sm:text-sm">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
            <TabsContent value="hero-section" className="mt-0">
              <div className="mb-3"><h3 className="font-semibold">Hero section</h3><p className="text-sm text-muted-foreground">Control the first section visitors see on your website.</p></div>
              <Accordion type="multiple" defaultValue={['hero-section']}><HeroSettingsForm form={form} sectionId="hero-section" /></Accordion>
            </TabsContent>
            <TabsContent value="accommodations-section" className="mt-0">
              <div className="mb-3"><h3 className="font-semibold">Rooms and accommodations</h3><p className="text-sm text-muted-foreground">Choose which rooms and accommodation details appear.</p></div>
              <Accordion type="multiple" defaultValue={['accommodations-section']}><AccommodationsSettingsForm form={form} sectionId="accommodations-section" /></Accordion>
            </TabsContent>
            <TabsContent value="gallery-section" className="mt-0">
              <div className="mb-3"><h3 className="font-semibold">Photo gallery</h3><p className="text-sm text-muted-foreground">Manage the photos displayed in your website gallery.</p></div>
              <Accordion type="multiple" defaultValue={['gallery-section']}><GallerySettingsForm form={form} sectionId="gallery-section" /></Accordion>
            </TabsContent>
            <TabsContent value="vision-mission-section" className="mt-0">
              <div className="mb-3"><h3 className="font-semibold">Vision and mission</h3><p className="text-sm text-muted-foreground">Tell visitors about your hotel and its values.</p></div>
              <Accordion type="multiple" defaultValue={['vision-mission-section']}><VisionMissionSettings form={form} sectionId="vision-mission-section" /></Accordion>
            </TabsContent>
            <TabsContent value="footer-section" className="mt-0">
              <div className="mb-3"><h3 className="font-semibold">Website footer</h3><p className="text-sm text-muted-foreground">Edit footer information and public-facing details.</p></div>
              <Accordion type="multiple" defaultValue={['footer-section']}><FooterSettingsForm form={form} sectionId="footer-section" /></Accordion>
            </TabsContent>
          </div>
        </Tabs>
      </section>

      <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden bg-background xl:h-full xl:min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
          <div><h2 className="flex items-center gap-2 text-sm font-semibold"><Monitor className="h-4 w-4" />Live website preview</h2><p className="text-xs text-muted-foreground">Preview your public website as you edit</p></div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Live preview</span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
          <WebsitePreview pageData={pageData} />
        </div>
      </section>
    </div>
  );
}
