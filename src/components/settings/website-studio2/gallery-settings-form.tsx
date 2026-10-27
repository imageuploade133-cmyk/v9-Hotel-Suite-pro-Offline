
'use client';

import * as React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { GalleryVertical, Upload, X } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface GallerySettingsFormProps {
    form: UseFormReturn<any>;
    sectionId: string;
}

export function GallerySettingsForm({
    form,
    sectionId,
}: GallerySettingsFormProps) {
    const fieldName = 'websiteData.gallery';
    const { toast } = useToast();
    const { settings } = useSettings();
    const maxFileSize = settings?.maxFileSizeMb ?? 5;

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const newImageFiles = form.watch(`${fieldName}.newImageFiles`) || [];
    const existingImageUrls = form.watch(`${fieldName}.images`) || [];

    const handleFileSelect = (selectedFiles: FileList | null) => {
        if (selectedFiles) {
            const newFiles = Array.from(selectedFiles).filter(file => {
                if (file.size > maxFileSize * 1024 * 1024) {
                    toast({ variant: 'destructive', title: 'File Too Large', description: `${file.name} is larger than the allowed ${maxFileSize}MB.` });
                    return false;
                }
                return true;
            });
            const currentFiles = form.getValues(`${fieldName}.newImageFiles`) || [];
            const newFileObjects = newFiles.map(file => ({ file, name: '' }));
            form.setValue(`${fieldName}.newImageFiles`, [...currentFiles, ...newFileObjects], { shouldValidate: true });
        }
    };

    const handleRemoveNewImage = (index: number) => {
        const currentFiles = form.getValues(`${fieldName}.newImageFiles`) || [];
        form.setValue(`${fieldName}.newImageFiles`, currentFiles.filter((_, i) => i !== index), { shouldValidate: true });
    };

    const handleRemoveExistingImage = (index: number) => {
        const currentImages = form.getValues(`${fieldName}.images`) || [];
        form.setValue(`${fieldName}.images`, currentImages.filter((_, i) => i !== index), { shouldDirty: true });
    };

    const handleDragEvents = {
        onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); },
        onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); },
        onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); },
        onDrop: (e: React.DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
        },
    };

    return (
        <AccordionItem value={sectionId}>
            <Card>
                <AccordionTrigger className="p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <GalleryVertical className="h-5 w-5" />
                        Gallery Section
                    </h3>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0 space-y-4">
                    <FormField
                        control={form.control}
                        name={`${fieldName}.show`}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5"><FormLabel>Show Section</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.title`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.subtitle`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Subtitle</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormItem>
                        <FormLabel>Gallery Images</FormLabel>
                        <div
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                            {...handleDragEvents}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                            </p>
                        </div>
                        <FormControl>
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png, image/jpeg"
                                className="hidden"
                                multiple
                                onChange={(e) => handleFileSelect(e.target.files)}
                            />
                        </FormControl>
                        {(existingImageUrls.length > 0 || newImageFiles.length > 0) && (
                            <Carousel className="w-full pt-4">
                                <CarouselContent>
                                    {existingImageUrls.map((img: { url: string; name?: string }, index: number) => (
                                        <CarouselItem key={img.url} className="basis-1/2">
                                            <Card className="overflow-hidden group relative">
                                                <div className="aspect-square relative">
                                                    <Image src={img.url} alt={`Existing Image ${index}`} fill className="object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
                                                        <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveExistingImage(index)}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name={`${fieldName}.images.${index}.name`}
                                                    render={({ field }) => (
                                                        <Input {...field} placeholder="Optional name..." className="w-full text-xs rounded-t-none border-t-0" />
                                                    )}
                                                />
                                            </Card>
                                        </CarouselItem>
                                    ))}
                                    {newImageFiles.map((fileObj: { file: File, name?: string }, index: number) => (
                                        <CarouselItem key={fileObj.file.name + index} className="basis-1/2">
                                            <Card className="overflow-hidden group relative">
                                                <div className="aspect-square relative">
                                                    <Image src={URL.createObjectURL(fileObj.file)} alt={`Preview ${index}`} fill className="object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
                                                        <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveNewImage(index)}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name={`${fieldName}.newImageFiles.${index}.name`}
                                                    render={({ field }) => (
                                                        <Input {...field} placeholder="Optional name..." className="w-full text-xs rounded-t-none border-t-0" />
                                                    )}
                                                />
                                            </Card>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <CarouselPrevious className="left-2" />
                                <CarouselNext className="right-2" />
                            </Carousel>
                        )}
                        <FormMessage />
                    </FormItem>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
