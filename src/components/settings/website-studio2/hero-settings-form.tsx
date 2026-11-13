
'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import { Upload, X, Home, Video, Link2 } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';

interface HeroSettingsFormProps {
    form: UseFormReturn<any>;
    sectionId: string;
}

export function HeroSettingsForm({
    form,
    sectionId,
}: HeroSettingsFormProps) {
    const fieldName = 'websiteData.hero';
    const { settings } = useSettings();
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const videoInputRef = React.useRef<HTMLInputElement>(null);
    const videoFile = form.watch(`${fieldName}.videoFile`);
    const videoUrl = form.watch(`${fieldName}.videoUrl`) || '';

    const handleVideoSelect = (file?: File) => {
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            toast({ variant: 'destructive', title: 'Invalid video', description: 'Please select an MP4, WebM or MOV video.' });
            return;
        }
        const maxVideoSizeMb = 100;
        if (file.size > maxVideoSizeMb * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'Video Too Large', description: `Hero videos must be ${maxVideoSizeMb}MB or smaller.` });
            return;
        }
        form.setValue(`${fieldName}.videoFile`, file, { shouldDirty: true });
        form.setValue(`${fieldName}.videoUrl`, '', { shouldDirty: true });
    };

    const removeVideo = () => {
        form.setValue(`${fieldName}.videoFile`, undefined, { shouldDirty: true });
        form.setValue(`${fieldName}.videoUrl`, '', { shouldDirty: true });
        if (videoInputRef.current) videoInputRef.current.value = '';
    };

    const maxFileSize = settings?.maxFileSizeMb ?? 5;

    const imageFile = form.watch(`${fieldName}.imageFile`);
    const imageUrlValue = form.watch(`${fieldName}.imageUrl`);
    const imagePreview = imageFile ? URL.createObjectURL(imageFile) : imageUrlValue;

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Too Large', description: `Must be < ${maxFileSize}MB.` });
                return;
            }
            form.setValue(`${fieldName}.imageFile`, file, { shouldDirty: true });
        }
    };

    const handleRemoveImage = () => {
        form.setValue(`${fieldName}.imageFile`, undefined, { shouldDirty: true });
        form.setValue(`${fieldName}.imageUrl`, '', { shouldDirty: true });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
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
                        <Home className="h-5 w-5" />
                        Hero Section
                    </h3>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                    <div className="space-y-6 pt-4">
                        <FormField
                            control={form.control}
                            name={`${fieldName}.show`}
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5"><FormLabel>Show Hero Section</FormLabel></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`${fieldName}.title`}
                            render={({ field }) => (
                                <FormItem><FormLabel>Title</FormLabel><FormControl><Textarea {...field} rows={2} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`${fieldName}.subtitle`}
                            render={({ field }) => (
                                <FormItem><FormLabel>Subtitle</FormLabel><FormControl><Textarea {...field} rows={4} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`${fieldName}.buttonText`}
                            render={({ field }) => (
                                <FormItem><FormLabel>Button Text</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                            )}
                        />
                        <div className="space-y-3 rounded-lg border p-4">
                            <div className="flex items-center gap-2">
                                <Video className="h-5 w-5 text-primary" />
                                <div>
                                    <FormLabel className="text-base">Hero Background Video</FormLabel>
                                    <p className="text-xs text-muted-foreground">Use an uploaded video or paste a direct video, YouTube or Vimeo link. Video plays muted, automatically and in a loop.</p>
                                </div>
                            </div>
                            <FormItem>
                                <FormLabel>Paste Video Link</FormLabel>
                                <FormControl>
                                    <Input
                                        type="url"
                                        value={videoUrl}
                                        placeholder="https://... (MP4, WebM, YouTube or Vimeo)"
                                        onChange={(event) => {
                                            form.setValue(`${fieldName}.videoUrl`, event.target.value, { shouldDirty: true });
                                            if (event.target.value) form.setValue(`${fieldName}.videoFile`, undefined, { shouldDirty: true });
                                        }}
                                    />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">For direct hosting, use a publicly accessible MP4 or WebM URL. YouTube and Vimeo links are embedded.</p>
                            </FormItem>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Upload Video
                                </Button>
                                <Input
                                    ref={videoInputRef}
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime"
                                    className="hidden"
                                    onChange={(event) => handleVideoSelect(event.target.files?.[0])}
                                />
                                {videoFile && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{videoFile.name}</span>}
                                {(videoFile || videoUrl) && (
                                    <Button type="button" variant="ghost" size="sm" onClick={removeVideo}>
                                        <X className="mr-1 h-4 w-4" /> Remove video
                                    </Button>
                                )}
                            </div>
                            {videoFile && <p className="text-xs text-muted-foreground">Selected video: {(videoFile.size / (1024 * 1024)).toFixed(1)} MB. It will upload when you save Website Content.</p>}
                            {videoUrl && <p className="break-all text-xs text-muted-foreground"><Link2 className="mr-1 inline h-3 w-3" /> {videoUrl}</p>}
                        </div>
                        <div className="space-y-2">
                            <FormItem>
                                <FormLabel>Background Image</FormLabel>
                            {imagePreview ? (
                                <div className="relative group w-full aspect-video">
                                    <Image src={imagePreview} alt="Preview" fill style={{ objectFit: 'cover' }} className="rounded-md border p-1" />
                                     <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}><X className="h-5 w-5" /></Button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                                    {...handleDragEvents}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                    <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                                </div>
                            )}
                            <FormControl>
                                <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        </div>
                    </div>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
