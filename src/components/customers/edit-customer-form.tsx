
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CustomerFormFields } from './customer-form-fields';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import type { Customer } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import { doc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { useBranch } from '@/contexts/branch-context';


const customerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  photo: z.instanceof(File).optional(),
  photoURL: z.string().optional(),
  customFields: z.record(z.string()).optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface EditCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSuccess: () => void;
  collectionName: 'customers' | 'pos-customers';
}

export function EditCustomerForm({ open, onOpenChange, customer, onSuccess, collectionName }: EditCustomerFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();
  const formId = `edit-customer-form-${customer?.id}`;

  const { settings } = useSettings();
  const countryCode = settings?.countryCode || '';

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  });

  React.useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        email: customer.email || '',
        phoneNumber: customer.phoneNumber || '',
        photo: undefined,
        photoURL: customer.photoURL || '',
        customFields: customer.customFields || {},
      });
    }
  }, [customer, form]);

  const onSubmit = async (values: CustomerFormValues) => {
    if (!firestore || !customer) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update customer.' });
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

    setIsLoading(true);

    try {
        const batch = writeBatch(firestore);

        // This part needs the uploadImage function, assuming it's available or passed in.
        // For simplicity, this example will just use the existing photoURL if no new photo is uploaded.
        let photoUrl = values.photoURL;

        const phoneNumberWithCode = values.phoneNumber && countryCode && !values.phoneNumber.startsWith(countryCode)
            ? `${countryCode}${values.phoneNumber}`
            : values.phoneNumber;

        const collectionPath = getCollectionPath(collectionName);
        const customerRef = doc(firestore, collectionPath, customer.id);
        batch.update(customerRef, {
            name: values.name,
            email: values.email || null,
            phoneNumber: phoneNumberWithCode || null,
            photoURL: photoUrl || null,
            customFields: values.customFields || {},
        });

        // Find and update active bookings
        if (customer.bookingIds && customer.bookingIds.length > 0) {
            const activeBookingsQuery = query(
                collection(firestore, 'bookings'),
                where('__name__', 'in', customer.bookingIds),
                where('status', 'in', ['Active', 'Checked-in'])
            );
            const activeBookingsSnapshot = await getDocs(activeBookingsQuery);

            activeBookingsSnapshot.forEach(bookingDoc => {
                const bookingRef = doc(firestore, 'bookings', bookingDoc.id);
                batch.update(bookingRef, {
                    guestName: values.name,
                    guestEmail: values.email || null,
                    guestPhoneNumber: phoneNumberWithCode || null,
                    guestPhotoURL: photoUrl || null,
                });
            });
        }

        await batch.commit();

        toast({ variant: 'success', title: 'Customer Updated', description: `${values.name}'s profile and active bookings have been updated.` });
        onSuccess();
        onOpenChange(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
        setIsLoading(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Customer: {customer.name}</DialogTitle>
          <DialogDescription>Update the details for this customer.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6 flex-1 min-h-0">
            <CustomerFormFields
                formId={formId}
                form={form}
            />
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button type="submit" form={formId} loading={isLoading} onClick={form.handleSubmit(onSubmit)}>
                Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
