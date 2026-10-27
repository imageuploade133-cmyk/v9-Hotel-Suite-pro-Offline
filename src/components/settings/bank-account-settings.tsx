
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Landmark, Upload, X } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { uploadImage } from '@/lib/helpers';
import Image from 'next/image';

const bankAccountSchema = z.object({
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  bankLogoUrl: z.string().url().optional().or(z.literal('')),
  bankLogoFile: z.instanceof(File).optional(),
});

type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';


export function BankAccountSettingsForm() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { settings, isLoading: isSettingsLoading, refreshSettings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
    const maxFileSize = settings?.maxFileSizeMb ?? 5;


    const form = useForm<BankAccountFormValues>({
        resolver: zodResolver(bankAccountSchema),
        defaultValues: {
            bankName: '',
            accountName: '',
            accountNumber: '',
            bankLogoUrl: '',
        },
    });

    React.useEffect(() => {
        if (settings) {
            form.reset({
                bankName: settings.bankName || '',
                accountName: settings.accountName || '',
                accountNumber: settings.accountNumber || '',
                bankLogoUrl: settings.bankLogoUrl || '',
                bankLogoFile: undefined,
            });
        }
    }, [settings, form]);

    const bankLogoFile = form.watch('bankLogoFile');
    const bankLogoUrl = form.watch('bankLogoUrl');
    const imagePreview = bankLogoFile ? URL.createObjectURL(bankLogoFile) : bankLogoUrl;


    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
             if (file.size > maxFileSize * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Too Large', description: `File must be smaller than ${maxFileSize}MB.` });
                return;
            }
            form.setValue('bankLogoFile', file, { shouldDirty: true });
        }
    };

    const handleRemoveImage = () => {
        form.setValue('bankLogoFile', undefined, { shouldDirty: true });
        form.setValue('bankLogoUrl', '', { shouldDirty: true });
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    async function onSubmit(data: BankAccountFormValues) {
        if (!user || !firestore) {
            toast({
                title: 'Error',
                description: 'User must be logged in to update settings.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const settingsDocRef = doc(firestore, 'settings', 'global');

            let finalLogoUrl = data.bankLogoUrl;
            if (data.bankLogoFile) {
                toast({ title: 'Uploading Bank Logo...' });
                const logoName = `bank-logo-${Date.now()}`;
                finalLogoUrl = await uploadImage(data.bankLogoFile, imgbbApiKey, logoName);
            }

            const dataToSave = {
                bankName: data.bankName,
                accountName: data.accountName,
                accountNumber: data.accountNumber,
                bankLogoUrl: finalLogoUrl,
            };

            await setDoc(settingsDocRef, dataToSave, { merge: true });

            toast({
                title: 'Bank Details Updated',
                variant: 'success',
            });
            refreshSettings();
            form.reset({ ...data, bankLogoUrl: finalLogoUrl, bankLogoFile: undefined }, { keepDirty: false });
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

    if (isSettingsLoading) {
        return <Skeleton className="h-48 w-full" />;
    }

    return (
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Landmark className="h-5 w-5" />
                            Credit Sale Payment Details
                        </CardTitle>
                        <CardDescription>
                            Provide the bank account details that customers should use to pay for credit sales. This will be displayed on credit invoices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="bankName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bank Name</FormLabel>
                                        <FormControl><Input placeholder="e.g., First Bank" {...field} value={field.value || ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="accountName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Name</FormLabel>
                                        <FormControl><Input placeholder="e.g., CACID Test" {...field} value={field.value || ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="accountNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account Number</FormLabel>
                                    <FormControl><Input placeholder="e.g., 0000000000" {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormItem>
                            <FormLabel>Bank Logo (Optional)</FormLabel>
                            {imagePreview ? (
                                <div className="relative group w-40 h-40">
                                    <Image src={imagePreview} alt="Bank Logo Preview" fill style={{ objectFit: 'contain' }} className="rounded-md border p-2" />
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
                    </CardContent>
                     <CardFooter className="border-t px-6 py-4 flex justify-end">
                        <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Bank Details
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
