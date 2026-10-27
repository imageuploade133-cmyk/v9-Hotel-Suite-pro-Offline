'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Trash2,
  PlusCircle,
  PackagePlus,
  ArrowLeft,
  DollarSign,
  Barcode,
  Tag,
  Truck,
  FileText,
  Upload,
  X,
  Package,
  Wand2,
  Percent,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import type { StockItem, StockCategory, StockSupplier } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, writeBatch, doc, Timestamp, getDocs, where } from 'firebase/firestore';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import Link from 'next/link';
import Image from 'next/image';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getSafeDate } from '@/lib/helpers';
import { Label } from '@/components/ui/label';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
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


const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required.'),
  barcode: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  category: z.string().min(1, 'Category is required.'),
  costPrice: z.coerce.number().min(0, 'Cost price must be non-negative.'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be non-negative.'),
  supplier: z.string().optional(),
  lowStockThreshold: z.coerce.number().min(0, 'Threshold must be non-negative.').optional(),
  imageFile: z.instanceof(File).optional(),
  expiryDate: z.string().optional(),
  promoPrice: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || isNaN(Number(val)) || Number(val) === 0 ? undefined : Number(val)),
    z.number({ invalid_type_error: "Promo price must be a number" }).positive("Promo price must be positive.").nullable().optional()
  ),
  promoType: z.enum(['fixed', 'percentage']).optional(),
  promoDates: z.any().optional(),
}).refine(data => {
    if (data.promoPrice) {
        return !!data.promoDates?.from;
    }
    return true;
}, {
    message: "Promotional dates are required when a promotional price is set.",
    path: ["promoDates"],
});

