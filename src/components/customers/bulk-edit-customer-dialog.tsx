
'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import type { Customer } from '@/lib/types';
import { Trash2, User, Phone } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';

const singleCustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required.'),
  phoneNumber: z.string().optional(),
});

const bulkEditSchema = z.object({
  customers: z.array(singleCustomerSchema),
});

type BulkEditFormValues = z.infer<typeof bulkEditSchema>;

interface BulkEditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onSuccess: () => void;
  collectionName?: 'customers' | 'pos-customers';
}

function CustomerSubForm({ control, index, remove, customer }: { control: any; index: number; remove: (index: number) => void; customer: Customer }) {
    return (
        <div className="space-y-4 p-4 border rounded-lg relative bg-background/50">
             <h3 className="font-semibold text-foreground">{customer.name}</h3>
             <p className="text-sm text-muted-foreground -mt-2">{customer.email}</p>
            <Controller
                control={control}
                name={`customers.${index}.name`}
                render={({ field, fieldState }) => (
                    <div>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input {...field} placeholder="Customer Name" className="pl-10"/>
                        </div>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                    </div>
                )}
            />
            <Controller
                control={control}
                name={`customers.${index}.phoneNumber`}
                render={({ field }) => (
                     <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input {...field} placeholder="Phone Number" className="pl-10"/>
                    </div>
                )}
            />
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove customer</span>
            </Button>
        </div>
    )
}

function BulkEditFormFields({ onOpenChange, formId, customers, setIsSaving, onSuccess, collectionName }: {onOpenChange: (open: boolean) => void, formId: string, customers: Customer[], setIsSaving: (isSaving: boolean) => void, onSuccess: () => void, collectionName: 'customers' | 'pos-customers' }) {
    const { toast } = useToast();
    const firestore = useFirestore();

    const form = useForm<BulkEditFormValues>({
        resolver: zodResolver(bulkEditSchema),
        defaultValues: {
          customers: customers.map(c => ({ id: c.id, name: c.name, phoneNumber: c.phoneNumber || '' })),
        },
      });

    const { fields, remove } = useFieldArray({
        control: form.control,
        name: "customers",
    });

    React.useEffect(() => {
        form.reset({ customers: customers.map(c => ({id: c.id, name: c.name, phoneNumber: c.phoneNumber || '' })) });
    }, [customers, form]);

    const handleFormSubmit = async (values: BulkEditFormValues) => {
        if (!firestore) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not update customers.' });
          return;
        }

        if (values.customers.length === 0) {
            toast({ title: 'No customers to update', description: 'All customers were removed from the list.' });
            onOpenChange(false);
            return;
        }

        setIsSaving(true);
        try {
          const batch = writeBatch(firestore);
          values.customers.forEach((customer) => {
            const customerRef = doc(firestore, collectionName, customer.id);
            batch.update(customerRef, {
              name: customer.name,
              phoneNumber: customer.phoneNumber
            });
          });
          await batch.commit();

          toast({
            variant: 'success',
            title: 'Customers Updated',
            description: `${values.customers.length} customer profile(s) have been successfully updated.`,
          });
          onSuccess();
          onOpenChange(false);
          form.reset();
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error updating customers',
            description: error.message || 'An unexpected error occurred.',
          });
        } finally {
          setIsSaving(false);
        }
    };

    return (
        <Form {...form}>
            <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                {fields.map((field, index) => (
                    <CustomerSubForm key={field.id} control={form.control} index={index} remove={remove} customer={customers[index]}/>
                ))}
            </form>
        </Form>
    )
}

export function BulkEditCustomerDialog({ open, onOpenChange, customers, onSuccess, collectionName = 'customers' }: BulkEditCustomerDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const formId = `bulk-edit-customer-form`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Edit {customers.length} Customers</DialogTitle>
          <DialogDescription>
            Edit the details for each selected customer below. Click "Save All Changes" when you're done.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
           <BulkEditFormFields onOpenChange={onOpenChange} formId={formId} customers={customers} setIsSaving={setIsSaving} onSuccess={onSuccess} collectionName={collectionName} />
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSaving}>
            Save All Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
