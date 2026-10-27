
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Loader2, Trash2, Plus, type LucideIcon, Edit, Info } from 'lucide-react';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { toPascalCase } from '../ui/dynamic-icon';

const tagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  iconName: z.string().optional(),
  isRequired: z.boolean().optional(),
  saveToCustomer: z.boolean().optional(),
  prefillFromCustomer: z.boolean().optional(),
  showInSidebar: z.boolean().optional(),
});

type TagFormValues = z.infer<typeof tagSchema>;

interface Tag {
  id: string;
  name: string;
  iconName?: string;
  isRequired?: boolean;
  saveToCustomer?: boolean;
  prefillFromCustomer?: boolean;
  showInSidebar?: boolean;
  [key: string]: any;
}

interface TagManagementProps {
  title: string;
  description: string;
  collectionName: 'roomTypes' | 'roomFacilities' | 'roomStatuses' | 'paymentMethods' | 'menuCategories' | 'bookingFormFields' | 'expenseCategories';
  icon: LucideIcon;
}

export function TagManagement({ title, description, collectionName, icon: Icon }: TagManagementProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingTag, setEditingTag] = React.useState<Tag | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const tagsQuery = React.useMemo(
    () => (firestore ? query(collection(firestore, collectionName)) : null),
    [firestore, collectionName]
  );
  const { data: tags, isLoading } = useCollection<Tag>(tagsQuery);

  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: '', iconName: '', isRequired: false, saveToCustomer: true, prefillFromCustomer: true, showInSidebar: true },
  });

  const onSubmit = async (data: TagFormValues) => {
    if (!firestore) return;
    setIsSaving(true);
    const tagsCollectionRef = collection(firestore, collectionName);

    const dataToSave: { [key: string]: any } = {
      name: data.name,
      iconName: toPascalCase(data.iconName || data.name),
      createdAt: serverTimestamp(),
    };

    if (collectionName === 'roomStatuses') {
        dataToSave.showInSidebar = data.showInSidebar;
    }

    if (collectionName === 'bookingFormFields') {
        dataToSave.isRequired = data.isRequired;
        dataToSave.saveToCustomer = data.saveToCustomer;
        dataToSave.prefillFromCustomer = data.prefillFromCustomer;
    }

    addDoc(tagsCollectionRef, dataToSave).then(async (docRef) => {
        toast({ variant: 'success', title: 'Item Added', description: `${data.name} has been added.` });
        form.reset({ name: '', iconName: '', isRequired: false, saveToCustomer: true, prefillFromCustomer: true, showInSidebar: true });

    }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: tagsCollectionRef.path,
            operation: 'create',
            requestResourceData: { name: data.name },
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsSaving(false);
    });
  };

  const handleEditClick = (tag: Tag) => {
    setEditingTag(tag);
    form.reset({
      name: tag.name,
      iconName: tag.iconName,
      isRequired: tag.isRequired || false,
      saveToCustomer: tag.saveToCustomer ?? true,
      prefillFromCustomer: tag.prefillFromCustomer ?? true,
      showInSidebar: tag.showInSidebar ?? true,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!firestore || !editingTag) return;
    setIsEditing(true);

    const values = form.getValues();
    const docRef = doc(firestore, collectionName, editingTag.id);

    const dataToUpdate: { [key: string]: any } = {
        name: values.name,
        iconName: toPascalCase(values.iconName || values.name),
    };

    if (collectionName === 'roomStatuses') {
      dataToUpdate.showInSidebar = values.showInSidebar;
    }
    if (collectionName === 'bookingFormFields') {
      dataToUpdate.isRequired = values.isRequired;
      dataToUpdate.saveToCustomer = values.saveToCustomer;
      dataToUpdate.prefillFromCustomer = values.prefillFromCustomer;
    }

    updateDoc(docRef, dataToUpdate)
    .then(() => {
        toast({ variant: 'success', title: 'Item Updated', description: `"${editingTag.name}" has been updated to "${values.name}".`});
        setIsEditDialogOpen(false);
        setEditingTag(null);
    })
    .catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { name: values.name },
      });
      errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsEditing(false);
    });
  };


  const handleDelete = async (tag: Tag) => {
    if (!firestore) return;
    const docRef = doc(firestore, collectionName, tag.id);
    deleteDoc(docRef)
    .then(() => {
        toast({ variant: 'success', title: 'Item Deleted' });
    })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleToggleSidebar = async (tag: Tag, show: boolean) => {
    if (!firestore) return;
    const docRef = doc(firestore, collectionName, tag.id);
    try {
        await updateDoc(docRef, { showInSidebar: show });
        toast({
            variant: 'success',
            title: `Visibility Updated`,
            description: `${tag.name} will ${show ? 'now be shown' : 'be hidden'} in the sidebar.`,
        });
    } catch(error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not update visibility setting.',
        });
    }
  }

  return (
    <div>
      <div className="flex items-start gap-4">
         <Icon className="h-6 w-6 text-muted-foreground mt-1" />
         <div className="flex-1">
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
         </div>
      </div>
      <div className="mt-4 pl-10">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input placeholder={`New ${title.slice(0, -1)} Name...`} {...field} disabled={isSaving} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {collectionName === 'roomStatuses' && (
                             <FormField
                                control={form.control}
                                name="iconName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input placeholder="Optional: Lucide Icon Name (e.g., Cat)" {...field} value={field.value || ''} disabled={isSaving} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>
                    <Button type="submit" loading={isSaving}>
                    <Plus />
                    Add
                    </Button>
                </div>
                {collectionName === 'bookingFormFields' && (
                    <div className="space-y-3 pt-2">
                        <FormField
                            control={form.control}
                            name="isRequired"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel>Make this field required</FormLabel>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="saveToCustomer"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel>Save data to customer profile</FormLabel>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="prefillFromCustomer"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel>Pre-fill with saved info</FormLabel>
                                </FormItem>
                            )}
                        />
                    </div>
                 )}
                 {collectionName === 'roomStatuses' && (
                    <div className="space-y-3 pt-2">
                        <FormField
                            control={form.control}
                            name="showInSidebar"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel>Show in Sidebar Menu</FormLabel>
                                </FormItem>
                            )}
                        />
                    </div>
                 )}
            </form>
        </Form>
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tags && tags.length > 0 ? (
            tags.map((tag) => {
              return (
                <div key={tag.id} className="flex items-center justify-between rounded-md border bg-muted/50 p-2 pl-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <DynamicIcon iconName={tag.iconName || tag.name} className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium">{tag.name}</span>
                        </div>
                        {collectionName === 'bookingFormFields' && (
                            <div className="flex items-center gap-4 pl-8 text-xs text-muted-foreground">
                                {tag.isRequired && <span className="font-semibold text-destructive">Required</span>}
                                {tag.saveToCustomer && <span>Saves to profile</span>}
                                {tag.prefillFromCustomer && <span>Pre-fills form</span>}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center">
                        {collectionName === 'roomStatuses' && (
                            <Switch
                                className="mr-2"
                                checked={tag.showInSidebar ?? true}
                                onCheckedChange={(checked) => handleToggleSidebar(tag, checked)}
                            />
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(tag)}>
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
                                        This will permanently delete the "{tag.name}" item. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(tag)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
              </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground">No items added yet.</p>
          )}
        </div>
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item</DialogTitle>
                    <DialogDescription>
                        Update the details for "{editingTag?.name}".
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4 py-4" id="edit-tag-form">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="New name" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         {collectionName === 'roomStatuses' && (
                             <FormField
                                control={form.control}
                                name="iconName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Icon Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Optional: Lucide Icon Name (e.g., Cat)" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                         {collectionName === 'bookingFormFields' && (
                            <div className="space-y-4 rounded-md border p-4">
                                <FormField
                                    control={form.control}
                                    name="isRequired"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel>Make this field required</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="saveToCustomer"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel>Save data to customer profile</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="prefillFromCustomer"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel>Pre-fill with saved info</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                        {collectionName === 'roomStatuses' && (
                            <div className="space-y-4 rounded-md border p-4">
                                <FormField
                                    control={form.control}
                                    name="showInSidebar"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel>Show in Sidebar Menu</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </form>
                </Form>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} disabled={isEditing}>Cancel</Button>
                    <Button type="submit" form="edit-tag-form" loading={isEditing}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
