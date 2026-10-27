'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { useBranch } from '@/contexts/branch-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Store, PlusCircle, ArrowLeft, Upload, X } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import Link from 'next/link';
import { uploadImage } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const branchFormSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters long.'),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  logoUrl: z.string().optional(),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

export default function CreateBranchPage() {
  const { user } = useAuth();
  const { userProfile, loading: profileLoading } = useUser();
  const { selectBranch } = useBranch();
  const router = useRouter();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { name: '', address: '', phoneNumber: '', logoUrl: '' },
  });

  const logoUrl = form.watch('logoUrl');
  const branchName = form.watch('name');

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const file = selectedFiles[0];

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: `Image must be less than ${maxFileSize}MB.`
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please select an image file (PNG, JPG, etc.).'
      });
      return;
    }

    setIsUploading(true);
    try {
      const photoName = `branch-logo-${branchName?.replace(/\s+/g, '-') || 'new'}-${Date.now()}`;
      const uploadedUrl = await uploadImage(file, imgbbApiKey, photoName);
      form.setValue('logoUrl', uploadedUrl, { shouldValidate: true });
      toast({ variant: 'success', title: 'Logo Uploaded' });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'Failed to upload logo. Please try again.'
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    form.setValue('logoUrl', '', { shouldValidate: true });
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

  const onSubmit = async (values: BranchFormValues) => {
    setIsSubmitting(true);
    try {
      // Check for duplicate branch name (globally)
      const q = query(collection(db, 'branches'), where('name', '==', values.name));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        form.setError('name', {
          type: 'manual',
          message: 'A branch with this name already exists.',
        });
        setIsSubmitting(false);
        return;
      }

      // Add new branch to Firestore
      const docRef = await addDoc(collection(db, 'branches'), {
        name: values.name,
        address: values.address || null,
        phoneNumber: values.phoneNumber || null,
        logoUrl: values.logoUrl || null,
        status: 'active', // Default status
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Branch Created',
        description: `The branch "${values.name}" has been successfully created.`,
      });

      // Services & Foods collection will be created automatically when user adds the first service
      // No pre-initialization needed - this keeps the implementation simple and robust

      // Automatically select the new branch
      selectBranch(docRef.id);

      // Redirect to the manage page
      router.push('/branch/manage');

    } catch (error: any) {
      console.error('Error creating branch:', error);
      toast({
        variant: 'destructive',
        title: 'Error Creating Branch',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // All Firebase users have full admin access

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                <Link href="/dashboard"><ArrowLeft className="h-5 w-5"/></Link>
            </Button>
            <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-primary" />
                <h1 className="font-headline text-3xl font-semibold">Create New Branch</h1>
            </div>
        </div>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Card className="shadow-lg max-w-2xl">
                    <CardHeader>
                        <CardTitle>Branch Details</CardTitle>
                        <CardDescription>Enter the details for your new business branch.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Downtown Store"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., 123 Main Street, Commerce City"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone Number (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="tel"
                                            placeholder="e.g., +1 234 567 890"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="logoUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch Logo (Optional)</FormLabel>
                                    {field.value ? (
                                        <div className="relative w-full h-32 border rounded-md overflow-hidden bg-muted">
                                            <Image
                                                src={field.value}
                                                alt="Branch Logo"
                                                fill
                                                className="object-contain"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-2 right-2 h-8 w-8"
                                                onClick={handleRemoveLogo}
                                                disabled={isSubmitting}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            {...handleDragEvents}
                                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                                                isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'
                                            }`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                fileInputRef.current?.click();
                                            }}
                                        >
                                            {isUploading ? (
                                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                            ) : (
                                                <>
                                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/jpg"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        disabled={isSubmitting || isUploading}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Create Branch
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    </div>
  );
}
