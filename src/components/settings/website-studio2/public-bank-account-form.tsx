
'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Landmark, Upload, X } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';

export function PublicBankAccountForm() {
    const { control, watch, setValue } = useFormContext();
    const { settings } = useSettings();
    const { toast } = useToast();
    const maxFileSize = settings?.maxFileSizeMb ?? 5;
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const fieldName = 'websiteData.footer';
    const imageFile = watch(`${fieldName}.publicBankLogoFile`);
    const imageUrlValue = watch(`${fieldName}.publicBankLogoUrl`);
    const imagePreview = imageFile ? URL.createObjectURL(imageFile) : imageUrlValue;

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Too Large', description: `File must be smaller than ${maxFileSize}MB.` });
                return;
            }
            setValue(`${fieldName}.publicBankLogoFile`, file, { shouldDirty: true });
        }
    };

    const handleRemoveImage = () => {
        setValue(`${fieldName}.publicBankLogoFile`, undefined, { shouldDirty: true });
        setValue(`${fieldName}.publicBankLogoUrl`, '', { shouldDirty: true });
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
        <AccordionItem value="public-bank-details">
            <Card>
                <AccordionTrigger className="p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Landmark className="h-5 w-5" />
                        Public Bank Account
                    </h3>
                </AccordionTrigger>
                 <AccordionContent className="p-4 pt-0">
                    <div className="space-y-4 pt-4">
                    <p className="text-sm text-muted-foreground">Display bank details on your public website, for example in the footer.</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={control}
                                name="websiteData.footer.publicBankName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bank Name</FormLabel>
                                        <FormControl><Input placeholder="e.g., Public Bank" {...field} value={field.value ?? ""} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name="websiteData.footer.publicAccountName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Name</FormLabel>
                                        <FormControl><Input placeholder="e.g., Your Hotel Name" {...field} value={field.value ?? ""} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={control}
                            name="websiteData.footer.publicAccountNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account Number</FormLabel>
                                    <FormControl><Input placeholder="e.g., 1234567890" {...field} value={field.value ?? ""} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormItem>
                            <FormLabel>Bank Logo (Optional)</FormLabel>
                            {imagePreview ? (
                                <div className="relative group w-40 h-40">
                                    <Image key={imagePreview} src={imagePreview} alt="Bank Logo Preview" fill style={{ objectFit: 'contain' }} className="rounded-md border p-2" />
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
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    className="hidden"
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                />
                            </FormControl>
                        </FormItem>
                    </div>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
