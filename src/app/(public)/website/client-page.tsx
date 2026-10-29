
'use client';

import * as React from 'react';
import { SiteHeader } from '@/components/website/SiteHeader';
import { Hero } from '@/components/website/Hero';
import { Accommodations } from '@/components/website/accommodations';
import { Testimonials } from '@/components/website/Testimonials';
import { Footer } from '@/components/website/Footer';
import { Gallery } from '@/components/website/Gallery';
import { Contact } from '@/components/website/Contact';
import { BookingBar } from '@/components/website/BookingBar';
import { useBooking } from '@/components/website/booking-provider';
import { WebsiteDynamicStyles } from '@/components/website/WebsiteDynamicStyles';
import { BookingDialog } from '@/components/website/booking-dialog';
import type { Room } from '@/components/website/types';
import { FormProvider, useForm } from 'react-hook-form';
import { VisionMission } from '@/components/website/vision-mission';

export function WebsitePageClient({ pageData }: { pageData: any }) {
  const { openBooking, availableRooms } = useBooking();
  const methods = useForm({
    defaultValues: {
      websiteData: pageData?.settings?.websiteData || {},
    },
  });

  React.useEffect(() => {
    if (pageData?.settings?.websiteData) {
      methods.reset({ websiteData: pageData.settings.websiteData });
    }
  }, [pageData, methods]);


  const accommodationsSettings = pageData.settings?.websiteData?.accommodations || {};
  const heroSettings = pageData.settings?.websiteData?.hero || {};
  const visionMissionSettings = pageData.settings?.websiteData?.sections?.vision_mission || {};
  const gallerySettings = pageData.settings?.websiteData?.gallery || {};

  const allAccommodations = accommodationsSettings.roomSource === 'all'
      ? pageData.allRooms
      : pageData.signatureRooms;

  const accommodationsToShow = availableRooms === null ? allAccommodations : availableRooms;


  return (
    <FormProvider {...methods}>
        <WebsiteDynamicStyles />
      <div className="website-body">

        <main>
          <SiteHeader />
          {heroSettings.show && <Hero />}
          <BookingBar />
          {accommodationsSettings.show && <Accommodations data={accommodationsToShow} />}
          {gallerySettings.show && <Gallery />}
          {visionMissionSettings.show && <VisionMission />}
          <Testimonials />
          <Contact />
        </main>
        <Footer />
        <BookingDialog />
      </div>
    </FormProvider>
  );
}
