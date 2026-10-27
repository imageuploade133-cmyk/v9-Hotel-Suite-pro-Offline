

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  query,
  getDocs,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';
import { getNewDocumentData } from '@/lib/branch-helpers';
import type { ServiceItem, Menu, StockCategory, MenuItem } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  X,
  DollarSign,
  Percent,
  Barcode,
  Wand2,
  Tag,
  PlusCircle,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '../ui/date-range-picker';
import { getSafeDate, uploadImage } from '@/lib/helpers';
import { setHours, setMinutes, endOfDay } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { Switch } from '../ui/switch';
import { AddCategoryDialog } from '../stock-keeper/add-category-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BottomSheet } from '../ui/bottom-sheet';

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required.'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
  category: z.string().min(1, 'Category is required.'),
  description: z.string().optional(),
  menuId: z.string().optional(),
  images: z.array(z.string()).optional(),
  imageFile: z.instanceof(File).optional(),
  trackQuantity: z.boolean().default(false),
  quantity: z.coerce.number().min(0, 'Quantity must be non-negative.').optional(),
  selectedBranchId: z.string().optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceFormFieldsProps {
    form: ReturnType<typeof useForm<ServiceFormValues>>;
    formId: string;
    handleFileSelect: (files: FileList | null) => void;
    handleRemoveImage: () => void;
    handleDragEvents: any;
    imagePreview: string | null;
    isDragging: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    maxFileSize: number;
    setIsAddCategoryOpen: (isOpen: boolean) => void;
    allCategories: string[];
    menus: Menu[] | null;
    isEditMode: boolean;
    branches: Array<{id: string; name: string;}>;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

function ServiceFormFields({
    form,
    formId,
    handleFileSelect,
    handleRemoveImage,
    handleDragEvents,
    imagePreview,
    isDragging,
    fileInputRef,
    maxFileSize,
    setIsAddCategoryOpen,
    allCategories,
    menus,
    isEditMode,
    branches
}: ServiceFormFieldsProps) {
    const trackQuantity = form.watch('trackQuantity');

     return (
        <Form {...form}>
            <form id={formId} className="space-y-4">
                {!isEditMode && branches.length > 0 && (
                  <FormField
                    control={form.control}
                    name="selectedBranchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign to Branch</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'global'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a branch or 'All Data' for global" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="global">All Data (Global Services)</SelectItem>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {field.value && field.value !== 'global' ? `This service will be added to ${branches.find(b => b.id === field.value)?.name} branch` : 'This service will be added to global services accessible to all branches'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Airport Transfer, Special Pizza" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} placeholder="e.g., 50.00" value={field.value || ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <Button variant="ghost" className="w-full justify-start" onClick={(e) => { e.preventDefault(); setIsAddCategoryOpen(true); }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create New
                                </Button>
                                <Separator className="my-1" />
                                {allCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                </div>
                {!isEditMode && (
                    <FormField
                        control={form.control}
                        name="menuId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Add to Menu (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a menu to also add this item to" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">Do not add to any menu</SelectItem>
                                        {menus?.map(menu => (
                                            <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>If selected, this item will be created in both "Services & Foods" and the chosen menu.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                 <Separator />
                <FormField
                    control={form.control}
                    name="trackQuantity"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">Track Quantity</FormLabel>
                            <FormDescription>
                                Enable to manage stock for this item. If disabled, it will have unlimited quantity.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                />

                {trackQuantity && (
                     <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Available Quantity</FormLabel>
                                <FormControl><Input type="number" {...field} placeholder="0" value={field.value || 0} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl><Textarea placeholder="A short description of the service or item." {...field} value={field.value || ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormItem>
                    <FormLabel>Image (Optional)</FormLabel>
                     {imagePreview ? (
                        <div className="relative group w-40 h-40">
                            <Image src={imagePreview} alt="Item preview" fill style={{ objectFit: 'cover' }} className="rounded-md border p-2" />
                            <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}><X className="h-5 w-5" /></Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                            {...handleDragEvents}
                            onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                        </div>
                    )}
                     <FormControl>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            </form>
        </Form>
    );
}

export function AddEditServiceItemDialog({
  isOpen,
  onClose,
  service,
  onSuccess,
  branches = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceItem | null;
  onSuccess: () => void;
  branches?: Array<{id: string; name: string;}>;
}) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const branchContext = useBranch();
  const { getCollectionPath } = branchContext;
  const isEditMode = !!service;
  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const formId = `add-edit-service-form-${service?.id || 'new'}`;

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: 0,
      category: 'General',
      description: '',
      menuId: 'none',
      images: [],
      trackQuantity: false,
      quantity: 0,
      selectedBranchId: branchContext.currentBranchId || '',
    },
  });

  const menusQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('menus')));
  }, [firestore, getCollectionPath]);
  const { data: menus, isLoading: areMenusLoading } = useCollection<Menu>(menusQuery);

  const [allCategories, setAllCategories] = React.useState<string[]>(['General']);

  const fetchCategories = React.useCallback(async () => {
    if (!menus || !firestore) return;

    const categoryPromises = menus.map(menu =>
      getDocs(collection(firestore, `menus/${menu.id}/categories`))
    );

    const categorySnapshots = await Promise.all(categoryPromises);

    const categorySet = new Set<string>(['General']);
    categorySnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        categorySet.add(doc.data().name);
      });
    });

    setAllCategories(Array.from(categorySet).sort());
  }, [menus, firestore]);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  React.useEffect(() => {
    if (isOpen) {
      if (isEditMode && service) {
        form.reset({
          name: service.name,
          price: service.price || 0,
          category: service.category,
          description: service.description || '',
          menuId: 'none',
          images: service.images || [],
          imageFile: undefined,
          trackQuantity: service.quantity !== Infinity,
          quantity: service.quantity === Infinity ? 0 : service.quantity,
        });
      } else {
        form.reset({
          name: '',
          price: 0,
          category: 'General',
          description: '',
          menuId: 'none',
          images: [],
          imageFile: undefined,
          trackQuantity: false,
          quantity: 0,
          selectedBranchId: branchContext.currentBranchId || '',
        });
      }
    }
  }, [isOpen, service, isEditMode, form, branchContext.currentBranchId]);

  const handleAddNewCategory = async (name: string): Promise<boolean> => {
    if (!firestore || !userProfile) return false;
    try {
        const selectedMenuId = form.getValues('menuId');
        if (!selectedMenuId || selectedMenuId === 'none') {
            toast({
                variant: 'destructive',
                title: 'No Menu Selected',
                description: 'Please select a menu first before adding a new category to it.',
            });
            return false;
        }

        await addDoc(collection(firestore, `menus/${selectedMenuId}/categories`), {
            name: name,
            createdAt: serverTimestamp(),
            createdBy: userProfile.name,
        });
        toast({ variant: 'success', title: 'Category Added', description: `${name} has been added to the selected menu.` });
        fetchCategories();
        form.setValue('category', name);
        return true;
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return false;
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
        const file = files[0];
        if (file.size > maxFileSize * 1024 * 1024) {
            toast({
                variant: 'destructive',
                title: 'File Too Large',
                description: `${file.name} is larger than the allowed ${maxFileSize}MB.`
            });
            return;
        }
        form.setValue('imageFile', file, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    form.setValue('imageFile', undefined, { shouldDirty: true });
    form.setValue('images', [], { shouldDirty: true });
    if(fileInputRef.current) {
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
      if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
    },
  };

  const imageFile = form.watch('imageFile');
  const imageUrl = form.watch('images')?.[0];
  const imagePreview = imageFile ? URL.createObjectURL(imageFile) : imageUrl;


  const handleFormSubmit = async (data: ServiceFormValues) => {
    if (!firestore || !userProfile) return;
    setIsSaving(true);
    try {
        let uploadedImageUrl = data.images?.[0] || '';
        if (data.imageFile) {
            toast({ title: 'Uploading Image...', description: 'Please wait.' });
            const imageName = `service-item-${data.name.replace(/\s+/g, '_')}-${Date.now()}`;
            uploadedImageUrl = await uploadImage(data.imageFile, imgbbApiKey, imageName, expirationSeconds);
        }

      const serviceData = {
        name: data.name,
        price: data.price,
        category: data.category,
        description: data.description || '',
        isService: true,
        images: uploadedImageUrl ? [uploadedImageUrl] : [],
        quantity: data.trackQuantity ? data.quantity : Infinity,
      };

      if (isEditMode && service) {
        // In global mode, services may belong to different branches. Use the service's actual branchId
        // to determine the correct collection path for updating.
        const actualCollectionPath = service.branchId
            ? `branches/${service.branchId}/services`
            : getCollectionPath('services');
        const serviceRef = doc(firestore, actualCollectionPath, service.id);
        await updateDoc(serviceRef, serviceData);
        toast({ variant: 'success', title: 'Service Updated' });
      } else {
        const baseServiceData = {
          ...serviceData,
          createdAt: serverTimestamp(),
        };

        // Use selected branch for the service, or fall back to current branch context
        const selectedBranchId = data.selectedBranchId;
        let serviceDataWithBranch = baseServiceData;

        if (selectedBranchId && selectedBranchId !== 'global') {
          // Create context object for the selected branch
          serviceDataWithBranch = getNewDocumentData(baseServiceData, {
            ...branchContext,
            currentBranchId: selectedBranchId,
          });
        } else if (selectedBranchId === 'global') {
          // Global service - no branch specified
          serviceDataWithBranch = baseServiceData;
        } else {
          // Use current branch context
          serviceDataWithBranch = getNewDocumentData(baseServiceData, branchContext);
        }

        const serviceDocRef = await addDoc(collection(firestore, getCollectionPath('services')), serviceDataWithBranch);

        if (data.menuId && data.menuId !== 'none') {
            const menuItemData = {
                ...serviceData,
                createdAt: serverTimestamp(),
                serviceId: serviceDocRef.id,
            };
            await addDoc(collection(firestore, `menus/${data.menuId}/items`), menuItemData);
             toast({ variant: 'success', title: 'Item Added', description: `${data.name} has been added to Services and the selected Menu.` });
        } else {
            toast({ variant: 'success', title: 'Service Added', description: `${data.name} has been added to Services.` });
        }
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Saving Item', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const dialogTitle = isEditMode ? 'Edit' : 'Add New';
  const dialogDescription = isEditMode ? `Update details for ${service?.name}` : 'Add a new non-inventory item.';

  const formContent = (
     <ServiceFormFields
        form={form}
        formId={formId}
        handleFileSelect={handleFileSelect}
        handleRemoveImage={handleRemoveImage}
        handleDragEvents={handleDragEvents}
        imagePreview={imagePreview}
        isDragging={isDragging}
        fileInputRef={fileInputRef}
        maxFileSize={maxFileSize}
        setIsAddCategoryOpen={setIsAddCategoryOpen}
        allCategories={allCategories}
        menus={menus || []}
        isEditMode={isEditMode}
        branches={branches || []}
    />
  );

  if (isMobile) {
    return (
        <BottomSheet open={isOpen} onOpenChange={onClose}>
             <div className="p-4 flex flex-col h-full">
                 <DialogHeader className="mb-4">
                    <DialogTitle>{dialogTitle} Service/Food</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mx-4">
                    <div className="px-4">
                        {formContent}
                    </div>
                </ScrollArea>
                <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" form={formId} loading={isSaving} onClick={form.handleSubmit(handleFormSubmit)}>
                        {isEditMode ? 'Save Changes' : 'Add Item'}
                    </Button>
                </div>
            </div>
        </BottomSheet>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle} Service/Food</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] -mx-6 px-6">
            <ScrollArea className="h-full pr-6">
              {formContent}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" form={formId} loading={isSaving} onClick={form.handleSubmit(handleFormSubmit)}>
              {isEditMode ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddCategoryDialog
        open={isAddCategoryOpen}
        onOpenChange={setIsAddCategoryOpen}
        onCategoryAdded={handleAddNewCategory}
      />
    </>
  );
}
