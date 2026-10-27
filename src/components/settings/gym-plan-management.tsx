
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
import { Loader2, Trash2, Plus, Edit, Dumbbell, DollarSign } from 'lucide-react';
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
import type { GymMembershipPlan } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';

const planSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
  duration: z.coerce.number().int().min(1, 'Duration must be at least 1 day.'),
});

type PlanFormValues = z.infer<typeof planSchema>;

export function GymPlanManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<GymMembershipPlan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const plansQuery = React.useMemo(
    () => (firestore ? query(collection(firestore, 'gymMembershipPlans')) : null),
    [firestore]
  );
  const { data: plans, isLoading } = useCollection<GymMembershipPlan>(plansQuery);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { name: '', price: 0, duration: 30 },
  });

  const editForm = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
  });

  const onSubmit = async (data: PlanFormValues) => {
    if (!firestore) return;
    setIsSaving(true);
    const plansCollectionRef = collection(firestore, 'gymMembershipPlans');

    addDoc(plansCollectionRef, { ...data, createdAt: serverTimestamp() })
      .then(() => {
        toast({ variant: 'success', title: 'Plan Added' });
        form.reset({ name: '', price: 0, duration: 30 });
      })
      .catch((error) => {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleEditClick = (plan: GymMembershipPlan) => {
    setEditingPlan(plan);
    editForm.reset(plan);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (data: PlanFormValues) => {
    if (!firestore || !editingPlan) return;
    setIsEditing(true);

    const docRef = doc(firestore, 'gymMembershipPlans', editingPlan.id);

    updateDoc(docRef, data)
      .then(() => {
        toast({ variant: 'success', title: 'Plan Updated' });
        setIsEditDialogOpen(false);
        setEditingPlan(null);
      })
      .catch((error) => {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      })
      .finally(() => {
        setIsEditing(false);
      });
  };


  const handleDelete = async (plan: GymMembershipPlan) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'gymMembershipPlans', plan.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ variant: 'success', title: 'Plan Deleted' });
      })
      .catch((error) => {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      });
  };

  return (
    <div className="pl-10">
      <h4 className="font-medium text-foreground mb-4">Membership Plans</h4>
      <Form {...form}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. Monthly Pass" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Price</FormLabel>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                        <FormControl>
                        <Input type="number" placeholder="e.g. 50" {...field} className="pl-8" />
                        </FormControl>
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Duration (Days)</FormLabel>
                     <div className="flex items-end gap-2">
                        <FormControl>
                            <Input type="number" placeholder="e.g. 30" {...field} />
                        </FormControl>
                        <Button type="button" loading={isSaving} onClick={form.handleSubmit(onSubmit)} className="shrink-0">
                            <Plus /> Add Plan
                        </Button>
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </div>
      </Form>
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : plans && plans.length > 0 ? (
          plans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
              <div className="flex items-center gap-4">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-semibold">{plan.name}</span>
                  <div className="text-xs text-muted-foreground">
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(plan.price)}</span> / <span>{plan.duration} days</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(plan)}>
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
                        This will permanently delete the "{plan.name}" plan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(plan)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No membership plans added yet.</p>
        )}
      </div>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>
              Update the details for "{editingPlan?.name}".
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4 py-4" id="edit-plan-form">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Plan Name</FormLabel>
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
                 <FormField
                  control={editForm.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} disabled={isEditing}>Cancel</Button>
            <Button type="submit" form="edit-plan-form" loading={isEditing}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
