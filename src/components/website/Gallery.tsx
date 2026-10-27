
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFormContext } from 'react-hook-form';

interface ImageObject {
    url: string;
    name?: string;
}

export function Gallery() {
    const { watch } = useFormContext();

    const galleryData = watch('websiteData.gallery', {
        title: 'Visual Story',
        subtitle: 'A Curation of Moments',
        images: [],
        newImageFiles: [],
    });

    const [selectedImageIndex, setSelectedImageIndex] = React.useState<number | null>(null);

    const allImages: ImageObject[] = React.useMemo(() => {
        const existing: ImageObject[] = galleryData.images || [];
        const newFiles: ImageObject[] = (galleryData.newImageFiles || []).map((fileObj: { file: File, name?: string }) => ({
            url: URL.createObjectURL(fileObj.file),
            name: fileObj.name,
        }));
        return [...existing, ...newFiles];
    }, [galleryData.images, galleryData.newImageFiles]);

    const handleNext = () => {
        if (selectedImageIndex !== null) {
            setSelectedImageIndex((prevIndex) => (prevIndex! + 1) % allImages.length);
        }
    };

    const handlePrev = () => {
        if (selectedImageIndex !== null) {
            setSelectedImageIndex((prevIndex) => (prevIndex! - 1 + allImages.length) % allImages.length);
        }
    };

    if (allImages.length === 0) {
        return (
            <section className="py-24 sm:py-32 bg-neutral-50 dark:bg-neutral-900/50" id="gallery">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 text-center">
                     <p className="text-muted-foreground">Gallery is empty. Add images in the Website Studio.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="py-24 sm:py-32 bg-neutral-50 dark:bg-neutral-900/50" id="gallery">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
                <div className="text-center mb-12 sm:mb-16 space-y-4">
                    <span className="text-black dark:text-white uppercase tracking-[0.4em] text-[11px] font-extrabold">{galleryData.subtitle || 'Visual Story'}</span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tighter">{galleryData.title || 'A Curation of Moments'}</h2>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                    {allImages.map((image, index) => (
                        <button
                            key={image.url}
                            onClick={() => setSelectedImageIndex(index)}
                            className={`overflow-hidden aspect-video ${index < 2 ? 'md:aspect-[4/3]' : 'md:aspect-video'} relative group`}
                        >
                            <Image
                                alt={image.name || `Gallery image ${index + 1}`}
                                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700 transform group-hover:scale-105"
                                src={image.url}
                                width={1200}
                                height={index < 2 ? 1600 : 675}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-start p-4">
                                {image.name && <h4 className="text-white font-semibold text-lg">{image.name}</h4>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {selectedImageIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedImageIndex(null)}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 h-12 w-12 text-white/70 hover:text-white hover:bg-white/10 z-[102]"
                            onClick={() => setSelectedImageIndex(null)}
                        >
                            <X className="h-8 w-8" />
                        </Button>

                        <div className="relative w-full h-full flex items-center justify-center">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-4 top-1/2 -translate-y-1/2 h-16 w-16 text-white/70 hover:text-white hover:bg-white/10 z-[102] border border-white/20"
                                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            >
                                <ChevronLeft className="h-12 w-12" />
                            </Button>

                             <motion.div
                                key={selectedImageIndex}
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="relative w-full h-full max-w-6xl max-h-[80vh]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Image
                                    alt={allImages[selectedImageIndex].name || `Enlarged gallery image ${selectedImageIndex + 1}`}
                                    src={allImages[selectedImageIndex].url}
                                    fill
                                    className="object-contain"
                                />
                                {allImages[selectedImageIndex].name && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white p-2 rounded-lg text-center">
                                        {allImages[selectedImageIndex].name}
                                    </div>
                                )}
                            </motion.div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-1/2 -translate-y-1/2 h-16 w-16 text-white/70 hover:text-white hover:bg-white/10 z-[102] border border-white/20"
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            >
                                <ChevronRight className="h-12 w-12" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
