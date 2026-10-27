

'use client';

import * as React from 'react';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical, Edit, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogFooter,
} from '@/components/ui/dialog';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Menu, MenuCategory, MenuItem } from '@/lib/types';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

interface SortableCategoryItemProps {
  category: MenuCategory;
  onDelete: (id: string) => void;
  onEdit: (category: MenuCategory) => void;
}

function SortableCategoryItem({ category, onDelete, onEdit }: SortableCategoryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-background rounded-md border shadow-sm">
       <div {...attributes} {...listeners} className="cursor-grab p-2">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className="flex-1 font-medium">{category.name}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(category)}>
        <Edit className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(category.id)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

interface MenuCategoriesClientPageProps {
  menu: Menu;
}

export default function MenuCategoriesClientPage({ menu }: MenuCategoriesClientPageProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [categoryToDelete, setCategoryToDelete] = React.useState<string | null>(null);
  const [editingCategory, setEditingCategory] = React.useState<MenuCategory | null>(null);

  const categoriesRef = React.useMemo(() =>
    firestore ? collection(firestore, 'menus', menu.id, 'categories') : null
  , [firestore, menu.id]);

  const { data: categories, isLoading: areCategoriesLoading } = useCollection<MenuCategory>(categoriesRef, { orderBy: 'order,asc' });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  React.useEffect(() => {
    if (editingCategory) {
      form.reset({ name: editingCategory.name });
    } else {
      form.reset({ name: '' });
    }
  }, [editingCategory, form]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8, // Require pointer to move 8px to start drag
        },
    })
  );

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await addDoc(categoriesRef, {
        name: newCategoryName,
        createdAt: serverTimestamp(),
        order: categories ? categories.length : 0,
      });
      setNewCategoryName('');
      toast({ title: 'Category added', description: `"${newCategoryName}" has been added.` });
    } catch (error) {
      console.error("Error adding category: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add the category.' });
    }
  };

  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
  };

  const handleUpdateCategory = async (values: CategoryFormValues) => {
    if (!firestore || !editingCategory) return;
    const oldName = editingCategory.name;
    const newName = values.name;

    if (oldName === newName) {
        setEditingCategory(null);
        return;
    }

    const batch = writeBatch(firestore);

    // 1. Update the category document itself
    const categoryRef = doc(firestore, `menus/${menu.id}/categories`, editingCategory.id);
    batch.update(categoryRef, { name: newName });

    // 2. Find all menu items with the old category and update them
    const itemsToUpdateQuery = query(
        collection(firestore, `menus/${menu.id}/items`),
        where('category', '==', oldName)
    );

    try {
        const itemsSnapshot = await getDocs(itemsToUpdateQuery);
        itemsSnapshot.forEach(itemDoc => {
            const itemRef = doc(firestore, `menus/${menu.id}/items`, itemDoc.id);
            batch.update(itemRef, { category: newName });
        });

        await batch.commit();

        toast({
            title: 'Category Updated',
            description: `"${oldName}" was renamed to "${newName}" and ${itemsSnapshot.size} item(s) were updated.`
        });

    } catch (error) {
        console.error("Error updating category and items:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update category and associated items.' });
    } finally {
        setEditingCategory(null);
    }
  };


  const handleDeleteCategory = (id: string) => {
    setCategoryToDelete(id);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteDoc(doc(categoriesRef, categoryToDelete));
      toast({ title: 'Category deleted', description: 'The category has been removed.' });
      setCategoryToDelete(null);
    } catch (error) {
      console.error("Error deleting category: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the category.' });
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id && categories) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      const newCategories = arrayMove(categories, oldIndex, newIndex);

      // Update order in Firestore
      try {
        const batch = writeBatch(firestore);
        newCategories.forEach((category, index) => {
          const docRef = doc(categoriesRef, category.id);
          batch.update(docRef, { order: index });
        });
        await batch.commit();
        toast({ title: 'Order updated', description: 'Category order has been saved.' });
      } catch (error) {
          console.error("Error updating category order:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to update category order.' })
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" asChild className="self-start -ml-4">
            <Link href={`/menu-editor/${menu.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Menu Editor
            </Link>
        </Button>
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold">{menu.name} - Categories</h1>
                <p className="text-muted-foreground">Manage the categories for your menu.</p>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Add New Category</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAddCategory} className="flex gap-2">
                    <Input
                        placeholder="e.g., Appetizers, Main Courses, Desserts"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <Button type="submit"><Plus className="mr-2 h-4 w-4"/> Add</Button>
                </form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Your Categories</CardTitle>
                <CardDescription>Drag and drop to reorder the categories.</CardDescription>
            </CardHeader>
            <CardContent>
                {areCategoriesLoading ? (
                  <div className="space-y-2">
                    <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ) : categories && categories.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {categories.map((cat) => (
                              <SortableCategoryItem key={cat.id} category={cat} onDelete={handleDeleteCategory} onEdit={handleEditCategory}/>
                          ))}
                        </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                    <p className="text-center text-muted-foreground py-8">No categories yet. Add one to get started.</p>
                )}
            </CardContent>
        </Card>

        <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. This will permanently delete the category.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Category Name</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form id="edit-category-form" onSubmit={form.handleSubmit(handleUpdateCategory)}>
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>
                    <Button type="submit" form="edit-category-form">Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
