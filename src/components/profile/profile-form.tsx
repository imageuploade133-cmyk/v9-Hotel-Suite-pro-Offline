
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../auth/auth-provider';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';

const profileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email(),
  photo: z.instanceof(File).optional(),
  photoURL: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadImage(file: File, apiKey: string, name: string): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}&name=${name}`;
    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    const result = await response.json();
    if (result.success) {
        return result.data.url;
    } else {
        throw new Error(result.error?.message || 'Image upload failed');
    }
}

export function ProfileForm() {
    const { userProfile, user, refreshUserProfile } = useUser();
    const { settings, isLoading: settingsLoading } = useSettings();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const firestore = useFirestore();

    const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
    const maxFileSize = settings?.maxFileSizeMb ?? 5;
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { name: '', email: '', photo: undefined, photoURL: '' },
    });

    React.useEffect(() => {
        if (userProfile) {
            form.reset({
                name: userProfile.name || '',
                email: userProfile.email || '',
                photoURL: userProfile.photoURL || '',
            });
        }
    }, [userProfile, form]);

    const photoFile = form.watch('photo');
    const photoUrlValue = form.watch('photoURL');
    const imagePreview = photoFile ? URL.createObjectURL(photoFile) : photoUrlValue;


    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Too Large', description: `File must be smaller than ${maxFileSize}MB.` });
                return;
            }
            form.setValue('photo', file, { shouldDirty: true });
        }
    };

    const handleRemoveImage = () => {
        form.setValue('photo', undefined, { shouldDirty: true });
        form.setValue('photoURL', '', { shouldDirty: true });
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

    const onSubmit = async (data: ProfileFormValues) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        let finalPhotoURL = data.photoURL;

        try {
            if (data.photo) {
                toast({ title: 'Uploading Profile Picture...' });
                const photoName = `profile-${user.uid}-${Date.now()}`;
                finalPhotoURL = await uploadImage(data.photo, imgbbApiKey, photoName);
            }

            await updateProfile(user, { displayName: data.name, photoURL: finalPhotoURL });

            const userDocRef = doc(firestore, 'users', user.uid);
            await setDoc(userDocRef, {
                name: data.name,
                photoURL: finalPhotoURL,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            toast({ variant: 'success', title: 'Profile Updated' });
            refreshUserProfile(); // Trigger a refresh of the user context
            form.reset({ ...data, photo: undefined, photoURL: finalPhotoURL }, { keepDirty: false });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not update your profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your name and profile picture.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Your full name" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="your@email.com" {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormItem>
                            <FormLabel>Profile Picture</FormLabel>
                            {imagePreview ? (
                                 <div className="relative group w-32 h-32">
                                    <Image src={imagePreview} alt="Profile preview" fill style={{ objectFit: 'cover' }} className="rounded-full" />
                                     <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button type="button" variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}><X className="h-5 w-5" /></Button>
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
                                    <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                                </div>
                            )}
                            <FormControl><Input ref={fileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileSelect(e.target.files)}/></FormControl>
                        </FormItem>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
