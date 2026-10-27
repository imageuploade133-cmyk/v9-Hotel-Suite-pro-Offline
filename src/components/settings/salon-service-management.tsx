'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  query,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Edit, Scissors, DollarSign } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { SalonServiceItem } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export function SalonServiceManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<SalonServiceItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const itemsQuery = React.useMemo(
    () => (firestore ? query(collection(firestore, 'salonServiceItems')) : null),
    [firestore]
  );
  const { data: items, isLoading } = useCollection<SalonServiceItem>(itemsQuery);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', price: 0 },
  });

  const editForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
  });

  const onSubmit = async (data: ItemFormValues) => {
    if (!firestore) return;
    setIsSaving(true);
    const itemsCollectionRef = collection(firestore, 'salonServiceItems');

    addDoc(itemsCollectionRef, { ...data, createdAt: serverTimestamp() })
      .then(() => {
        toast({ variant: 'success', title: 'Service Added' });
        form.reset({ name: '', price: 0 });
      })
      .catch((error) => {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleEditClick = (item: SalonServiceItem) => {
    setEditingItem(item);
    editForm.reset(item);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (data: ItemFormValues) => {
    if (!firestore || !editingItem) return;
    setIsEditing(true);

    const docRef = doc(firestore, 'salonServiceItems', editingItem.id);

    updateDoc(docRef, data)
      .then(() => {
        toast({ variant: 'success', title: 'Service Updated' });
        setIsEditDialogOpen(false);
        setEditingItem(null);
      })
      .catch((error) => {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      })
      .finally(() => {
        setIsEditing(false);
      });
  };


  const handleDelete = async (item: SalonServiceItem) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'salonServiceItems', item.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ variant: 'success', title: 'Service Deleted' });
      })
      .catch((error) => {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      });
  };

  return (
    <div className="pl-10">
      <Form {...form}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Service Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Haircut" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="flex items-end gap-2">
                    <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                        <FormLabel>Price</FormLabel>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 25" {...field} className="pl-8" />
                            </FormControl>
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="button" loading={isSaving} onClick={form.handleSubmit(onSubmit)}>
                        <Plus /> Add
                    </Button>
                </div>
            </div>
          </div>
      </Form>
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items && items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
              <div className="flex items-center gap-4">
                <Scissors className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-semibold">{item.name}</span>
                  <div className="text-xs text-muted-foreground">
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(item.price)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(item)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the "{item.name}" service.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No salon services added yet.</p>
        )}
      </div>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update the details for "{editingItem?.name}".
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4 py-4" id="edit-item-form">
              <div className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                        <FormControl>
                            <Input type="number" {...field} className="pl-8" />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} disabled={isEditing}>Cancel</Button>
            <Button type="submit" form="edit-item-form" loading={isEditing}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
