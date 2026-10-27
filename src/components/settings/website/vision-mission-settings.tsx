
'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';

const ColorPicker = ({ field, label }: { field: any; label: string; }) => (
    <FormItem>
        <FormLabel>{label}</FormLabel>
        <div className="relative">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border" style={{ backgroundColor: field.value }} />
            <Input type="text" {...field} value={field.value || ''} className="pl-10" />
            <Input
                type="color"
                value={field.value || '#000000'}
                onChange={(e) => field.onChange(e.target.value)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 cursor-pointer p-0 border-none bg-transparent"
            />
        </div>
        <FormMessage />
    </FormItem>
);

interface VisionMissionSettingsProps {
    form: UseFormReturn<any>;
    sectionId: string;
}

export function VisionMissionSettings({
    form,
    sectionId,
}: VisionMissionSettingsProps) {
    const fieldName = 'websiteData.sections.vision_mission';

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const imageFile = form.watch(`${fieldName}.imageFile`);
    const imageUrlValue = form.watch(`${fieldName}.imageUrl`);
    const imagePreview = imageFile ? URL.createObjectURL(imageFile) : imageUrlValue;

    const { settings } = useSettings();
    const { toast } = useToast();
    const maxFileSize = settings?.maxFileSizeMb ?? 5;


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
                        <Eye className="h-5 w-5" />
                        Vision & Mission Section
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
                    <Separator/>
                    <FormField
                        control={form.control}
                        name={`${fieldName}.mainTitle`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Main Title</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.visionTitle`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Vision Title</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.visionDescription`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Vision Description</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.missionTitle`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mission Title</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`${fieldName}.missionDescription`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mission Description</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ""} rows={4} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name={`${fieldName}.bgColor`}
                        render={({ field }) => <ColorPicker field={field} label="Background Color" />}
                    />
                     <FormItem>
                        <FormLabel>Section Image</FormLabel>
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
                            <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