const bulkAddSchema = z.object({
  items: z.array(itemSchema).min(1, 'At least one item is required.'),
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

type BulkAddFormValues = z.infer<typeof bulkAddSchema>;

const newCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters."),
});

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadImage(file: File, apiKey: string, name: string, expiration?: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const base64Image = event.target.result.split(',')[1];
                const formData = new FormData();
                formData.append('image', base64Image);
                formData.append('name', name);

                let uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;
                if (expiration && expiration > 0) {
                    uploadUrl += `&expiration=${expiration}`;
                }

                try {
                    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
                    const result = await response.json();
                    if (result.success) {
                        resolve(result.data.url);
                    } else {
                        reject(new Error(result.error?.message || 'Image upload failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            } else {
                 reject(new Error('Failed to read file.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

function BulkAddPage() {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;

  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false);
  const [activeItemIndex, setActiveItemIndex] = React.useState<number | null>(null);
  const [showNoSupplierConfirm, setShowNoSupplierConfirm] = React.useState(false);
  const [dataToSubmit, setDataToSubmit] = React.useState<BulkAddFormValues | null>(null);


  const form = useForm<BulkAddFormValues>({
    resolver: zodResolver(bulkAddSchema),
    defaultValues: {
      items: [{ name: '', quantity: 1, category: '', costPrice: 0, sellingPrice: 0, lowStockThreshold: 10, promoType: 'fixed' }],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const categoriesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'stockCategories')) : null, [firestore, isAddCategoryOpen]);
  const { data: categories, isLoading: areCategoriesLoading } = useCollection<StockCategory>(categoriesQuery);

  const suppliersQuery = React.useMemo(() => firestore ? query(collection(firestore, 'stockSuppliers')) : null, [firestore]);
  const { data: suppliers } = useCollection<StockSupplier>(suppliersQuery);
  const [supplierSearch, setSupplierSearch] = React.useState('');

  const watchItems = form.watch('items');
  const totalItems = watchItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalCost = watchItems.reduce((sum, item) => sum + (item.costPrice || 0) * (Number(item.quantity) || 0), 0);
  const totalSellingValue = watchItems.reduce((sum, item) => sum + (item.sellingPrice || 0) * (Number(item.quantity) || 0), 0);

  const processSubmit = async (data: BulkAddFormValues) => {
    if (!firestore || !userProfile) return;
    setIsSaving(true);

    try {
      const existingItemsSnapshot = await getDocs(collection(firestore, 'stockKeeperItems'));
      const existingItems = existingItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as StockItem);

      const names = new Set<string>();
      const barcodes = new Set<string>();

      for (const item of data.items) {
        const lowerCaseName = item.name.toLowerCase();
        if (names.has(lowerCaseName)) {
          throw new Error(`Duplicate item name in form: "${item.name}". Please ensure all item names are unique.`);
        }
        names.add(lowerCaseName);

        if(item.barcode) {
          if (barcodes.has(item.barcode)) {
            throw new Error(`Duplicate barcode in form: "${item.barcode}".`);
          }
          barcodes.add(item.barcode);
        }

        if (existingItems.some(existing => existing.name.toLowerCase() === lowerCaseName)) {
          throw new Error(`An item with the name "${item.name}" already exists in staging.`);
        }
        if (item.barcode && existingItems.some(existing => existing.barcode === item.barcode)) {
          throw new Error(`An item with the barcode "${item.barcode}" already exists.`);
        }
      }

      const batch = writeBatch(firestore);
      const itemsWithFiles = data.items.map((item, index) => ({ ...item, index })).filter(item => item.imageFile);

      const uploadedUrls = new Map<number, string>();

      if (itemsWithFiles.length > 0) {
        toast({ title: 'Uploading Images...', description: `Uploading ${itemsWithFiles.length} image(s). Please wait.` });
        await Promise.all(itemsWithFiles.map(async ({ imageFile, name, index }) => {
            const imageName = `staged-item-${name.replace(/\s+/g, '_')}-${Date.now()}`;
            const url = await uploadImage(imageFile!, imgbbApiKey, imageName);
            uploadedUrls.set(index, url);
        }));
      }

      const auditChanges: any[] = [];

      data.items.forEach((item, index) => {
        const newItemRef = doc(collection(firestore, 'stockKeeperItems'));
        const imageUrl = uploadedUrls.get(index);
        const itemData = {
          name: item.name,
          barcode: item.barcode,
          quantity: item.quantity,
          category: item.category,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          supplier: data.supplier === 'no-supplier' ? null : data.supplier,
          lowStockThreshold: item.lowStockThreshold,
          images: imageUrl ? [imageUrl] : [],
          held: 0,
          createdAt: serverTimestamp(),
          expiryDate: item.expiryDate ? Timestamp.fromDate(new Date(item.expiryDate)) : null,
          promoPrice: item.promoPrice || null,
          promoType: item.promoPrice ? item.promoType : null,
          promoStartDate: item.promoDates?.from ? Timestamp.fromDate(item.promoDates.from) : null,
          promoEndDate: item.promoDates?.to ? Timestamp.fromDate(item.promoDates.to) : null,
        };
        batch.set(newItemRef, itemData);

        auditChanges.push({
            field: `staged item: ${item.name}`,
            before: 'N/A',
            after: `Added ${item.quantity} unit(s)`
        });
      });

      const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        batch.set(auditLogRef, {
            timestamp: serverTimestamp(),
            userId: userProfile.uid,
            userName: userProfile.name,
            changeType: 'Create',
            entityType: 'Stock Keeper',
            entityId: 'Bulk Add',
            details: `Bulk added ${data.items.length} item(s) to staging.`,
            changes: auditChanges,
            notes: `Total Cost: ${formatCurrency(totalCost)}. Supplier: ${data.supplier || 'N/A'}. Invoice: ${data.invoiceNumber || 'N/A'}.`,
            keywords: ['create', 'staged', 'stock', ...data.items.map(i => i.name.toLowerCase()), ...data.items.map(i => i.category.toLowerCase())]
        });

      await batch.commit();

      toast({
        variant: 'success',
        title: 'Items Added to Staging',
        description: `${data.items.length} new item(s) have been successfully added to the stock keeper staging area.`,
      });
      form.reset({ items: [{ name: '', quantity: 1, category: '', costPrice: 0, sellingPrice: 0, lowStockThreshold: 10, promoType: 'fixed' }] });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
      setDataToSubmit(null);
    }
  };

  const onSubmit = (data: BulkAddFormValues) => {
    if (!data.supplier && !data.invoiceNumber) {
        setDataToSubmit(data);
        setShowNoSupplierConfirm(true);
    } else {
        processSubmit(data);
    }
  };

  const handleFileChange = (file: File, index: number) => {
    form.setValue(`items.${index}.imageFile`, file);
  };

  const handleRemoveImage = (index: number) => {
    form.setValue(`items.${index}.imageFile`, undefined);
  };

  const generateEan13 = (index: number) => {
    let base = '';
    for (let i = 0; i < 12; i++) {
        base += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(base[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    form.setValue(`items.${index}.barcode`, base + checksum.toString(), { shouldDirty: true });
  };

   const handleAddNewCategory = async (name: string) => {
    if (!firestore || !userProfile) return false;
    try {
        await addDoc(collection(firestore, 'stockCategories'), {
            name: name,
            createdAt: serverTimestamp(),
            createdBy: userProfile.name,
        });
        toast({ variant: 'success', title: 'Category Added', description: `${name} has been added.` });
        if (activeItemIndex !== null) {
            form.setValue(`items.${activeItemIndex}.category`, name);
        }
        return true;
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return false;
    }
  };

  const [openPopovers, setOpenPopovers] = React.useState<boolean[]>([]);

  React.useEffect(() => {
    setOpenPopovers(fields.map(() => false));
  }, [fields.length]);

  const togglePopover = (index: number) => {
    setOpenPopovers(prev => {
        const newPopovers = [...prev];
        newPopovers[index] = !newPopovers[index];
        return newPopovers;
    });
  };

  const closePopover = (index: number) => {
    setOpenPopovers(prev => {
        const newPopovers = [...prev];
        newPopovers[index] = false;
        return newPopovers;
    });
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);


  return (
    <>
    <div className="space-y-6">
       <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/stock-keeper">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bulk Add to Staging</h1>
                <p className="text-muted-foreground">Quickly add multiple new items to your staging area before transferring to main inventory.</p>
            </div>
        </div>

      <Form {...form}>
        <form id="bulk-add-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Collapsible>
                <Card>
                    <CollapsibleTrigger asChild>
                         <CardHeader className="cursor-pointer hover:bg-muted/50 rounded-t-lg flex-row items-center justify-between">
                            <div>
                                <CardTitle>Supplier Information (Optional)</CardTitle>
                                <CardDescription>Link these items to a supplier and invoice for better tracking.</CardDescription>
                            </div>
                             <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <FormField
                                    control={form.control}
                                    name="supplier"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Supplier</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a supplier" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="no-supplier">None</SelectItem>
                                                    {suppliers?.map((sup) => (<SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="invoiceNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Invoice Number</FormLabel>
                                            <div className="relative">
                                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl><Input placeholder="e.g., INV-12345" className="pl-10" {...field} value={field.value || ''} /></FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            <Card>
                <CardHeader>
                    <CardTitle>Items to Add</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const imageFile = watchItems[index]?.imageFile;
                            const imagePreview = imageFile ? URL.createObjectURL(imageFile) : null;
                            const promoType = watchItems[index]?.promoType;

                            return (
                            <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <FormField control={form.control} name={`items.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Item Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField
                                        control={form.control}
                                        name={`items.${index}.category`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Category</FormLabel>
                                            <Popover open={openPopovers[index]} onOpenChange={() => togglePopover(index)}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                            {field.value || "Select category"} <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search category..." />
                                                        <CommandList>
                                                            <CommandEmpty>No category found.</CommandEmpty>
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => {
                                                                        setActiveItemIndex(index);
                                                                        setIsAddCategoryOpen(true);
                                                                    }}
                                                                >
                                                                    <PlusCircle className="mr-2 h-4 w-4" /> Create New
                                                                </CommandItem>
                                                                {categories?.map((cat) => (
                                                                <CommandItem key={cat.id} value={cat.name} onSelect={() => {form.setValue(`items.${index}.category`, cat.name); closePopover(index);}}>
                                                                    {cat.name}
                                                                    <CheckIcon className={cn("ml-auto h-4 w-4", field.value === cat.name ? "opacity-100" : "opacity-0")} />
                                                                </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name={`items.${index}.costPrice`} render={({ field }) => (<FormItem><FormLabel>Cost Price</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="0.00" {...field} className="pl-8" /></FormControl></div><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`items.${index}.sellingPrice`} render={({ field }) => (<FormItem><FormLabel>Selling Price</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="0.00" {...field} className="pl-8" /></FormControl></div><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name={`items.${index}.barcode`} render={({ field }) => (<FormItem><FormLabel>Barcode</FormLabel><div className="flex items-center gap-2"><div className="relative flex-1"><Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input placeholder="Scan or enter" className="pl-10" {...field} value={field.value || ''} /></FormControl></div><Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => generateEan13(index)}><Wand2 className="h-4 w-4"/></Button></div><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`items.${index}.lowStockThreshold`} render={({ field }) => (<FormItem><FormLabel>Low Stock Threshold</FormLabel><FormControl><Input type="number" placeholder="e.g. 10" {...field} value={field.value || ''}/></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`items.${index}.expiryDate`} render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <div className="space-y-2">
                                     <Label>Promotional Price (Optional)</Label>
                                     <div className="p-3 border rounded-md space-y-4">
                                        <FormField control={form.control} name={`items.${index}.promoType`} render={({ field }) => (
                                             <FormItem><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="fixed" /></FormControl><FormLabel className="font-normal">Fixed Price</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="percentage" /></FormControl><FormLabel className="font-normal">Percentage</FormLabel></FormItem></RadioGroup></FormControl></FormItem>
                                        )}/>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name={`items.${index}.promoPrice`} render={({ field }) => (<FormItem><FormLabel>{promoType === 'percentage' ? 'Discount %' : 'Promo Price'}</FormLabel><div className="relative">{promoType === 'fixed' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}<FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} placeholder={promoType === 'percentage' ? 'e.g., 20' : 'e.g., 120'} className={cn(promoType === 'fixed' && "pl-10")}/></FormControl>{promoType === 'percentage' && <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}</div><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name={`items.${index}.promoDates`} render={({ field }) => (<FormItem><FormLabel>Promo Dates</FormLabel><FormControl><DateRangePicker date={field.value} onDateChange={field.onChange}/></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                     </div>
                                </div>
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.imageFile`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Image</FormLabel>
                                            {imagePreview ? (
                                                <div className="relative group w-24 h-24">
                                                    <Image src={imagePreview} alt="Preview" fill style={{ objectFit: 'cover' }} className="rounded-md border p-1" />
                                                    <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveImage(index)}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50" onClick={() => document.getElementById(`file-input-${index}`)?.click()}>
                                                    <Upload className="w-6 h-6 text-muted-foreground" />
                                                    <p className="mt-1 text-xs text-muted-foreground">Upload</p>
                                                </div>
                                            )}
                                            <FormControl><Input id={`file-input-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files![0], index)} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )})}
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ name: '', quantity: 1, category: '', costPrice: 0, sellingPrice: 0, lowStockThreshold: 10, promoType: 'fixed' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Another Item
                    </Button>
                </CardContent>
                <CardFooter className="bg-muted/50 p-4 flex justify-end items-center gap-8">
                     <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Items</p>
                        <p className="text-xl font-bold">{totalItems}</p>
                    </div>
                     <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Cost</p>
                        <p className="text-xl font-bold">{formatCurrency(totalCost)}</p>
                    </div>
                     <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Selling Value</p>
                        <p className="text-xl font-bold">{formatCurrency(totalSellingValue)}</p>
                    </div>
                </CardFooter>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" form="bulk-add-form" loading={isSaving} disabled={fields.length === 0}>
                    <PackagePlus className="mr-2 h-4 w-4" /> Add All Items to Staging
                </Button>
            </div>
        </form>
      </Form>
    </div>
    <AddCategoryDialog
        open={isAddCategoryOpen}
        onOpenChange={setIsAddCategoryOpen}
        onCategoryAdded={handleAddNewCategory}
    />
     <AlertDialog open={showNoSupplierConfirm} onOpenChange={setShowNoSupplierConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Supplier Information</AlertDialogTitle>
            <AlertDialogDescription>
              You have not specified a supplier or invoice number. Do you want to proceed with adding these items without this information?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDataToSubmit(null)}>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (dataToSubmit) {
                const dataWithNoSupplier = { ...dataToSubmit, supplier: 'no-supplier' };
                processSubmit(dataWithNoSupplier);
              }
            }}>Yes, Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddCategoryDialog({ open, onOpenChange, onCategoryAdded }: { open: boolean, onOpenChange: (open: boolean) => void, onCategoryAdded: (name: string) => Promise<boolean> }) { const [name, setName] = React.useState(''); const [isSaving, setIsSaving] = React.useState(false); const { toast } = useToast();

const handleSubmit = async () => {
    if (!name.trim()) {
        toast({ variant: 'destructive', title: 'Category name cannot be empty.' });
        return;
    }
    setIsSaving(true);
    const success = await onCategoryAdded(name);
    setIsSaving(false);
    if (success) {
        onOpenChange(false);
        setName('');
    }
};

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Create New Category</DialogTitle>
                <DialogDescription>
                    Add a new category to organize your stock items.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="category-name">Category Name</Label>
                <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Soft Drinks" />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} loading={isSaving}>Create</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
)

}

export default withAuth(BulkAddPage, PagePermission.RESTOCK_INVENTORY);