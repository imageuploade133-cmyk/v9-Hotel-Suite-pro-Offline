
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function Hero() {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isImageLoading, setIsImageLoading] = React.useState(true);
    const { watch } = useFormContext();

    const heroData = watch('websiteData.hero', {
        title: 'Experience Exquisite Stays.',
        subtitle: 'A seamless blend of modern luxury and timeless elegance, crafted for an unforgettable stay. Welcome to your home away from home.',
        buttonText: 'Book Now',
        imageUrl: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1920&auto=format&fit=crop",
    });

    const imageToDisplay = heroData.imageFile ? URL.createObjectURL(heroData.imageFile) : heroData.imageUrl;

    const handleImageLoad = () => {
        setIsImageLoading(false);
    };

    return (
        <>
            <section className="relative h-screen w-full flex items-center justify-center text-center sm:justify-start sm:text-left overflow-hidden">
                <div className="absolute inset-0 z-0">
                    {isImageLoading && <Skeleton className="w-full h-full" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/30 to-black/10 z-10"></div>
                    {imageToDisplay && (
                      <Image
                          alt="Lounge area of a luxury hotel with a pool and ocean view"
                          className={cn("w-full h-full object-cover transition-opacity duration-1000", isImageLoading ? "opacity-0" : "opacity-100")}
                          src={imageToDisplay}
                          fill
                          priority
                          onLoad={handleImageLoad}
                          data-ai-hint="hotel lobby"
                      />
                    )}
                </div>
                <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-8 w-full">
                    <div className={cn("max-w-xl space-y-6 transition-opacity duration-700", isImageLoading ? 'opacity-0' : 'opacity-100')}>
                        <span className="text-accent-gold uppercase tracking-[0.4em] text-base font-black flex items-center gap-4">
                            <span className="w-12 h-px bg-accent-gold"></span>
                            The Modern Standard
                        </span>
                        <h1 className="text-white text-5xl sm:text-6xl md:text-7xl font-website-display font-medium leading-none tracking-tighter">
                            {heroData.title}
                        </h1>
                        <p className="text-ivory/80 text-xl sm:text-2xl max-w-xl font-bold leading-relaxed">
                            {heroData.subtitle}
                        </p>
                        <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="group flex items-center justify-center gap-4 text-white uppercase tracking-widest text-[11px] font-bold px-8 py-4 bg-white/10 border border-white/20 rounded-full backdrop-blur-sm hover:bg-accent-gold hover:text-black hover:border-accent-gold transition-all duration-300 w-full sm:w-auto"
                            >
                                {heroData.buttonText}
                            </button>
                        </div>
                    </div>
                     {isImageLoading && (
                        <div className="max-w-xl space-y-6">
                            <Skeleton className="h-6 w-48" />
                            <div className="space-y-4">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-3/4" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-5/6" />
                            </div>
                            <Skeleton className="h-14 w-48" />
                        </div>
                    )}
                </div>
            </section>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-transparent border-0 p-0 max-w-3xl w-full">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Hotel Video Tour</DialogTitle>
                    </DialogHeader>
                     <div className="aspect-video">
                        <iframe
                            width="100%"
                            height="100%"
                            src="https://www.youtube.com/embed/RUNEmaJJ_1g"
                            title="Cacid hotel #thetravelhunters"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        ></iframe>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
