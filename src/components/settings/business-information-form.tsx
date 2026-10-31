
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Upload, X } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { doc, setDoc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { Textarea } from '../ui/textarea';
import { Slider } from '@/components/ui/slider';
import { InvoicePreview } from './invoice-preview';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

const businessInfoSchema = z.object({
  businessName: z.string().optional(),
  websiteName: z.string().optional(),
  businessPhone: z.string().optional(),
  businessAddress: z.string().optional(),
  businessEmail: z.string().email('Invalid email.').optional().or(z.literal('')),
  businessWebsite: z.string().optional(),
  businessLogoUrl: z.string().url().optional().or(z.literal('')),
  businessLogoFile: z.instanceof(File).optional(),
  websiteLogoUrl: z.string().url().optional().or(z.literal('')),
  websiteLogoFile: z.instanceof(File).optional(),
  businessLogoSize: z.number().min(20).max(100),
  showWatermarkLogo: z.boolean().default(false),
  watermarkLogoUrl: z.string().url().optional().or(z.literal('')),
  watermarkLogoFile: z.instanceof(File).optional(),
  watermarkOpacity: z.number().min(0).max(1),
  watermarkSize: z.number().min(10).max(100),
  watermarkPosition: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tile']),
  useHDPrinting: z.boolean().default(true),
  showReportQrOnReceipt: z.boolean().default(true),
});

type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadImage(file: File, apiKey: string, name: string, expiration?: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const base64Image = event.target.result.split(',')[1];
                const formData = new FormData();
                formData.append('image', base64Image);
                formData.append('name', name);

                let uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;
                if (expiration && expiration > 0) {
                    uploadUrl += `&expiration=${expiration}`;
                }

                try {
                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        body: formData,
                    });

                    const result = await response.json();
                    if (result.success) {
                        resolve(result.data.url);
                    } else {
                        reject(new Error(result.error?.message || 'Image upload failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            } else {
                 reject(new Error('Failed to read file.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}


export function BusinessInformationForm() {
    const { toast } = useToast();
    const { user, userProfile } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const logoFileInputRef = React.useRef<HTMLInputElement>(null);
    const websiteLogoFileInputRef = React.useRef<HTMLInputElement>(null);
    const watermarkFileInputRef = React.useRef<HTMLInputElement>(null);
    const [isLogoDragging, setIsLogoDragging] = React.useState(false);
    const [isWebsiteLogoDragging, setIsWebsiteLogoDragging] = React.useState(false);
    const [isWatermarkDragging, setIsWatermarkDragging] = React.useState(false);

    const expirationSeconds = settings?.expirationSeconds ?? 0;
    const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
    const maxFileSize = settings?.maxFileSizeMb ?? 5;


    const form = useForm<BusinessInfoFormValues>({
        resolver: zodResolver(businessInfoSchema),
        defaultValues: {
            businessName: 'Hotel Suite Pro',
            websiteName: 'Hotel Suite Pro',
            businessPhone: '+1 (800) 555-0199',
            businessAddress: '123 Luxury Lane, Suite 100, Metropolis, ST 12345',
            businessEmail: 'contact@hotelsuitepro.com',
            businessWebsite: 'https://www.hotelsuitepro.com',
            businessLogoUrl: '',
            websiteLogoUrl: '',
            businessLogoSize: 48,
            showWatermarkLogo: false,
            watermarkLogoUrl: '',
            watermarkOpacity: 0.07,
            watermarkSize: 50,
            watermarkPosition: 'center',
            useHDPrinting: true,
            showReportQrOnReceipt: true,
        },
    });
    const { reset, watch } = form;

    React.useEffect(() => {
        if (settings) {
            reset({
                businessName: settings.businessName || 'Hotel Suite Pro',
                websiteName: settings.websiteName || settings.businessName || 'Hotel Suite Pro',
                businessPhone: settings.businessPhone || '+1 (800) 555-0199',
                businessAddress: settings.businessAddress || '123 Luxury Lane, Suite 100, Metropolis, ST 12345',
                businessEmail: settings.businessEmail || 'contact@hotelsuitepro.com',
                businessWebsite: settings.businessWebsite || 'https://www.hotelsuitepro.com',
                businessLogoUrl: settings.businessLogoUrl || '',
                businessLogoFile: undefined,
                websiteLogoUrl: settings.websiteLogoUrl || '',
                websiteLogoFile: undefined,
                businessLogoSize: settings.businessLogoSize || 48,
                showWatermarkLogo: settings.showWatermarkLogo || false,
                watermarkLogoUrl: settings.watermarkLogoUrl || '',
                watermarkLogoFile: undefined,
                watermarkOpacity: settings.watermarkOpacity ?? 0.07,
                watermarkSize: settings.watermarkSize ?? 50,
                watermarkPosition: settings.watermarkPosition ?? 'center',
                useHDPrinting: settings.useHDPrinting ?? true,
                showReportQrOnReceipt: settings.showReportQrOnReceipt ?? true,
            });
        }
    }, [settings, reset]);

    const watchedFormValues = watch();
    const logoFile = watchedFormValues.businessLogoFile;
    const logoUrl = watchedFormValues.businessLogoUrl;
    const logoImagePreview = logoFile ? URL.createObjectURL(logoFile) : logoUrl;

    const websiteLogoFile = watchedFormValues.websiteLogoFile;
    const websiteLogoUrl = watchedFormValues.websiteLogoUrl;
    const websiteLogoImagePreview = websiteLogoFile ? URL.createObjectURL(websiteLogoFile) : websiteLogoUrl;

    const watermarkFile = watchedFormValues.watermarkLogoFile;
    const watermarkUrl = watchedFormValues.watermarkLogoUrl;
    const watermarkImagePreview = watermarkFile ? URL.createObjectURL(watermarkFile) : watermarkUrl;


    const handleFileSelect = (fileType: 'logo' | 'watermark' | 'websiteLogo') => (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'File Too Large',
                    description: `${file.name} is larger than the allowed ${maxFileSize}MB.`
                });
                return;
            }
            if (fileType === 'logo') {
                form.setValue('businessLogoFile', file, { shouldDirty: true });
            } else if (fileType === 'websiteLogo') {
                form.setValue('websiteLogoFile', file, { shouldDirty: true });
            } else {
                form.setValue('watermarkLogoFile', file, { shouldDirty: true });
            }
        }
    };

    const handleRemoveImage = (fileType: 'logo' | 'watermark' | 'websiteLogo') => () => {
        if (fileType === 'logo') {
            form.setValue('businessLogoFile', undefined, { shouldDirty: true });
            form.setValue('businessLogoUrl', '', { shouldDirty: true });
            if (logoFileInputRef.current) logoFileInputRef.current.value = '';
        } else if (fileType === 'websiteLogo') {
            form.setValue('websiteLogoFile', undefined, { shouldDirty: true });
            form.setValue('websiteLogoUrl', '', { shouldDirty: true });
            if (websiteLogoFileInputRef.current) websiteLogoFileInputRef.current.value = '';
        } else {
            form.setValue('watermarkLogoFile', undefined, { shouldDirty: true });
            form.setValue('watermarkLogoUrl', '', { shouldDirty: true });
            if (watermarkFileInputRef.current) watermarkFileInputRef.current.value = '';
        }
    };

    const handleDragEvents = (type: 'logo' | 'watermark' | 'websiteLogo') => ({
     onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (type === 'logo') setIsLogoDragging(true); else if (type === 'websiteLogo') setIsWebsiteLogoDragging(true); else setIsWatermarkDragging(true); },
     onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (type === 'logo') setIsLogoDragging(true); else if (type === 'websiteLogo') setIsWebsiteLogoDragging(true); else setIsWatermarkDragging(true); },
     onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (type === 'logo') setIsLogoDragging(false); else if (type === 'websiteLogo') setIsWebsiteLogoDragging(false); else setIsWatermarkDragging(false); },
     onDrop: (e: React.DragEvent<HTMLDivElement>) => {
           e.preventDefault();
           if (type === 'logo') setIsLogoDragging(false); else if (type === 'websiteLogo') setIsWebsiteLogoDragging(false); else setIsWatermarkDragging(false);
           if (e.dataTransfer.files) handleFileSelect(type)(e.dataTransfer.files);
        },
     });


    async function onSubmit(data: BusinessInfoFormValues) {
        if (!user || !firestore || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'User must be logged in.' });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const settingsDocRef = doc(firestore, 'settings', 'global');

            let finalLogoUrl = data.businessLogoUrl;
            if (data.businessLogoFile) {
                toast({ title: 'Uploading Business Logo...', description: 'Please wait.' });
                const logoName = `business-logo_${Date.now()}`;
                finalLogoUrl = await uploadImage(data.businessLogoFile, imgbbApiKey, logoName, expirationSeconds);
            }

            let finalWebsiteLogoUrl = data.websiteLogoUrl;
            if (data.websiteLogoFile) {
                toast({ title: 'Uploading Website Logo...', description: 'Please wait.' });
                const logoName = `website-logo_${Date.now()}`;
                finalWebsiteLogoUrl = await uploadImage(data.websiteLogoFile, imgbbApiKey, logoName, expirationSeconds);
            }

            let finalWatermarkUrl = data.watermarkLogoUrl;
            if (data.watermarkLogoFile) {
                toast({ title: 'Uploading Watermark...', description: 'Please wait.' });
                const watermarkName = `watermark-logo_${Date.now()}`;
                finalWatermarkUrl = await uploadImage(data.watermarkLogoFile, imgbbApiKey, watermarkName, expirationSeconds);
            }

            const settingsToSave = {
                businessName: data.businessName,
                websiteName: data.websiteName,
                businessPhone: data.businessPhone,
                businessAddress: data.businessAddress,
                businessEmail: data.businessEmail,
                businessWebsite: data.businessWebsite,
                businessLogoUrl: finalLogoUrl,
                websiteLogoUrl: finalWebsiteLogoUrl,
                businessLogoSize: data.businessLogoSize,
                showWatermarkLogo: data.showWatermarkLogo,
                watermarkLogoUrl: finalWatermarkUrl,
                watermarkOpacity: data.watermarkOpacity,
                watermarkSize: data.watermarkSize,
                watermarkPosition: data.watermarkPosition,
                useHDPrinting: data.useHDPrinting,
                showReportQrOnReceipt: data.showReportQrOnReceipt,
            };

            const changes: {field: string, before: any, after: any}[] = [];
            Object.keys(settingsToSave).forEach(key => {
                const settingKey = key as keyof typeof settingsToSave;
                if (settings && settings[settingKey] !== settingsToSave[settingKey]) {
                    changes.push({
                        field: key.replace(/([A-Z])/g, ' $1').trim(),
                        before: settings[settingKey] || 'Not set',
                        after: settingsToSave[settingKey]
                    });
                }
            });

            if (changes.length > 0) {
                try {
                    batch.set(settingsDocRef, settingsToSave, { merge: true });

                    const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
                    batch.set(auditLogRef, {
                        timestamp: serverTimestamp(),
                        userId: userProfile.uid,
                        userName: userProfile.name,
                        changeType: 'Update',
                        entityType: 'Settings',
                        entityId: 'Business Information',
                        details: 'Updated business information settings.',
                        changes,
                    });

                    await batch.commit();
                } catch (cloudErr) {
                    console.warn('[Business Info] Cloud write error (offline mode):', cloudErr);
                }

                // Sync directly to Local Master Server LAN Store for instant 100% offline persistence
                try {
                    await fetch('/api/lan-sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            collectionName: 'settings',
                            docId: 'global',
                            action: 'set',
                            data: settingsToSave,
                        }),
                    });
                } catch (lanErr) {
                    console.warn('[Business Info] LAN sync error:', lanErr);
                }

                // Sync immediately to local browser storage & firestoreCache
                try {
                    if (typeof window !== 'undefined') {
                        const existing = JSON.parse(localStorage.getItem('app_saved_settings') || '{}');
                        const updated = { ...existing, ...settingsToSave };
                        localStorage.setItem('app_saved_settings', JSON.stringify(updated));
                    }
                } catch {}
            }

            toast({
                title: 'Business Information Updated',
                description: 'Your business details have been saved.',
                variant: 'success',
            });
            reset({
                ...data,
                businessLogoUrl: finalLogoUrl,
                businessLogoFile: undefined,
                websiteLogoUrl: finalWebsiteLogoUrl,
                websiteLogoFile: undefined,
                watermarkLogoUrl: finalWatermarkUrl,
                watermarkLogoFile: undefined,
            }, { keepDirty: false });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    const isLoading = isSaving || isSettingsLoading;

    if (isSettingsLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                   <Skeleton className="h-10 w-40" />
                </CardFooter>
            </Card>
            <div className="sticky top-20">
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent><Skeleton className="h-96 w-full" /></CardContent>
                </Card>
            </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <CardTitle>Business Information</CardTitle>
                            <CardDescription>This information will appear on invoices, receipts, and other documents.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <fieldset disabled={isLoading} className="group">
                            <CardContent className="space-y-6 group-disabled:opacity-50">
                                <FormField
                                    control={form.control}
                                    name="businessName"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input placeholder="Your Hotel's Name" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="websiteName"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Website Name</FormLabel><FormControl><Input placeholder="Name for Public Website" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="businessPhone"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1 234 567 890" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="businessEmail"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="contact@yourhotel.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="businessWebsite"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="https://yourhotel.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="businessAddress"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea placeholder="123 Main St, Anytown, USA" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />

                                <Separator/>

                                <div className="space-y-4 rounded-lg border p-4">
                                     <FormLabel>Business Logo</FormLabel>
                                    <FormDescription>Used on receipts, invoices, and the application sidebar.</FormDescription>
                                    {logoImagePreview ? (
                                        <div className="relative group w-40 h-40">
                                            <Image src={logoImagePreview} alt="Logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md border p-2" />
                                            <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage('logo')}><X className="h-5 w-5" /></Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isLogoDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                                            {...handleDragEvents('logo')}
                                            onClick={() => logoFileInputRef.current?.click()}>
                                            <Upload className="w-8 h-8 text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                                        </div>
                                    )}
                                    <FormControl><Input ref={logoFileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileSelect('logo')(e.target.files)}/></FormControl>
                                </div>
                                <div className="space-y-4 rounded-lg border p-4">
                                    <FormLabel>Website Logo</FormLabel>
                                    <FormDescription>Used specifically on the public-facing website header.</FormDescription>
                                    {websiteLogoImagePreview ? (
                                        <div className="relative group w-40 h-40">
                                            <Image src={websiteLogoImagePreview} alt="Website logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md border p-2" />
                                            <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage('websiteLogo')}><X className="h-5 w-5" /></Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isWebsiteLogoDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                                            {...handleDragEvents('websiteLogo')}
                                            onClick={() => websiteLogoFileInputRef.current?.click()}>
                                            <Upload className="w-8 h-8 text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                                        </div>
                                    )}
                                    <FormControl><Input ref={websiteLogoFileInputRef} type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={(e) => handleFileSelect('websiteLogo')(e.target.files)}/></FormControl>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="businessLogoSize"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Logo Size on Documents</FormLabel>
                                            <div className="flex items-center gap-4">
                                                <FormControl>
                                                    <Slider
                                                        min={20}
                                                        max={100}
                                                        step={1}
                                                        value={[field.value]}
                                                        onValueChange={(value) => field.onChange(value[0])}
                                                    />
                                                </FormControl>
                                                <div className="font-semibold w-20 text-center text-sm tabular-nums">
                                                    {watchedFormValues.businessLogoSize}px
                                                </div>
                                            </div>
                                            <FormDescription>Controls the height of the logo on invoices and receipts.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Separator />
                                <FormField
                                    control={form.control}
                                    name="useHDPrinting"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">HD Quality Print</FormLabel>
                                                <FormDescription>
                                                    Enable for high-fidelity styled invoices, disable for faster, draft-quality printing.
                                                </FormDescription>
                                            </div>
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="showReportQrOnReceipt"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">Show Report QR on Receipts</FormLabel>
                                                <FormDescription>
                                                    Display a QR code on booking receipts for guests to report issues.
                                                </FormDescription>
                                            </div>
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <Separator />
                                 <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="showWatermarkLogo"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Enable Invoice Watermark</FormLabel>
                                                    <FormDescription>
                                                        Display a faint logo in the center of your invoices for a professional touch.
                                                    </FormDescription>
                                                </div>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    {watchedFormValues.showWatermarkLogo && (
                                        <div className="space-y-4 pl-4 border-l-2 ml-4">
                                            <FormItem>
                                                <FormLabel>Watermark Logo</FormLabel>
                                                <FormDescription>A transparent PNG works best.</FormDescription>
                                                {watermarkImagePreview ? (
                                                    <div className="relative group w-40 h-40">
                                                        <Image src={watermarkImagePreview} alt="Watermark preview" fill style={{ objectFit: 'contain' }} className="rounded-md border p-2" />
                                                        <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage('watermark')}><X className="h-5 w-5" /></Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isWatermarkDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                                                        {...handleDragEvents('watermark')}
                                                        onClick={() => watermarkFileInputRef.current?.click()}>
                                                        <Upload className="w-8 h-8 text-muted-foreground" />
                                                        <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                                                        <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                                                    </div>
                                                )}
                                                <FormControl><Input ref={watermarkFileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileSelect('watermark')(e.target.files)}/></FormControl>
                                            </FormItem>

                                            <FormField
                                                control={form.control}
                                                name="watermarkOpacity"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Watermark Opacity</FormLabel>
                                                        <div className="flex items-center gap-4">
                                                            <FormControl><Slider min={0} max={1} step={0.01} value={[field.value]} onValueChange={(value) => field.onChange(value[0])} /></FormControl>
                                                            <div className="font-semibold w-20 text-center text-sm tabular-nums">{Math.round(watchedFormValues.watermarkOpacity * 100)}%</div>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="watermarkSize"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Watermark Size</FormLabel>
                                                        <div className="flex items-center gap-4">
                                                            <FormControl><Slider min={10} max={100} step={1} value={[field.value]} onValueChange={(value) => field.onChange(value[0])} /></FormControl>
                                                            <div className="font-semibold w-20 text-center text-sm tabular-nums">{watchedFormValues.watermarkSize}%</div>
                                                        </div>
                                                        <FormDescription>Percentage of the invoice width.</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="watermarkPosition"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Watermark Position</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Select a position" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="center">Center</SelectItem>
                                                        <SelectItem value="top-left">Top Left</SelectItem>
                                                        <SelectItem value="top-right">Top Right</SelectItem>
                                                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                                        <SelectItem value="tile">Tile</SelectItem>
                                                    </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />

                                        </div>
                                    )}
                                 </div>

                            </CardContent>
                            <CardFooter className="border-t px-6 py-4">
                                <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Information
                                </Button>
                            </CardFooter>
                        </fieldset>
                    </form>
                </Form>
            </Card>
            <div className="sticky top-20">
                 <InvoicePreview
                    {...watchedFormValues}
                    businessLogoUrl={logoImagePreview}
                    websiteLogoUrl={websiteLogoImagePreview}
                    watermarkUrl={watermarkImagePreview}
                    currency={settings?.currency || 'USD'}
                />
            </div>
        </div>
    );
}
