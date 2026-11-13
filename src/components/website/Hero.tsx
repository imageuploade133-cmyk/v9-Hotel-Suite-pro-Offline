'use client';

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFormContext } from 'react-hook-form';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function getVideoEmbedUrl(value?: string) {
    if (!value) return null;
    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
            const id = url.pathname.split('/').filter(Boolean)[0];
            return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0` : null;
        }
        if (host.endsWith('youtube.com')) {
            const id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
            return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0` : null;
        }
        if (host.endsWith('vimeo.com')) {
            const id = url.pathname.split('/').filter(Boolean).pop();
            return id ? `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1` : null;
        }
    } catch {
        return null;
    }
    return null;
}

function isDirectVideo(value?: string) {
    if (!value) return false;
    try {
        return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(new URL(value).pathname + new URL(value).search);
    } catch {
        return false;
    }
}

export function Hero() {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isMediaLoading, setIsMediaLoading] = React.useState(true);
    const [videoFailed, setVideoFailed] = React.useState(false);
    const { watch } = useFormContext();

    const heroData = watch('websiteData.hero', {
        title: 'Experience Exquisite Stays.',
        subtitle: 'A seamless blend of modern luxury and timeless elegance, crafted for an unforgettable stay. Welcome to your home away from home.',
        buttonText: 'Book Now',
        imageUrl: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1920&auto=format&fit=crop',
    });

    const localVideoPreview = React.useMemo(
        () => heroData.videoFile instanceof File ? URL.createObjectURL(heroData.videoFile) : '',
        [heroData.videoFile]
    );
    React.useEffect(() => () => {
        if (localVideoPreview) URL.revokeObjectURL(localVideoPreview);
    }, [localVideoPreview]);

    const videoUrl = localVideoPreview || heroData.videoUrl || '';
    const embedUrl = !localVideoPreview ? getVideoEmbedUrl(videoUrl) : null;
    const directVideo = Boolean(localVideoPreview || isDirectVideo(videoUrl));
    const imageToDisplay = heroData.imageFile ? URL.createObjectURL(heroData.imageFile) : heroData.imageUrl;
    const hasVideo = Boolean(videoUrl && !videoFailed);

    React.useEffect(() => {
        setIsMediaLoading(Boolean(videoUrl || imageToDisplay));
        setVideoFailed(false);
    }, [videoUrl, imageToDisplay]);

    const mediaReady = () => setIsMediaLoading(false);
    const modalVideoUrl = getVideoEmbedUrl(videoUrl) || (directVideo ? videoUrl : 'https://www.youtube-nocookie.com/embed/RUNEmaJJ_1g?autoplay=1&mute=1');

    return (
        <>
            <section className="relative flex h-screen w-full items-center justify-center overflow-hidden text-center sm:justify-start sm:text-left">
                <div className="absolute inset-0 z-0 bg-slate-900">
                    {isMediaLoading && <Skeleton className="h-full w-full" />}
                    {hasVideo && directVideo && (
                        <video
                            key={videoUrl}
                            className="absolute inset-0 h-full w-full object-cover"
                            src={videoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            onCanPlay={mediaReady}
                            onError={() => { setVideoFailed(true); setIsMediaLoading(false); }}
                        />
                    )}
                    {hasVideo && embedUrl && (
                        <iframe
                            key={embedUrl}
                            className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
                            src={embedUrl}
                            title="Hotel hero background video"
                            allow="autoplay; encrypted-media; picture-in-picture"
                            onLoad={mediaReady}
                        />
                    )}
                    {(!hasVideo || videoFailed) && imageToDisplay && (
                        <Image
                            alt="Hotel hero background"
                            className="h-full w-full object-cover"
                            src={imageToDisplay}
                            fill
                            priority
                            onLoad={mediaReady}
                        />
                    )}
                    {!videoUrl && !imageToDisplay && <div className="absolute inset-0 bg-slate-900" />}
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-black/35 to-black/15" />
                </div>
                <div className="relative z-20 mx-auto w-full max-w-7xl px-4 sm:px-8">
                    <div className={cn('max-w-xl space-y-6 transition-opacity duration-700', isMediaLoading ? 'opacity-0' : 'opacity-100')}>
                        <span className="flex items-center gap-4 text-base font-black uppercase tracking-[0.4em] text-accent-gold">
                            <span className="h-px w-12 bg-accent-gold" />
                            The Modern Standard
                        </span>
                        <h1 className="font-website-display text-5xl font-medium leading-none tracking-tighter text-white sm:text-6xl md:text-7xl">
                            {heroData.title}
                        </h1>
                        <p className="max-w-xl text-xl font-bold leading-relaxed text-ivory/80 sm:text-2xl">
                            {heroData.subtitle}
                        </p>
                        <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="group flex w-full items-center justify-center gap-4 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-all duration-300 hover:border-accent-gold hover:bg-accent-gold hover:text-black sm:w-auto"
                            >
                                {heroData.buttonText || 'Watch Video'}
                            </button>
                        </div>
                    </div>
                    {isMediaLoading && (
                        <div className="max-w-xl space-y-6">
                            <Skeleton className="h-6 w-48" />
                            <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-3/4" /></div>
                            <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-5/6" /></div>
                            <Skeleton className="h-14 w-48" />
                        </div>
                    )}
                </div>
            </section>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-full max-w-4xl border-0 bg-black p-2">
                    <DialogHeader className="sr-only"><DialogTitle>Hotel Video Tour</DialogTitle></DialogHeader>
                    <div className="aspect-video overflow-hidden rounded-md">
                        {directVideo && videoUrl ? (
                            <video className="h-full w-full" src={videoUrl} controls autoPlay playsInline />
                        ) : (
                            <iframe
                                className="h-full w-full"
                                src={modalVideoUrl}
                                title="Hotel Video Tour"
                                allow="autoplay; encrypted-media; picture-in-picture"
                                allowFullScreen
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
