
'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Phone, Mail, Users, Upload, X, Camera } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CameraCapture } from '@/components/CameraCapture';
import type { Room, BookingFormField } from './types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';

export const createBookingSchema = (customFields: BookingFormField[] = []) => {
    const customFieldSchema = customFields.reduce((schema, field) => {
        if (field.isRequired) {
            return schema.extend({
                [field.name]: z.string().min(1, `${field.name} is required.`),
            });
        }
        return schema.extend({
            [field.name]: z.string().optional(),
        });
    }, z.object({}));

    return z.object({
        guestName: z.string().min(2, { message: 'Please enter your full name.' }),
        guestEmail: z.string().email({ message: 'Please enter a valid email address.' }),
        guestPhoneNumber: z.string().min(1, { message: 'A phone number is required.' }),
        numberOfGuests: z.coerce.number().min(1, { message: 'Please enter at least one guest.' }),
        dateRange: z.object({
            from: z.date({ required_error: 'Check-in date is required.' }),
            to: z.date({ required_error: 'Check-out date is required.' }),
        }).refine(data => data.from && data.to, { message: 'Both check-in and check-out dates are required.' }),
        guestPhoto: z.instanceof(File).optional(),
        customFields: customFieldSchema.optional(),
    });
};

export type BookingFormValues = z.infer<ReturnType<typeof createBookingSchema>>;

interface BookingFormFieldsProps {
  form: ReturnType<typeof useForm<BookingFormValues>>;
  room: Partial<Room>;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

export function BookingFormFields({ form, room }: BookingFormFieldsProps) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const firestore = useFirestore();

  const maxFileSize = settings?.maxFileSizeMb ?? 5;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const guestPhoto = form.watch('guestPhoto');
  const imagePreview = guestPhoto ? URL.createObjectURL(guestPhoto) : null;
  const [isDragging, setIsDragging] = React.useState(false);

  const bookingFormFieldsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookingFormFields'));
  }, [firestore]);
  const { data: customFieldsData } = useCollection<BookingFormField>(bookingFormFieldsQuery);


  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File Too Large', description: `Must be < ${maxFileSize}MB.` });
        return;
      }
      form.setValue('guestPhoto', file, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    form.setValue('guestPhoto', undefined, { shouldDirty: true });
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
      if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
    },
  };

  return (
    <>
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="dateRange"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Stay Dates</FormLabel>
            <FormControl>
              <DateRangePicker
                date={field.value}
                onDateChange={(range) => field.onChange({ from: range?.from, to: range?.to })}
                disabledDates={[]} // Future: Pass disabled dates for this room
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="guestName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl><Input placeholder="John Doe" className="pl-10" {...field} /></FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="guestEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl><Input type="email" placeholder="john@example.com" className="pl-10" {...field} /></FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="guestPhoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl><Input type="tel" placeholder="+123456789" className="pl-10" {...field} /></FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="numberOfGuests"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Number of Guests</FormLabel>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <FormControl>
                <Input type="number" min="1" max={room.capacity || 4} {...field} />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
       {customFieldsData && customFieldsData.map((field: any) => (
        <FormField
          key={field.id}
          control={form.control}
          name={`customFields.${field.name}`}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>{field.name}{field.isRequired && <span className="text-destructive">*</span>}</FormLabel>
              <FormControl>
                <Input placeholder={`Enter ${field.name.toLowerCase()}`} {...formField} value={formField.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
       <FormItem>
            <FormLabel>Photo (Optional)</FormLabel>
            {imagePreview ? (
                <div className="relative group w-32 h-32">
                    <Image src={imagePreview} alt="Guest photo" fill style={{ objectFit: 'cover' }} className="rounded-full" />
                     <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}><X className="h-5 w-5" /></Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <div
                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors flex-1 ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                        {...handleDragEvents}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <p className="mt-2 text-xs text-muted-foreground">Upload or drag & drop</p>
                    </div>
                     <Button type="button" variant="outline" className="h-full flex flex-col p-6 items-center justify-center" onClick={() => setIsCameraOpen(true)}>
                         <Camera className="w-6 h-6 text-muted-foreground" />
                         <p className="mt-2 text-xs text-muted-foreground">Use Camera</p>
                    </Button>
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
            <FormMessage>{form.formState.errors.guestPhoto?.message as string}</FormMessage>
        </FormItem>
      </div>
       <CameraCapture
            open={isCameraOpen}
            onOpenChange={setIsCameraOpen}
            onCapture={(file) => {
                form.setValue('guestPhoto', file, { shouldDirty: true });
            }}
        />
    </>
  );
}
