'use client';

import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import type { Branch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const editBranchFormSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters long.'),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  logoUrl: z.string().optional(),
});

export type BranchFormValues = z.infer<typeof editBranchFormSchema>;

interface EditBranchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  branch: Branch | null;
  isSubmitting: boolean;
}

export function EditBranchDialog({ isOpen, onOpenChange, onSubmit, branch, isSubmitting }: EditBranchDialogProps) {
  const { settings } = useSettings();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(editBranchFormSchema),
    defaultValues: {
      name: '',
      address: '',
      phoneNumber: '',
      logoUrl: '',
    },
  });

  const logoUrl = form.watch('logoUrl');

  React.useEffect(() => {
    if (branch) {
      form.reset({
        name: branch.name,
        address: branch.address || '',
        phoneNumber: branch.phoneNumber || '',
        logoUrl: branch.logoUrl || '',
      });
    }
  }, [branch, form]);

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
      const photoName = `branch-logo-${branch?.name?.replace(/\s+/g, '-') || 'new'}-${Date.now()}`;
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

  const handleSubmit = async (values: BranchFormValues) => {
    await onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
          <DialogDescription>
            Update the details for this branch.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
