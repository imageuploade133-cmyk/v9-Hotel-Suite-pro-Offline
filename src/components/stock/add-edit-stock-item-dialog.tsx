
'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import type { StockItem, StockCategory, StockSupplier } from '@/lib/types';
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
import { setHours, setMinutes, endOfDay, format } from 'date-fns';
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

const itemSchema = z
  .object({
    name: z.string().min(1, 'Item name is required.'),
    description: z.string().optional(),
    barcode: z.string().optional(),
    quantity: z.coerce.number().min(0, 'Quantity must be a non-negative number.'),
    category: z.string().min(1, 'Category is required.'),
    costPrice: z.coerce.number().min(0, 'Cost price must be non-negative.'),
    sellingPrice: z.coerce.number().min(0, 'Selling price must be non-negative.'),
    supplier: z.string().optional(),
    lowStockThreshold: z.coerce
      .number()
      .min(0, 'Threshold must be non-negative.')
      .optional(),
    expiryDate: z.string().optional(),
    hideFromPOS: z.boolean().default(false),
    images: z.array(z.string()).optional(),
    newImageFiles: z.array(z.instanceof(File)).optional(),
    selectedBranchId: z.string().optional(),
    promoPrice: z.preprocess(
      (val) => (val === "" || val === null || val === undefined || isNaN(Number(val)) || Number(val) === 0 ? undefined : Number(val)),
      z
        .number({ invalid_type_error: 'Promo price must be a number' })
        .positive('Promo price must be positive.')
        .nullable()
        .optional()
    ),
    promoType: z.enum(['fixed', 'percentage']).optional(),
    promoDates: z.any().optional(),
  })
  .refine(
    (data) => {
      if (data.promoPrice) {
        return !!data.promoDates?.from;
      }
      return true;
    },
    {
      message: 'Promotional dates are required when a promotional price is set.',
      path: ['promoDates'],
    }
  );

type ItemFormValues = z.infer<typeof itemSchema>;

interface AddEditStockItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockItem | null;
  onSuccess: () => void;
  stockCollection?: string;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const endOfPromotionDay = (date: Date, checkoutTime: string): Date => {
  try {
    const [hours, minutes] = checkoutTime.split(':').map(Number);
    return setMinutes(setHours(date, hours), minutes);
  } catch {
    return endOfDay(date); // Fallback to end of day if time is invalid
  }
};

