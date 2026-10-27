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
import { Loader2, Image as ImageIcon, Eye, EyeOff, Upload, X } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { doc, setDoc } from 'firebase/firestore';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { Switch } from '../ui/switch';


const imageSettingsSchema = z.object({
  maxFileSizeMb: z.number().min(1).max(32),
  expirationSeconds: z.number(),
  customExpirationDays: z.number().min(0).max(180).optional(),
  imgbbApiKey: z.string().optional(),
  useGlobalStockImage: z.boolean().default(false),
  globalStockImageUrl: z.string().url().optional().or(z.literal('')),
  globalStockImageFile: z.instanceof(File).optional(),
});

type ImageSettingsFormValues = z.infer<typeof imageSettingsSchema>;

const expirationOptions = [
    { label: 'Never', value: 0 },
    { label: '1 Day', value: 86400 },
    { label: '7 Days', value: 604800 },
    { label: '1 Month', value: 2592000 },
    { label: '3 Months', value: 7776000 },
    { label: '6 Months', value: 15552000 },
    { label: 'Custom', value: -1 },
]

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


export function ImageUploadSettings() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isLoadingSettings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);
    const [showApiKey, setShowApiKey] = React.useState(false);

    const stockImageFileInputRef = React.useRef<HTMLInputElement>(null);
    const [isStockImageDragging, setIsStockImageDragging] = React.useState(false);

    const form = useForm<ImageSettingsFormValues>({
        resolver: zodResolver(imageSettingsSchema),
        defaultValues: {
            maxFileSizeMb: 5,
            expirationSeconds: 0,
            customExpirationDays: 0,
            imgbbApiKey: '',
            useGlobalStockImage: false,
            globalStockImageUrl: '',
        },
    });

    React.useEffect(() => {
        if (settings) {
            const isCustom = !expirationOptions.some(opt => opt.value === settings.expirationSeconds);

            form.reset({
                maxFileSizeMb: settings.maxFileSizeMb ?? 5,
                expirationSeconds: isCustom ? -1 : (settings.expirationSeconds ?? 0),
                customExpirationDays: isCustom ? (settings.expirationSeconds ?? 0) / 86400 : 0,
                imgbbApiKey: settings.imgbbApiKey ?? '',
                useGlobalStockImage: settings.useGlobalStockImage ?? false,
                globalStockImageUrl: settings.globalStockImageUrl ?? '',
                globalStockImageFile: undefined,
            });
        }
    }, [settings, form]);

    const maxFileSizeMb = form.watch('maxFileSizeMb');
    const selectedExpiration = form.watch('expirationSeconds');
    const useGlobalImage = form.watch('useGlobalStockImage');
    const globalStockImageFile = form.watch('globalStockImageFile');
    const globalStockImageUrl = form.watch('globalStockImageUrl');
    const globalStockImagePreview = globalStockImageFile ? URL.createObjectURL(globalStockImageFile) : globalStockImageUrl;


    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > maxFileSizeMb * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'File Too Large',
                    description: `${file.name} is larger than the allowed ${maxFileSizeMb}MB.`
                });
                return;
            }
            form.setValue('globalStockImageFile', file, { shouldDirty: true });
        }
    };

    const handleRemoveImage = () => {
        form.setValue('globalStockImageFile', undefined, { shouldDirty: true });
        form.setValue('globalStockImageUrl', '', { shouldDirty: true });
        if (stockImageFileInputRef.current) stockImageFileInputRef.current.value = '';
    };

    const handleDragEvents = {
        onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsStockImageDragging(true); },
        onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsStockImageDragging(true); },
        onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsStockImageDragging(false); },
        onDrop: (e: React.DragEvent<HTMLDivElement>) => {
           e.preventDefault();
           setIsStockImageDragging(false);
           if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
        },
     };


    async function onSubmit(data: ImageSettingsFormValues) {
        if (!user || !firestore) {
            toast({
                title: 'Error',
                description: 'You must be logged in to update settings.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const expiration = data.expirationSeconds === -1 ? (data.customExpirationDays || 0) * 86400 : data.expirationSeconds;
            let finalGlobalStockImageUrl = data.globalStockImageUrl;
            if (data.globalStockImageFile) {
                toast({ title: 'Uploading Global Stock Image...', description: 'Please wait.' });
                const imageName = `global-stock-image_${Date.now()}`;
                finalGlobalStockImageUrl = await uploadImage(data.globalStockImageFile, data.imgbbApiKey || DEFAULT_IMGBB_API_KEY, imageName, expiration);
            }

            const settingsToSave = {
                maxFileSizeMb: data.maxFileSizeMb,
                expirationSeconds: expiration,
                imgbbApiKey: data.imgbbApiKey,
                useGlobalStockImage: data.useGlobalStockImage,
                globalStockImageUrl: finalGlobalStockImageUrl,
            };

            const settingsDocRef = doc(firestore, 'settings', 'global');
            await setDoc(settingsDocRef, settingsToSave, { merge: true });

            toast({
                title: 'Image Settings Updated',
                description: `Settings have been saved successfully.`,
                variant: 'success',
            });
            form.reset({
                ...data,
                globalStockImageUrl: finalGlobalStockImageUrl,
                globalStockImageFile: undefined,
            }, { keepDirty: false });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update settings.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    }

    const isLoading = isSaving || isLoadingSettings;

    if (isLoadingSettings) {
        return (
            <AccordionItem value="image-uploads" disabled>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-full max-w-lg" />
                    </CardHeader>
                    <CardContent className="space-y-4"><Skeleton className="h-20 w-full" /></CardContent>
                    <CardFooter className="border-t px-6 py-4"><Skeleton className="h-10 w-24" /></CardFooter>
                </Card>
            </AccordionItem>
        )
    }

    return (
        <AccordionItem value="image-uploads">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <fieldset disabled={isSaving} className="group">
                        <Card>
                            <AccordionTrigger className="p-6">
                                <div className="flex items-center gap-3">
                                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                    <div>
                                        <CardTitle>Image Upload Settings</CardTitle>
                                        <CardDescription className="text-left mt-1">
                                            Control the size, auto-deletion policy, and API key for uploaded images.
                                        </CardDescription>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <CardContent className="space-y-6 group-disabled:opacity-50">
                                    <FormField
                                        control={form.control}
                                        name="maxFileSizeMb"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max File Size</FormLabel>
                                                <div className="flex items-center gap-4">
                                                    <FormControl>
                                                        <Slider
                                                            min={1}
                                                            max={32}
                                                            step={1}
                                                            value={[field.value]}
                                                            onValueChange={(value) => field.onChange(value[0])}
                                                        />
                                                    </FormControl>
                                                    <div className="font-semibold w-20 text-center text-sm tabular-nums">
                                                        {maxFileSizeMb} MB
                                                    </div>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="expirationSeconds"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Auto-delete Images</FormLabel>
                                                 <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value)}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select an expiration time..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {expirationOptions.map((option) => (
                                                            <SelectItem key={option.value} value={String(option.value)}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {selectedExpiration === -1 && (
                                        <FormField
                                            control={form.control}
                                            name="customExpirationDays"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Custom Expiration (Days)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="e.g., 45"
                                                            min={0}
                                                            max={180}
                                                            {...field}
                                                            onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Enter a number of days between 0 and 180. 0 means never expire.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    <Separator />
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="useGlobalStockImage"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Use Global Stock Image</FormLabel>
                                                    <FormDescription>
                                                        Enable a default placeholder image for stock items without a specific image.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        {useGlobalImage && (
                                            <FormItem className="pl-4 border-l-2 ml-4">
                                                <FormLabel>Global Stock Placeholder Image</FormLabel>
                                                <FormDescription>This image will be used for any stock item that does not have its own image uploaded.</FormDescription>
                                                {globalStockImagePreview ? (
                                                    <div className="relative group w-40 h-40">
                                                        <Image src={globalStockImagePreview} alt="Global stock image preview" fill style={{ objectFit: 'cover' }} className="rounded-md border p-2" />
                                                        <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}><X className="h-5 w-5" /></Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isStockImageDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                                                        {...handleDragEvents}
                                                        onClick={() => stockImageFileInputRef.current?.click()}>
                                                        <Upload className="w-8 h-8 text-muted-foreground" />
                                                        <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                                                        <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSizeMb}MB</p>
                                                    </div>
                                                )}
                                                <FormControl><Input ref={stockImageFileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileSelect(e.target.files)}/></FormControl>
                                            </FormItem>
                                        )}
                                    </div>
                                    <Separator />
                                     <FormField
                                        control={form.control}
                                        name="imgbbApiKey"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Image Hosting API Key (Imgbb)</FormLabel>
                                                <div className="relative">
                                                    <FormControl>
                                                        <Input type={showApiKey ? 'text' : 'password'} placeholder="Enter your Imgbb API key" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute inset-y-0 right-0 h-full px-3"
                                                        onClick={() => setShowApiKey(!showApiKey)}
                                                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                                                    >
                                                        {showApiKey ? (
                                                            <EyeOff className="h-5 w-5 text-muted-foreground" />
                                                        ) : (
                                                            <Eye className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Settings
                                    </Button>
                                </CardFooter>
                            </AccordionContent>
                        </Card>
                    </fieldset>
                </form>
            </Form>
        </AccordionItem>
    );
}
