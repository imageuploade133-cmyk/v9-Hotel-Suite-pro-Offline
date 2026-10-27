
'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { Upload, X, DollarSign, Percent, Tag, PlusCircle, Users } from 'lucide-react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Card } from '../ui/card';
import { DateRangePicker } from '../ui/date-range-picker';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/settings-context';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { AddCategoryDialog } from '../stock-keeper/add-edit-stock-keeper-item-dialog';
import { useUser } from '@/contexts/user-context';
import { Textarea } from '../ui/textarea';
import * as z from 'zod';

export const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1.'),
  totalRooms: z.coerce.number().min(0, 'Total rooms cannot be negative.'),
  facilities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  newImageFiles: z.array(z.instanceof(File)).optional(),
  roomNumbers: z.string().optional(),
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
}).refine(data => {
  if (data.promoPrice) {
    return !!data.promoDates?.from;
  }
  return true;
}, {
  message: 'Promotional dates are required when a promotional price is set.',
  path: ['promoDates'],
});

export interface RoomFormValues {
    name: string;
    price: number;
    capacity: number;
    totalRooms: number;
    facilities: string[];
    images: string[];
    newImageFiles?: File[];
    roomNumbers?: string;
    promoPrice?: number;
    promoType?: 'fixed' | 'percentage';
    promoDates?: { from: Date; to: Date };
}

interface RoomFormFieldsProps {
  form: UseFormReturn<RoomFormValues>;
  isEditMode: boolean;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

export function RoomFormFields({ form, isEditMode }: RoomFormFieldsProps) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const firestore = useFirestore();

  const [isDragging, setIsDragging] = React.useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const maxFileSize = settings?.maxFileSizeMb ?? 5;
  const promoType = form.watch('promoType');
  const checkoutTime = settings?.checkoutTime || '11:00';

  const roomFacilitiesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomFacilities'));
  }, [firestore]);
  const { data: roomFacilities } = useCollection(roomFacilitiesQuery);

  const newImageFiles = form.watch('newImageFiles') || [];
  const existingImageUrls = form.watch('images') || [];

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (selectedFiles) {
        const newFiles = Array.from(selectedFiles).filter(file => {
            if (file.size > maxFileSize * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Too Large', description: `${file.name} is larger than ${maxFileSize}MB.` });
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

  const roomNumbersString = form.watch('roomNumbers');
  React.useEffect(() => {
    const numbers = roomNumbersString?.split(',').map((n: string) => n.trim()).filter(Boolean) || [];
    form.setValue('totalRooms', numbers.length, { shouldValidate: true });
  }, [roomNumbersString, form]);

  return (
    <div className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room Name</FormLabel>
              <FormControl><Input placeholder="e.g. Deluxe King Suite" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Price per Night</FormLabel>
                <FormControl><Input type="number" {...field} placeholder="150" /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <FormControl><Input type="number" {...field} placeholder="e.g., 2" className="pl-10" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalRooms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Rooms</FormLabel>
                  <FormControl><Input type="number" {...field} readOnly className="font-bold bg-muted" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <FormField
            control={form.control}
            name="roomNumbers"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Room Numbers</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="Enter room numbers separated by commas, e.g., 101, 102, 201, 202A"
                            {...field}
                            rows={4}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

        <Separator />

        <div className="space-y-4 rounded-md border p-4">
             <h4 className="font-medium text-foreground mb-2 flex items-center gap-2"><Percent className="h-5 w-5"/> Promotional Pricing (Optional)</h4>
            <FormField control={form.control} name="promoType" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Discount Type</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4"><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="fixed" /></FormControl><FormLabel className="font-normal">Fixed Price</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="percentage" /></FormControl><FormLabel className="font-normal">Percentage</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="promoPrice"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{promoType === 'percentage' ? 'Discount Percentage' : 'Promotional Price'}</FormLabel>
                            <div className="relative">{promoType === 'fixed' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                 <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        {...field}
                                        value={field.value ?? ""}
                                        placeholder={promoType === 'percentage' ? 'e.g., 20' : 'e.g., 120'}
                                        className={cn(promoType === 'fixed' && "pl-10")}
                                    />
                                </FormControl>
                                {promoType === 'percentage' && <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="promoDates"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Promo Dates</FormLabel>
                            <FormControl>
                                <DateRangePicker
                                date={field.value}
                                onDateChange={field.onChange}
                                />
                            </FormControl>
                             <FormDescription className="text-xs">
                                Promotion ends at checkout time ({checkoutTime}) on the selected end date.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>

        {roomFacilities && roomFacilities.length > 0 && (
          <FormField
            control={form.control}
            name="facilities"
            render={() => (
              <FormItem>
                <Separator />
                <div className="mb-4 pt-2">
                  <FormLabel className="text-base">Facilities</FormLabel>
                  <FormMessage />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(roomFacilities as any[]).map((item: any) => {
                     return (
                        <FormField
                        key={item.id}
                        control={form.control}
                        name="facilities"
                        render={({ field }) => (
                            <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                            >
                            <FormControl>
                                <Checkbox
                                checked={field.value?.includes(item.name)}
                                onCheckedChange={(checked) => {
                                    return checked
                                    ? field.onChange([...(field.value ?? []), item.name])
                                    : field.onChange(
                                        field.value?.filter(
                                            (value) => value !== item.name
                                        )
                                        )
                                }}
                                />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                                <DynamicIcon iconName={item.name} className="h-4 w-4 text-muted-foreground" />
                                {item.name}
                            </FormLabel>
                            </FormItem>
                        )}
                        />
                     )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
         <FormItem>
            <Separator />
            <div className="pt-2">
                <FormLabel>Room Images</FormLabel>
            </div>
             <div
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                {...handleDragEvents}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
            </div>
             <FormControl>
                <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                />
            </FormControl>

            {(existingImageUrls.length > 0 || newImageFiles.length > 0) && (
              <Carousel className="w-full">
                <CarouselContent>
                  {existingImageUrls.map((url, index) => (<CarouselItem key={url} className="basis-1/2 md:basis-1/3"><Card className="overflow-hidden group relative aspect-square"><Image src={url} alt={`Existing Image ${index}`} fill className="object-cover"/><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end rounded-md p-2"><Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveExistingImage(index)}><X className="h-4 w-4" /></Button></div></Card></CarouselItem>))}
                  {newImageFiles.map((file, index) => (<CarouselItem key={file.name + index} className="basis-1/2 md:basis-1/3"><Card className="overflow-hidden group relative aspect-square"><Image src={URL.createObjectURL(file)} alt={`Preview ${index}`} fill className="object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end rounded-md p-2"><Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleRemoveNewImage(index)}><X className="h-4 w-4" /></Button></div></Card></CarouselItem>))}
                </CarouselContent>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </Carousel>
            )}

            <FormMessage />
        </FormItem>
    </div>
  );
}
