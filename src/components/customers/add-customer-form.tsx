'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Upload, X, Mail, Phone, User } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import type { Customer, BookingFormField } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { CustomerFormFields } from './customer-form-fields';
import { useBranch } from '@/contexts/branch-context';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  photo: z.instanceof(File).optional(),
  customFields: z.record(z.string()).optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface AddCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  collectionName?: 'customers' | 'pos-customers';
}

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


export function AddCustomerForm({ open, onOpenChange, onSuccess, collectionName = 'customers' }: AddCustomerFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();
  const formId = `add-customer-form`;

  const { settings } = useSettings();
  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const countryCode = settings?.countryCode || '';

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      photo: undefined,
      customFields: {},
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (values: CustomerFormValues) => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not add customer.' });
        return;
    }

    if (values.name.toLowerCase() === 'walk-in customer') {
        toast({
            variant: 'destructive',
            title: 'Invalid Customer Name',
            description: '\'Walk-in Customer\' is a reserved name and cannot be used.',
        });
        return;
    }

    // Check for duplicates
    if (values.email) {
      const collectionPath = getCollectionPath(collectionName);
      const q = query(collection(firestore, collectionPath), where("email", "==", values.email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Duplicate Customer",
          description: "A customer with this email address already exists.",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
        let photoUrl: string | undefined = undefined;

        if (values.photo) {
            toast({ title: 'Uploading Photo...', description: 'Please wait while the photo is uploaded.' });
            const timestamp = Date.now();
            const safeGuestName = values.name.replace(/\s+/g, '_');
            const newName = `guest-${safeGuestName}_${timestamp}`;
            photoUrl = await uploadImage(values.photo, imgbbApiKey, newName, expirationSeconds);
        }

        const phoneNumberWithCode = values.phoneNumber && countryCode && !values.phoneNumber.startsWith(countryCode) ? `${countryCode}${values.phoneNumber}` : values.phoneNumber;

        const collectionPath = getCollectionPath(collectionName);
        const customersCollection = collection(firestore, collectionPath);
        await addDoc(customersCollection, {
            name: values.name,
            email: values.email || null,
            phoneNumber: phoneNumberWithCode || null,
            photoURL: photoUrl || null,
            createdAt: serverTimestamp(),
            totalBookings: 0,
            bookingIds: [],
            customFields: values.customFields || {},
        });

        toast({ variant: 'success', title: 'Customer Added', description: `${values.name}'s profile has been created.` });
        onSuccess();
        onOpenChange(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Operation Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
        setIsLoading(false);
    }
  };

  const dialogTitle = "Create New Customer";
  const dialogDescription = "Add a new customer profile to your database.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <CustomerFormFields formId={formId} form={form} />
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button type="submit" form={formId} loading={isLoading} onClick={form.handleSubmit(onSubmit)}>
                Create Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
