
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X, User, Phone, Mail } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';
import type { Customer, BookingFormField } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { query } from 'firebase/firestore';


const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  photo: z.instanceof(File).optional(),
  photoURL: z.string().optional(),
  customFields: z.record(z.string()).optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormFieldsProps {
  formId: string;
  form: any;
}


export function CustomerFormFields({ formId, form }: CustomerFormFieldsProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const { toast } = useToast();
    const { settings } = useSettings();
    const firestore = useFirestore();

    const maxFileSize = settings?.maxFileSizeMb ?? 5;
    const countryCode = settings?.countryCode || '';

    const imagePreview = form.watch('photo') ? URL.createObjectURL(form.watch('photo')) : form.watch('photoURL');


    const bookingFormFieldsQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'bookingFormFields'));
    }, [firestore]);
    const { data: customFieldsData } = useCollection<BookingFormField>(bookingFormFieldsQuery);

    const handleFileSelect = (files: FileList | null) => {
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
            form.setValue('photo', file);
            form.setValue('photoURL', URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        form.setValue('photo', undefined);
        form.setValue('photoURL', '');
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    return (
        <Form {...form}>
            <form id={formId} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                             <div className="relative">
                                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <FormControl><Input placeholder="John Doe" className="pl-10" {...field} /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="name@example.com"
                                        className="pl-10"
                                        {...field}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                  <span className="text-muted-foreground sm:text-sm">{countryCode}</span>
                                </div>
                                <FormControl><Input placeholder="1 234 567 890" className="pl-10" {...field} /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {customFieldsData && customFieldsData.filter(f => f.saveToCustomer).map((field: any) => (
                    <FormField
                        key={field.id}
                        control={form.control}
                        name={`customFields.${field.name}`}
                        render={({ field: formField }) => (
                        <FormItem>
                            <FormLabel>{field.name}</FormLabel>
                            <FormControl>
                            <Input placeholder={`Enter ${field.name.toLowerCase()}`} {...formField} value={formField.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                ))}

                <FormItem>
                    <FormLabel>Customer Picture (Optional)</FormLabel>
                     {imagePreview ? (
                        <div className="relative group w-40 h-40 mx-auto">
                            <Image
                                src={imagePreview}
                                alt="Customer preview"
                                fill
                                style={{ objectFit: 'cover' }}
                                className="rounded-full"
                            />
                             <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
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
                    <FormMessage />
                </FormItem>
            </form>
        </Form>
    )
}