export function AddEditStockItemDialog({
  isOpen,
  onClose,
  item,
  onSuccess,
  stockCollection = 'stock',
}: AddEditStockItemDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const branchContext = useBranch();
  const { branches, currentBranchId, isBranchMode, getCollectionPath } = branchContext;
  const isEditMode = !!item;
  const allowManualStockEdit = settings?.allowManualStockEdit ?? true;

  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
  });

  const categoriesQuery = React.useMemo(
    () =>
      firestore ? query(collection(firestore, getCollectionPath('stockCategories'))) : null,
    [firestore, isAddCategoryOpen, getCollectionPath]
  );
  const { data: categories } = useCollection<StockCategory>(categoriesQuery);

  const suppliersQuery = React.useMemo(
    () =>
      firestore ? query(collection(firestore, getCollectionPath('suppliers'))) : null,
    [firestore, getCollectionPath]
  );
  const { data: suppliers } = useCollection<StockSupplier>(suppliersQuery);

  const {
    expirationSeconds,
    imgbbApiKey,
    maxFileSize,
    checkoutTime,
  } = React.useMemo(() => ({
    expirationSeconds: settings?.expirationSeconds ?? 0,
    imgbbApiKey: settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY,
    maxFileSize: settings?.maxFileSizeMb ?? 5,
    checkoutTime: settings?.checkoutTime || '11:00',
  }), [settings]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const newImageFiles = form.watch('newImageFiles') || [];
  const existingImageUrls = form.watch('images') || [];
  const promoType = form.watch('promoType');

  React.useEffect(() => {
    if (isOpen) {
      if (item) {
        const expiryDate = getSafeDate(item.expiryDate);
        form.reset({
          name: item.name,
          description: item.description || '',
          barcode: item.barcode || '',
          quantity: item.quantity,
          category: item.category,
          costPrice: item.costPrice || 0,
          sellingPrice: item.sellingPrice || 0,
          supplier: item.supplierId || '',
          lowStockThreshold: item.lowStockThreshold || 10,
          expiryDate: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : '',
          hideFromPOS: item.hideFromPOS || false,
          promoPrice: item.promoPrice || undefined,
          promoType: item.promoType || 'fixed',
          promoDates:
            item.promoStartDate && item.promoEndDate
              ? {
                  from: getSafeDate(item.promoStartDate)!,
                  to: getSafeDate(item.promoEndDate)!,
                }
              : undefined,
          images: item.images || [],
          newImageFiles: [],
        });
      } else {
        form.reset({
          name: '', description: '', barcode: '', quantity: 0, category: '',
          costPrice: 0, sellingPrice: 0, supplier: '', lowStockThreshold: 10, expiryDate: undefined,
          hideFromPOS: false, promoPrice: undefined, promoType: 'fixed', promoDates: undefined,
          selectedBranchId: currentBranchId || '', images: [], newImageFiles: [],
        });
      }
    }
  }, [isOpen, item, form]);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (selectedFiles) {
        const newFiles = Array.from(selectedFiles).filter((file) => {
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'File Too Large',
                    description: `${file.name} is larger than the allowed ${maxFileSize}MB.`
                });
                return false;
            }
            return true;
        });
        const currentFiles = form.getValues('newImageFiles') || [];
        form.setValue('newImageFiles', [...currentFiles, ...newFiles], { shouldValidate: true });
    }
  };

  const handleRemoveNewImage = (index: number) => {
    const currentFiles = form.getValues('newImageFiles') || [];
    form.setValue('newImageFiles', currentFiles.filter((_, i) => i !== index), { shouldValidate: true });
  };

  const handleRemoveExistingImage = (index: number) => {
    const currentImages = form.getValues('images') || [];
    form.setValue('images', currentImages.filter((_, i) => i !== index), { shouldDirty: true });
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

  const generateEan13 = () => {
    let base = '';
    for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += i % 2 === 0 ? parseInt(base[i], 10) : parseInt(base[i], 10) * 3;
    const checksum = (10 - (sum % 10)) % 10;
    form.setValue('barcode', base + checksum.toString(), { shouldDirty: true });
  };

   const handleAddNewCategory = async (name: string): Promise<boolean> => {
    if (!firestore || !userProfile) return false;
    try {
        await addDoc(collection(firestore, getCollectionPath('stockCategories')), {
            name: name,
            createdAt: serverTimestamp(),
            createdBy: userProfile.name,
        });
        toast({ variant: 'success', title: 'Category Added', description: `${name} has been added.` });
        form.setValue('category', name);
        return true;
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return false;
    }
  };


  const onSubmit = async (data: ItemFormValues) => {
    if (!firestore || !userProfile) return;
    setIsSaving(true);

    try {
        const q = query(
            collection(firestore, stockCollection),
            where('name', '==', data.name)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty && (!isEditMode || querySnapshot.docs[0].id !== item!.id)) {
            throw new Error('An item with this name already exists in this inventory.');
        }
        if (data.barcode) {
          const barcodeQuery = query(collection(firestore, stockCollection), where('barcode', '==', data.barcode));
          const barcodeSnapshot = await getDocs(barcodeQuery);
          if (!barcodeSnapshot.empty && (!isEditMode || barcodeSnapshot.docs[0].id !== item!.id)) {
            throw new Error('An item with this barcode already exists.');
          }
        }

        let uploadedImageUrls: string[] = data.images || [];
        if (data.newImageFiles && data.newImageFiles.length > 0) {
            toast({ title: 'Uploading Images...', description: `Uploading ${data.newImageFiles.length} new image(s). Please wait.`});
            const uploadPromises = data.newImageFiles.map(file => {
                const timestamp = Date.now();
                const safeName = data.name.replace(/\s+/g, '_');
                const newName = `stock-${safeName}_${timestamp}`;
                return uploadImage(file, imgbbApiKey, newName, expirationSeconds);
            });
            const urls = await Promise.all(uploadPromises);
            uploadedImageUrls = [...uploadedImageUrls, ...urls];
        }

        const itemData: any = {
          ...data,
          images: uploadedImageUrls,
          expiryDate: data.expiryDate ? Timestamp.fromDate(new Date(data.expiryDate)) : null,
          promoPrice: data.promoPrice || null,
          promoType: data.promoPrice ? data.promoType : null,
          promoStartDate: data.promoDates?.from ? Timestamp.fromDate(data.promoDates.from) : null,
          promoEndDate: data.promoDates?.to ? Timestamp.fromDate(endOfPromotionDay(data.promoDates.to, checkoutTime)) : null,
        };
        delete itemData.newImageFiles;
        delete itemData.promoDates;
        delete itemData.selectedBranchId;


        if (isEditMode && item) {
            // In global mode, items may belong to different branches. Use the item's actual branchId
            // to determine the correct collection path for updating.
            const actualCollectionPath = item.branchId
                ? `branches/${item.branchId}/stock`
                : stockCollection;
            const itemRef = doc(firestore, actualCollectionPath, item.id);
            await updateDoc(itemRef, itemData);
            toast({ variant: 'success', title: 'Item Updated', description: `${data.name} has been updated.` });
        } else {
            const batch = writeBatch(firestore);
            const newItemRef = doc(collection(firestore, stockCollection));
            const baseItemData = {
              ...itemData,
              held: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            const newItemData = getNewDocumentData(baseItemData, branchContext);
            batch.set(newItemRef, newItemData);

            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            batch.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: userProfile.uid,
                userName: userProfile.name,
                changeType: 'Create',
                entityType: 'Stock Item',
                entityId: newItemRef.id,
                details: `Created new stock item: ${data.name}`,
                changes: [{ field: 'item', before: null, after: 'Created' }],
                notes: `Initial stock: ${data.quantity}`,
                keywords: ['create', 'stock', data.name.toLowerCase(), data.category.toLowerCase()]
            });
            await batch.commit();
            toast({ variant: 'success', title: 'Item Added to Stock', description: `${data.name} has been added.` });
        }

        onSuccess();
        onClose();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Saving Item', description: error.message || 'An unexpected error occurred.' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="min-h-0 overflow-hidden sm:max-h-[min(90dvh,52rem)] sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Stock Item</DialogTitle>
            <DialogDescription>
              {isEditMode ? `Update the details for ${item?.name}.` : 'Add a new item to your main inventory.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 max-h-none flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
            <Form {...form}>
              <form id="stock-item-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                              <SelectValue placeholder="Select a branch or 'All Data' for global inventory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="global">All Data (Global Inventory)</SelectItem>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {field.value && field.value !== 'global' ? `This item will be added to ${branches.find(b => b.id === field.value)?.name} branch` : 'This item will be added to global inventory accessible to all branches'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                 <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Item Name</FormLabel><FormControl><Input placeholder="e.g., Coca-Cola Can" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., 330ml can of classic Coca-Cola" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    {categories?.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.name}>
                                        {cat.name}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="supplier" render={({ field }) => (
                        <FormItem><FormLabel>Supplier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="None">None</SelectItem>{(suppliers as any[])?.map((sup) => (<SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>))}</SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="costPrice" render={({ field }) => (<FormItem><FormLabel>Cost Price ({settings?.currency})</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00" className="pl-8" /></FormControl></div><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="sellingPrice" render={({ field }) => (<FormItem><FormLabel>Selling Price ({settings?.currency})</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00" className="pl-8" /></FormControl></div><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} placeholder="0" disabled={isEditMode && !allowManualStockEdit} /></FormControl>{isEditMode && !allowManualStockEdit && <FormDescription className="text-xs">Quantity is managed via transfers and sales.</FormDescription>}<FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (<FormItem><FormLabel>Low Stock Threshold</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 10" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="barcode" render={({ field }) => (<FormItem><FormLabel>Barcode (Optional)</FormLabel><div className="flex items-center gap-2"><div className="relative flex-1"><Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input placeholder="Scan or enter barcode" className="pl-10" {...field} value={field.value || ''} /></FormControl></div><Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={generateEan13}><Wand2 className="h-4 w-4"/></Button></div><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="expiryDate" render={({ field }) => (<FormItem><FormLabel>Expiry Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="space-y-4 rounded-md border p-4">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2"><Percent className="h-5 w-5"/> Promotional Pricing (Optional)</h4>
                    <FormField control={form.control} name="promoType" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Discount Type</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4"><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="fixed" /></FormControl><FormLabel className="font-normal">Fixed Price</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="percentage" /></FormControl><FormLabel className="font-normal">Percentage</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="promoPrice" render={({ field }) => (<FormItem><FormLabel>{promoType === 'percentage' ? 'Discount Percentage' : 'Promotional Price'}</FormLabel><div className="relative">{promoType === 'fixed' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}<FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} placeholder={promoType === 'percentage' ? 'e.g., 20' : 'e.g., 120'} className={cn(promoType === 'fixed' && "pl-10")}/></FormControl>{promoType === 'percentage' && <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}</div><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="promoDates" render={({ field }) => (<FormItem><FormLabel>Promo Dates</FormLabel><FormControl><DateRangePicker date={field.value} onDateChange={field.onChange} /></FormControl><FormDescription className="text-xs">Promotion ends at checkout time ({checkoutTime}) on the selected end date.</FormDescription><FormMessage /></FormItem>)} />
                    </div>
                </div>
                 <FormField control={form.control} name="hideFromPOS" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Hide from Point of Sale</FormLabel><FormDescription>If checked, this item will not appear in the POS grid.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                 <FormItem>
                    <Separator />
                    <div className="pt-2"><FormLabel>Item Images</FormLabel></div>
                     <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`} {...handleDragEvents} onClick={() => fileInputRef.current?.click()}><Upload className="w-8 h-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p><p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p></div>
                     <FormControl><Input ref={fileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" multiple onChange={(e) => handleFileSelect(e.target.files)} /></FormControl>
                    {(existingImageUrls.length > 0 || newImageFiles.length > 0) && (
                    <Carousel className="w-full"><CarouselContent>{existingImageUrls.map((url, index) => (<CarouselItem key={url} className="basis-1/2 md:basis-1/3"><Card className="overflow-hidden group relative aspect-square"><Image src={url} alt={`Existing Image ${index}`} fill className="object-cover"/><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end rounded-md p-2"><Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveExistingImage(index)}><X className="h-4 w-4" /></Button></div></Card></CarouselItem>))}{newImageFiles.map((file, index) => (<CarouselItem key={file.name + index} className="basis-1/2 md:basis-1/3"><Card className="overflow-hidden group relative aspect-square"><Image src={URL.createObjectURL(file)} alt={`Preview ${index}`} fill className="object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end rounded-md p-2"><Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveNewImage(index)}><X className="h-4 w-4" /></Button></div></Card></CarouselItem>))}</CarouselContent><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></Carousel>)}<FormMessage />
                </FormItem>
              </form>
            </Form>
          </ScrollArea>
          <DialogFooter className="shrink-0">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="stock-item-form"
              loading={isSaving}
            >
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
