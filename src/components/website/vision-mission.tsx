
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useFormContext } from 'react-hook-form';

export function VisionMission() {
    const { watch } = useFormContext();

    const visionMissionData = watch('websiteData.sections.vision_mission', {
        mainTitle: 'Our Guiding Principles',
        visionTitle: 'Our Vision',
        visionDescription: 'To be the leading provider of luxury accommodations, known for our exceptional service and commitment to guest satisfaction.',
        missionTitle: 'Our Mission',
        missionDescription: 'To create a welcoming and comfortable environment where every guest feels valued and cared for. We are dedicated to exceeding expectations through continuous improvement and innovation.',
        bgColor: '#FFFFFF',
        imageUrl: "https://images.unsplash.com/photo-1549925243-750b69145d42?auto=format&fit=crop&q=80&w=1920",
    });

    const imageToDisplay = visionMissionData.imageFile ? URL.createObjectURL(visionMissionData.imageFile) : visionMissionData.imageUrl;

    return (
        <section
            className="py-24 sm:py-32"
            style={{ backgroundColor: visionMissionData.bgColor || '#FFFFFF' }}
        >
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
                <div className="text-center mb-12 sm:mb-16">
                     <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tighter">{visionMissionData.mainTitle}</h2>
                </div>
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                    <div className="relative aspect-square rounded-2xl overflow-hidden">
                        {imageToDisplay && (
                            <Image src={imageToDisplay} alt="Vision and Mission" fill className="object-cover" />
                        )}
                    </div>
                    <div className="space-y-12">
                        <div className="space-y-4">
                            <h3 className="text-2xl sm:text-3xl font-bold text-primary">{visionMissionData.visionTitle}</h3>
                            <p className="text-lg text-neutral-500 dark:text-neutral-300 font-light leading-relaxed">
                                {visionMissionData.visionDescription}
                            </p>
                        </div>
                         <div className="space-y-4">
                            <h3 className="text-2xl sm:text-3xl font-bold text-primary">{visionMissionData.missionTitle}</h3>
                            <p className="text-lg text-neutral-500 dark:text-neutral-300 font-light leading-relaxed">
                                {visionMissionData.missionDescription}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
