'use client';

import * as React from 'react';
import { Tags, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockCategory, StockItem } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import {
  collection,
  query,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  where,
  orderBy,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/branch-context';
import { getNewDocumentData } from '@/lib/branch-helpers';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/user-context';
import { DataTable } from '@/components/ui/data-table';
import { getStockCategoryColumns, renderSubComponent } from '@/components/stock/stock-category-columns';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required.'),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: StockCategory | null;
  onSuccess: () => void;
}

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryFormDialogProps) {
  const isEditMode = !!category;
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const branchContext = useBranch();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  });

  React.useEffect(() => {
    if (category) {
      form.reset(category);
    } else {
      form.reset({ name: '', description: '' });
    }
  }, [category, form]);

  const onSubmit = async (data: CategoryFormValues) => {
    if (!firestore || !userProfile) return;
    setIsSaving(true);

    // Check for duplicates
    const categoryQuery = query(collection(firestore, 'stockCategories'), where('name', '==', data.name));
    const querySnapshot = await getDocs(categoryQuery);
    if (!querySnapshot.empty && (!isEditMode || querySnapshot.docs[0].id !== category!.id)) {
        toast({
            variant: 'destructive',
            title: 'Duplicate Category',
            description: `A category with the name "${data.name}" already exists.`
        });
        setIsSaving(false);
        return;
    }

    try {
      if (isEditMode && category) {
        const docRef = doc(firestore, 'stockCategories', category.id);
        await updateDoc(docRef, { ...data, updatedBy: userProfile.name });
        toast({ variant: 'success', title: 'Category Updated' });
      } else {
        const baseCategoryData = {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: userProfile.name,
        };
        const categoryData = getNewDocumentData(baseCategoryData, branchContext);
        await addDoc(collection(firestore, 'stockCategories'), categoryData);
        toast({ variant: 'success', title: 'Category Added' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Stock Category</DialogTitle>
          <DialogDescription>{isEditMode ? 'Update the' : 'Create a new'} category for your stock items.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="category-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Beverages" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the category" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="category-form" loading={isSaving}>
            {isEditMode ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockCategoriesPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<StockCategory | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const firestore = useFirestore();
  const { toast } = useToast();

  const categoriesQuery = React.useMemo(() => {
    return firestore ? query(collection(firestore, 'stockCategories'), orderBy('name')) : null;
  }, [firestore, reloadCounter]);
  const { data: categories, isLoading: areCategoriesLoading } = useCollection<StockCategory>(categoriesQuery);

  const stockQuery = React.useMemo(() => {
    return firestore ? query(collection(firestore, 'stock')) : null;
  }, [firestore, reloadCounter]);
  const { data: stockItems, isLoading: areStockItemsLoading } = useCollection<StockItem>(stockQuery);

  const categoriesWithSubRows = React.useMemo(() => {
      if (!categories || !stockItems) return [];
      return categories.map(category => {
          const itemsInCategory = stockItems.filter(item => item.category === category.name);
          return {
              ...category,
              itemCount: itemsInCategory.length,
              subRows: itemsInCategory,
          };
      });
  }, [categories, stockItems]);


  const handleSuccess = () => setReloadCounter(prev => prev + 1);
  const handleEdit = (category: StockCategory) => {
    setSelectedCategory(category);
    setIsFormOpen(true);
  };

  const handleDelete = async (category: StockCategory) => {
      if ((category as any).itemCount > 0) {
        toast({
            variant: 'destructive',
            title: 'Cannot Delete Category',
            description: 'This category is still in use by one or more stock items.'
        });
        return;
      }
      setSelectedCategory(category);
      setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!firestore || !selectedCategory) return;
    try {
        await deleteDoc(doc(firestore, 'stockCategories', selectedCategory.id));
        toast({ variant: 'success', title: 'Category Deleted' });
        handleSuccess();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setIsDeleteOpen(false);
  }

  const columns = React.useMemo(() => getStockCategoryColumns({ onEdit: handleEdit, onDelete: handleDelete }), [handleDelete]);

  const isLoading = areCategoriesLoading || areStockItemsLoading;


  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <TopHeader name="Stock Categories" icon={<Tags />} description="Group your inventory items into categories for better organization." />
          <Button onClick={() => { setSelectedCategory(null); setIsFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
                title="Total Stock Items"
                value={stockItems?.length || 0}
                icon={Package}
                description="Total unique items in your inventory."
                isLoading={isLoading}
            />
             <StatCard
                title="Total Categories"
                value={categories?.length || 0}
                icon={Tags}
                description="Total number of item categories created."
                isLoading={isLoading}
            />
        </div>

         <Card>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={categoriesWithSubRows}
                        filterColumn="name"
                        filterPlaceholder="Filter categories..."
                        tableId="stock-categories"
                        getSubRows={(row: any) => row.subRows}
                        renderSubComponent={renderSubComponent}
                    />
                )}
            </CardContent>
         </Card>
      </div>

      <CategoryFormDialog
        open={isFormOpen}
        onOpenChange={(open) => { if (!open) setSelectedCategory(null); setIsFormOpen(open); }}
        onSuccess={handleSuccess}
        category={selectedCategory}
      />

      {selectedCategory && (
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the category "{selectedCategory.name}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export default withAuth(StockCategoriesPage, PagePermission.MANAGE_STOCK_CATEGORIES);
