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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';
import { getNewDocumentData } from '@/lib/branch-helpers';
import type { StockSupplier } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { User, Phone, Mail, MapPin, Tag, FileText } from 'lucide-react';

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required.'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email.').optional().or(z.literal('')),
  address: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface AddEditSupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: StockSupplier | null;
  onSuccess: () => void;
}

export function AddEditSupplierDialog({ isOpen, onClose, supplier, onSuccess }: AddEditSupplierDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const branchContext = useBranch();
  const { getCollectionPath } = branchContext;
  const isEditMode = !!supplier;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  React.useEffect(() => {
    if (isOpen) {
      if (supplier) {
        form.reset(supplier);
      } else {
        form.reset({
          name: '',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          category: '',
          notes: '',
        });
      }
    }
  }, [isOpen, supplier, form]);

  const onSubmit = async (data: SupplierFormValues) => {
    if (!firestore || !userProfile) return;
    setIsSaving(true);

    try {
      if (isEditMode && supplier) {
        // Use the correct collection path based on branch context
        const actualCollectionPath = supplier.branchId
          ? `branches/${supplier.branchId}/suppliers`
          : 'suppliers';
        const docRef = doc(firestore, actualCollectionPath, supplier.id);
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp(), updatedBy: userProfile.name });
        toast({ variant: 'success', title: 'Supplier Updated' });
      } else {
        // Use getCollectionPath to determine the correct path based on branch mode
        const supplierData = getNewDocumentData({
          ...data,
          createdAt: serverTimestamp(),
          createdBy: userProfile.name,
        }, branchContext);

        await addDoc(collection(firestore, getCollectionPath('suppliers')), supplierData);
        toast({ variant: 'success', title: 'Supplier Added' });
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Supplier</DialogTitle>
          <DialogDescription>{isEditMode ? 'Update the' : 'Create a new'} supplier for your inventory.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="supplier-form" onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[65vh] -mx-6 px-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                       <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl><Input placeholder="e.g., Global Beverages Inc." className="pl-10" {...field} /></FormControl>
                        </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                       <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl><Input placeholder="e.g., Jane Smith" className="pl-10" {...field} /></FormControl>
                        </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                         <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl><Input placeholder="+1 234 567 890" className="pl-10" {...field} /></FormControl>
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
                            <FormControl><Input type="email" placeholder="contact@globalbev.com" className="pl-10" {...field} /></FormControl>
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                       <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 -translate-y-0 text-muted-foreground" />
                            <FormControl><Textarea placeholder="123 Industrial Way, Anytown" className="pl-10" {...field} /></FormControl>
                        </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <div className="relative">
                            <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl><Input placeholder="e.g., Stock, Laundry, Barbing Salon" className="pl-10" {...field} /></FormControl>
                        </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <div className="relative">
                            <FileText className="absolute left-3 top-3 h-4 w-4 -translate-y-0 text-muted-foreground" />
                            <FormControl><Textarea placeholder="Delivery days, contact preferences, etc." className="pl-10" {...field} /></FormControl>
                        </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="supplier-form" loading={isSaving}>
            {isEditMode ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
