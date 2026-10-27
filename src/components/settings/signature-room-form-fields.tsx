
'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Upload, X, DollarSign, Star, Bed, Bath, Home as HomeIcon } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';

interface SignatureRoomFormFieldsProps {
  form: UseFormReturn<any>;
}

export function SignatureRoomFormFields({ form }: SignatureRoomFormFieldsProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const { settings } = useSettings();
    const { toast } = useToast();
    const maxFileSize = settings?.maxFileSizeMb ?? 5;

    const imageFile = form.watch('imageFile');
    const imageUrlValue = form.watch('imageUrl');
    const imagePreview = imageFile ? URL.createObjectURL(imageFile) : imageUrlValue;

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Too Large', description: `Must be < ${maxFileSize}MB.` });
                return;
            }
            form.setValue('imageFile', file, { shouldDirty: true });
            form.setValue('imageUrl', '', { shouldDirty: true });
        }
    };

    const handleRemoveImage = () => {
        form.setValue('imageFile', undefined, { shouldDirty: true });
        form.setValue('imageUrl', '', { shouldDirty: true });
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
            if (e.dataTransfer.files) {
                handleFileSelect(e.dataTransfer.files);
            }
        },
    };

    return (
        <form id="signature-room-form" className="space-y-4">
            <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input placeholder="e.g. Deluxe Suite" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea placeholder="A short, appealing description..." {...field} value={field.value || ''} rows={4} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Price per Night</FormLabel>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input type="number" placeholder="e.g. 250" className="pl-8" {...field} value={field.value || ''} /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rating (1-5)</FormLabel>
                             <div className="relative">
                                <Star className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input type="number" min="1" max="5" step="0.1" {...field} value={field.value || ''} className="pl-10" /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="beds" render={({ field }) => (
                    <FormItem><FormLabel>Beds</FormLabel>
                     <div className="relative">
                        <Bed className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" min="1" {...field} value={field.value || ''} className="pl-10" /></FormControl>
                    </div>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bathrooms" render={({ field }) => (
                    <FormItem><FormLabel>Bathrooms</FormLabel>
                     <div className="relative">
                        <Bath className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" min="1" {...field} value={field.value || ''} className="pl-10" /></FormControl>
                    </div>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="size" render={({ field }) => (
                    <FormItem><FormLabel>Size (m²)</FormLabel>
                     <div className="relative">
                        <HomeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" min="1" {...field} value={field.value || ''} className="pl-10" /></FormControl>
                    </div>
                    <FormMessage /></FormItem>
                )} />
            </div>
            <FormField control={form.control} name="rooms" render={({ field }) => (
                <FormItem>
                    <FormLabel>Associated Room Numbers</FormLabel>
                    <FormControl><Input placeholder="e.g. 101, 102, 103" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormItem>
                <FormLabel>Image</FormLabel>
                {imagePreview ? (
                    <div className="relative group w-full aspect-video max-w-sm mx-auto">
                        <Image src={imagePreview} alt="Preview" fill style={{ objectFit: 'cover' }} className="rounded-md border p-2" />
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
                <FormControl><Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)}/></FormControl>
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Or paste Image URL</FormLabel>
                        <FormControl><Input placeholder="https://images.unsplash.com/..." {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormMessage>{form.formState.errors.imageFile?.message}</FormMessage>
            </FormItem>
        </form>
    );
}
