

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

const itemSchema = z
  .object({
    name: z.string().min(1, 'Item name is required.'),
    description: z.string().optional(),
    price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
    category: z.string().min(1, 'Category is required.'),
    images: z.array(z.string()).optional(),
    newImageFiles: z.array(z.instanceof(File)).optional(),
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

interface MenuItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  menuId: string;
  item: MenuItem | null;
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

export function MenuItemFormDialog({
  open,
  onOpenChange,
  onSuccess,
  menuId,
  item,
}: MenuItemFormDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const isEditMode = !!item;
  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false);

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

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
  });

  const categoriesQuery = React.useMemo(() => {
    if (!firestore || !menuId) return null;
    return query(collection(firestore, `menus/${menuId}/categories`));
  }, [firestore, menuId, isAddCategoryOpen]);
  const { data: categories } = useCollection(categoriesQuery);

  const existingImageUrls = form.watch('images') || [];
  const promoType = form.watch('promoType');

  React.useEffect(() => {
    if (open) {
      if (item) {
        form.reset({
          name: item.name || '',
          description: item.description || '',
          price: item.price || 0,
          category: item.category || '',
          images: item.images || [],
          promoPrice: item.promoPrice || undefined,
          promoType: item.promoType || 'fixed',
          promoDates:
            item.promoStartDate && item.promoEndDate
              ? {
                  from: getSafeDate(item.promoStartDate)!,
                  to: getSafeDate(item.promoEndDate)!,
                }
              : undefined,
          newImageFiles: [],
        });
      } else {
        form.reset({
          name: '', description: '', price: 0, category: '', images: [], newImageFiles: [],
          promoPrice: undefined, promoType: 'fixed', promoDates: undefined,
        });
      }
    }
  }, [open, item, form]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const newImageFiles = form.watch('newImageFiles') || [];


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

  const handleAddNewCategory = async (name: string): Promise<boolean> => {
    if (!firestore || !userProfile) return false;
    try {
        const selectedMenuId = menuId;

        await addDoc(collection(firestore, `menus/${selectedMenuId}/categories`), {
            name: name,
            createdAt: serverTimestamp(),
            createdBy: userProfile.name,
        });
        toast({ variant: 'success', title: 'Category Added', description: `${name} has been added to the menu.` });
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
        let uploadedImageUrls: string[] = data.images || [];
        if (data.newImageFiles && data.newImageFiles.length > 0) {
            toast({ title: 'Uploading Images...' });
            const uploadPromises = data.newImageFiles.map((file, index) => {
                const photoName = `menu-item-${data.name.replace(/\s+/g, '-')}-${Date.now()}-${index}`;
                return uploadImage(file, imgbbApiKey, photoName, expirationSeconds);
            });
            const urls = await Promise.all(uploadPromises);
            uploadedImageUrls = [...uploadedImageUrls, ...urls];
        }

        const itemData = {
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          images: uploadedImageUrls,
          promoPrice: data.promoPrice || null,
          promoType: data.promoPrice ? data.promoType : null,
          promoStartDate: data.promoDates?.from ? Timestamp.fromDate(data.promoDates.from) : null,
          promoEndDate: data.promoDates?.to ? Timestamp.fromDate(endOfPromotionDay(data.promoDates.to, checkoutTime)) : null,
        };

        if (isEditMode && item) {
            const docRef = doc(firestore, `menus/${menuId}/items`, item.id);
            await updateDoc(docRef, itemData);
            toast({ variant: 'success', title: 'Item Updated' });
        } else {
            await addDoc(collection(firestore, `menus/${menuId}/items`), {
                ...itemData,
                createdAt: serverTimestamp(),
            });
            toast({ variant: 'success', title: 'Item Added' });
        }

        onSuccess();
        onOpenChange(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Saving Item', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Menu Item</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mx-6 px-6">
             <Form {...form}>
              <form id="menu-item-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" step="0.01" {...field} className="pl-10" /></FormControl></div><FormMessage /></FormItem>)} />
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
                                    {(categories as any[])?.map((cat) => (
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
                </div>
                <FormItem>
                    <Separator />
                    <div className="pt-2">
                        <FormLabel>Item Images</FormLabel>
                    </div>
                     <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`} {...handleDragEvents} onClick={() => fileInputRef.current?.click()}><Upload className="w-8 h-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p><p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p></div>
                     <FormControl><Input ref={fileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" multiple onChange={(e) => handleFileSelect(e.target.files)} /></FormControl>
                    {(existingImageUrls.length > 0 || newImageFiles.length > 0) && (
                    <Carousel className="w-full"><CarouselContent>{existingImageUrls.map((url, index) => (<CarouselItem key={url} className="basis-1/2 md:basis-1/3"><Card className="overflow-hidden group relative aspect-square"><Image src={url} alt={`Existing Image ${index}`} fill className="object-cover"/><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end rounded-md p-2"><Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveExistingImage(index)}><X className="h-4 w-4" /></Button></div></Card></CarouselItem>))}{newImageFiles.map((file, index) => (<CarouselItem key={file.name + index} className="basis-1/2 md:basis-1/3"><Card className="overflow-hidden group relative aspect-square"><Image src={URL.createObjectURL(file)} alt={`Preview ${index}`} fill className="object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end rounded-md p-2"><Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveNewImage(index)}><X className="h-4 w-4" /></Button></div></Card></CarouselItem>))}</CarouselContent><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></Carousel>)}<FormMessage />
                </FormItem>
                <Separator />
                 <div className="space-y-2">
                    <h4 className="font-medium">Promotional Pricing (Optional)</h4>
                    <div className="p-3 border rounded-md space-y-4">
                        <FormField control={form.control} name="promoType" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Discount Type</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4"><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="fixed" /></FormControl><FormLabel className="font-normal">Fixed Price</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="percentage" /></FormControl><FormLabel className="font-normal">Percentage</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="promoPrice" render={({ field }) => (<FormItem><FormLabel>{promoType === 'percentage' ? 'Discount Percentage' : 'Promotional Price'}</FormLabel><div className="relative">{promoType === 'fixed' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}<FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} placeholder={promoType === 'percentage' ? 'e.g., 20' : 'e.g., 8.99'} className={cn(promoType === 'fixed' && "pl-10")}/></FormControl>{promoType === 'percentage' && <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}</div><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="promoDates" render={({ field }) => (<FormItem><FormLabel>Promo Dates</FormLabel><FormControl><DateRangePicker date={field.value} onDateChange={field.onChange}/></FormControl><FormDescription className="text-xs">Promotion ends at checkout time ({checkoutTime}) on the selected end date.</FormDescription><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                </div>
              </form>
            </Form>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" form="menu-item-form" loading={isSaving}>
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
