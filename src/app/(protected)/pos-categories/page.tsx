'use client';

import * as React from 'react';
import { Plus, Package, ConciergeBell, Trash2, Layers, AlertTriangle, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockCategory, ServiceCategory, StockItem, ServiceItem } from '@/lib/types';
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getPOSCategoryColumns, renderSubComponent } from '@/components/pos/pos-category-columns';
import Image from 'next/image';
import { useSettings } from '@/contexts/settings-context';
import { uploadImage } from '@/lib/helpers';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useGlobalCollection } from '@/hooks/use-global-collection';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required.'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  imageFile: z.instanceof(File).optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: StockCategory | ServiceCategory | null;
  onSuccess: () => void;
  type: 'stock' | 'service';
}

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
  type,
}: CategoryFormDialogProps) {
  const isEditMode = !!category;
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const branchContext = useBranch();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '', imageUrl: '', imageFile: undefined },
  });

  React.useEffect(() => {
    if (open) {
      if (category) {
        form.reset({
          name: category.name,
          description: category.description || '',
          imageUrl: category.imageUrl || '',
          imageFile: undefined,
        });
      } else {
        form.reset({ name: '', description: '', imageUrl: '', imageFile: undefined });
      }
    }
  }, [category, form, open]);

  const imageFile = form.watch('imageFile');
  const imageUrl = form.watch('imageUrl');
  const imagePreview = imageFile ? URL.createObjectURL(imageFile) : imageUrl;

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: `${file.name} is larger than the allowed ${maxFileSize}MB.`,
        });
        return;
      }
      form.setValue('imageFile', file, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    form.setValue('imageFile', undefined, { shouldDirty: true });
    form.setValue('imageUrl', '', { shouldDirty: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
  };

  const { getCollectionPath } = useBranch();
  const collectionName = type === 'stock' ? getCollectionPath('stockCategories') : getCollectionPath('serviceCategories');

  const onSubmit = async (data: CategoryFormValues) => {
    if (!firestore || !userProfile) return;
    setIsSaving(true);

    const categoryQuery = query(collection(firestore, collectionName), where('name', '==', data.name));
    const querySnapshot = await getDocs(categoryQuery);
    if (!querySnapshot.empty && (!isEditMode || querySnapshot.docs[0].id !== category!.id)) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Category',
        description: `A category with the name "${data.name}" already exists.`,
      });
      setIsSaving(false);
      return;
    }

    try {
      let finalImageUrl = data.imageUrl || '';

      if (data.imageFile) {
        toast({ title: 'Uploading Image...', description: 'Please wait.' });
        const timestamp = Date.now();
        const safeName = data.name.replace(/\s+/g, '_');
        const imageName = `pos-category-${safeName}_${timestamp}`;
        finalImageUrl = await uploadImage(data.imageFile, imgbbApiKey, imageName);
      }

      const categoryData = {
        name: data.name,
        description: data.description || '',
        imageUrl: finalImageUrl,
      };

      if (isEditMode && category) {
        const docRef = doc(firestore, collectionName, category.id);
        await updateDoc(docRef, { ...categoryData, updatedBy: userProfile.name });
        toast({ variant: 'success', title: 'Category Updated' });
      } else {
        const baseCategoryData = {
          ...categoryData,
          createdAt: serverTimestamp(),
          createdBy: userProfile.name,
        };
        const finalCategoryData = getNewDocumentData(baseCategoryData, branchContext);
        await addDoc(collection(firestore, collectionName), finalCategoryData);
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
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} {type === 'stock' ? 'Stock' : 'Service'} Category</DialogTitle>
          <DialogDescription>{isEditMode ? 'Update the' : 'Create a new'} category for your {type === 'stock' ? 'stock items' : 'services'}.</DialogDescription>
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
                    <Input placeholder={type === 'stock' ? 'e.g., Beverages' : 'e.g., Spa Services'} {...field} />
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
            <FormItem>
              <FormLabel>Category Image (Optional)</FormLabel>
              {imagePreview ? (
                <div className="relative group w-full h-36 rounded-md overflow-hidden border">
                  <Image
                    src={imagePreview}
                    alt="Category image preview"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                  {...handleDragEvents}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
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
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </FormControl>
            </FormItem>
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

interface UnlinkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | ServiceItem | null;
  categoryName: string;
  onConfirm: () => void;
  isUnlinking: boolean;
}

function UnlinkConfirmDialog({
  open,
  onOpenChange,
  item,
  categoryName,
  onConfirm,
  isUnlinking,
}: UnlinkConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Unlink Item from Category
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to unlink <strong>"{item?.name}"</strong> from the category <strong>"{categoryName}"</strong>?
              </p>
              <p className="text-muted-foreground">
                The item will be moved to "General" category. This action can be undone by editing the item.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isUnlinking}
            className="bg-warning hover:bg-warning/90"
          >
            {isUnlinking ? 'Unlinking...' : 'Unlink Item'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: StockCategory | ServiceCategory | null;
  itemCount: number;
  confirmText: string;
  onConfirmTextChange: (text: string) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  category,
  itemCount,
  confirmText,
  onConfirmTextChange,
  onConfirm,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const canDelete = confirmText === 'DELETE';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Category
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to delete the category <strong>"{category?.name}"</strong>.
              </p>

              {itemCount > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold text-destructive">Warning: Category has {itemCount} linked item{itemCount !== 1 ? 's' : ''}</p>
                      <p className="text-sm text-muted-foreground">
                        Deleting this category will set all linked items to "General" category. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type <span className="font-bold text-destructive">DELETE</span> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => onConfirmTextChange(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="font-mono"
                  disabled={isDeleting}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!canDelete || isDeleting}
            className="bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Category'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function POSCategoriesPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isUnlinkOpen, setIsUnlinkOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<StockCategory | ServiceCategory | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | ServiceItem | null>(null);
  const [categoryType, setCategoryType] = React.useState<'stock' | 'service'>('stock');
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const [itemCountToDelete, setItemCountToDelete] = React.useState(0);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState('stock');
  const [isUnlinking, setIsUnlinking] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { getCollectionPath: getCollectionPathFn, isGlobalMode, isBranchMode, currentBranch } = useBranch();

  const stockCategoriesConstraints = React.useMemo(() => [orderBy('name')], []);
  const serviceCategoriesConstraints = React.useMemo(() => [orderBy('name')], []);

  // Branch mode queries
  const branchStockCategoriesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPathFn('stockCategories')), ...stockCategoriesConstraints) : null, [firestore, isGlobalMode, getCollectionPathFn, stockCategoriesConstraints]);
  const branchServiceCategoriesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPathFn('serviceCategories')), ...serviceCategoriesConstraints) : null, [firestore, isGlobalMode, getCollectionPathFn, serviceCategoriesConstraints]);
  const branchStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPathFn('stock'))) : null, [firestore, isGlobalMode, getCollectionPathFn]);
  const branchServicesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPathFn('services'))) : null, [firestore, isGlobalMode, getCollectionPathFn]);

  const branchStockCategoriesResult = useCollection<StockCategory>(branchStockCategoriesQuery);
  const branchServiceCategoriesResult = useCollection<ServiceCategory>(branchServiceCategoriesQuery);
  const branchStockResult = useCollection<StockItem>(branchStockQuery);
  const branchServicesResult = useCollection<ServiceItem>(branchServicesQuery);

  // Global mode queries
  const globalStockCategoriesResult = useGlobalCollectionData<StockCategory>('stockCategories', stockCategoriesConstraints);
  const globalServiceCategoriesResult = useGlobalCollectionData<ServiceCategory>('serviceCategories', serviceCategoriesConstraints);
  const globalStockResult = useGlobalCollectionData<StockItem>('stock', []);
  const globalServicesResult = useGlobalCollectionData<ServiceItem>('services', []);

  // Use appropriate result based on mode
  const { data: stockCategories, isLoading: areStockCategoriesLoading } = isGlobalMode ? globalStockCategoriesResult : branchStockCategoriesResult;
  const { data: serviceCategories, isLoading: areServiceCategoriesLoading } = isGlobalMode ? globalServiceCategoriesResult : branchServiceCategoriesResult;
  const { data: stockItems, isLoading: areStockItemsLoading } = isGlobalMode ? globalStockResult : branchStockResult;
  const { data: serviceItems, isLoading: areServiceItemsLoading } = isGlobalMode ? globalServicesResult : branchServicesResult;

  const stockCategoriesWithItems = React.useMemo(() => {
    if (!stockCategories || !stockItems) return [];
    return stockCategories.map(category => {
      const itemsInCategory = stockItems.filter(item => item.category === category.name);
      return {
        ...category,
        itemCount: itemsInCategory.length,
        subRows: itemsInCategory,
        categoryType: 'stock' as const,
      };
    });
  }, [stockCategories, stockItems]);

  const serviceCategoriesWithItems = React.useMemo(() => {
    if (!serviceCategories || !serviceItems) return [];
    return serviceCategories.map(category => {
      const itemsInCategory = serviceItems.filter(item => item.category === category.name);
      return {
        ...category,
        itemCount: itemsInCategory.length,
        subRows: itemsInCategory,
        categoryType: 'service' as const,
      };
    });
  }, [serviceCategories, serviceItems]);

  const handleSuccess = () => setReloadCounter(prev => prev + 1);

  const handleEdit = (category: StockCategory | ServiceCategory, type: 'stock' | 'service') => {
    setSelectedCategory(category);
    setCategoryType(type);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (category: StockCategory | ServiceCategory, type: 'stock' | 'service', itemCount: number) => {
    setSelectedCategory(category);
    setCategoryType(type);
    setItemCountToDelete(itemCount);
    setDeleteConfirmText('');
    setIsDeleteOpen(true);
  };

  const handleUnlinkClick = (item: StockItem | ServiceItem, type: 'stock' | 'service') => {
    setSelectedItem(item);
    setCategoryType(type);
    setIsUnlinkOpen(true);
  };

  const confirmUnlink = async () => {
    if (!firestore || !selectedItem || !userProfile) return;

    setIsUnlinking(true);
    const collectionName = categoryType === 'stock' ? getCollectionPathFn('stock') : getCollectionPathFn('services');

    try {
      const docRef = doc(firestore, collectionName, selectedItem.id);
      await updateDoc(docRef, {
        category: 'General',
        updatedBy: userProfile.name,
        updatedAt: serverTimestamp(),
      });

      toast({
        variant: 'success',
        title: 'Item Unlinked',
        description: `"${selectedItem.name}" has been moved to General category.`,
      });
      handleSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsUnlinking(false);
      setIsUnlinkOpen(false);
      setSelectedItem(null);
    }
  };

  const confirmDelete = async () => {
    if (!firestore || !selectedCategory) return;

    setIsDeleting(true);
    const categoryCollectionName = categoryType === 'stock' ? getCollectionPathFn('stockCategories') : getCollectionPathFn('serviceCategories');
    const itemCollectionName = categoryType === 'stock' ? getCollectionPathFn('stock') : getCollectionPathFn('services');
    const items = categoryType === 'stock' ? stockItems : serviceItems;

    try {
      if (itemCountToDelete > 0 && items) {
        const itemsToUpdate = items.filter(item => item.category === selectedCategory.name);

        const updatePromises = itemsToUpdate.map(item => {
          const docRef = doc(firestore, itemCollectionName, item.id);
          return updateDoc(docRef, {
            category: 'General',
            updatedBy: userProfile?.name || 'System',
            updatedAt: serverTimestamp(),
          });
        });

        await Promise.all(updatePromises);
      }

      await deleteDoc(doc(firestore, categoryCollectionName, selectedCategory.id));

      toast({
        variant: 'success',
        title: 'Category Deleted',
        description: itemCountToDelete > 0
          ? `Category deleted. ${itemCountToDelete} item${itemCountToDelete !== 1 ? 's' : ''} moved to General category.`
          : 'Category deleted successfully.',
      });
      handleSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
      setSelectedCategory(null);
      setDeleteConfirmText('');
    }
  };

  const handleAddCategory = (type: 'stock' | 'service') => {
    setSelectedCategory(null);
    setCategoryType(type);
    setIsFormOpen(true);
  };

  const isLoading = areStockCategoriesLoading || areServiceCategoriesLoading || areStockItemsLoading || areServiceItemsLoading;

  const stockColumns = React.useMemo(() =>
    getPOSCategoryColumns({
      onEdit: (cat, type) => handleEdit(cat, type),
      onDelete: (cat, type, count) => handleDeleteClick(cat, type, count),
    }),
    []
  );

  const serviceColumns = React.useMemo(() =>
    getPOSCategoryColumns({
      onEdit: (cat, type) => handleEdit(cat, type),
      onDelete: (cat, type, count) => handleDeleteClick(cat, type, count),
    }),
    []
  );

  const renderStockSubComponent = React.useCallback(
    ({ row }: { row: any }) => renderSubComponent({
      row,
      onUnlink: (item, type) => handleUnlinkClick(item, type),
      categoryType: 'stock',
    }),
    []
  );

  const renderServiceSubComponent = React.useCallback(
    ({ row }: { row: any }) => renderSubComponent({
      row,
      onUnlink: (item, type) => handleUnlinkClick(item, type),
      categoryType: 'service',
    }),
    []
  );

  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <TopHeader
            name="POS Categories"
            icon={<Layers />}
            description={isBranchMode ? `Branch: ${currentBranch?.name}` : "Manage categories for your products and services in Point of Sale."}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Stock Categories"
            value={stockCategories?.length || 0}
            icon={Package}
            description="Categories for inventory items."
            isLoading={isLoading}
          />
          <StatCard
            title="Service Categories"
            value={serviceCategories?.length || 0}
            icon={ConciergeBell}
            description="Categories for services offered."
            isLoading={isLoading}
          />
          <StatCard
            title="Total Stock Items"
            value={stockItems?.length || 0}
            icon={Package}
            description="Products in inventory."
            isLoading={isLoading}
          />
          <StatCard
            title="Total Services"
            value={serviceItems?.length || 0}
            icon={ConciergeBell}
            description="Services available."
            isLoading={isLoading}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-card p-1 rounded-lg border shadow-sm">
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock Categories
            </TabsTrigger>
            <TabsTrigger value="service" className="flex items-center gap-2">
              <ConciergeBell className="h-4 w-4" />
              Service Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Stock Categories</CardTitle>
                  <CardDescription>
                    Click on a category to expand and view linked items. You can unlink items or delete categories.
                  </CardDescription>
                </div>
                <Button onClick={() => handleAddCategory('stock')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {areStockCategoriesLoading || areStockItemsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <DataTable
                    columns={stockColumns}
                    data={stockCategoriesWithItems}
                    filterColumn="name"
                    filterPlaceholder="Search stock categories..."
                    tableId="stock-categories"
                    renderSubComponent={renderStockSubComponent}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Service Categories</CardTitle>
                  <CardDescription>
                    Click on a category to expand and view linked items. You can unlink items or delete categories.
                  </CardDescription>
                </div>
                <Button onClick={() => handleAddCategory('service')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {areServiceCategoriesLoading || areServiceItemsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <DataTable
                    columns={serviceColumns}
                    data={serviceCategoriesWithItems}
                    filterColumn="name"
                    filterPlaceholder="Search service categories..."
                    tableId="service-categories"
                    renderSubComponent={renderServiceSubComponent}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CategoryFormDialog
        open={isFormOpen}
        onOpenChange={(open) => { if (!open) setSelectedCategory(null); setIsFormOpen(open); }}
        onSuccess={handleSuccess}
        category={selectedCategory}
        type={categoryType}
      />

      <UnlinkConfirmDialog
        open={isUnlinkOpen}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); setIsUnlinkOpen(open); }}
        item={selectedItem}
        categoryName={selectedItem?.category || ''}
        onConfirm={confirmUnlink}
        isUnlinking={isUnlinking}
      />

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCategory(null);
            setDeleteConfirmText('');
          }
          setIsDeleteOpen(open);
        }}
        category={selectedCategory}
        itemCount={itemCountToDelete}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}

export default withAuth(POSCategoriesPage, PagePermission.MANAGE_POS_CATEGORIES);
