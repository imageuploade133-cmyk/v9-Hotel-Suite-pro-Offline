'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2, Upload, X, User, Phone, Mail, CreditCard, DollarSign } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, setDoc, writeBatch, query } from 'firebase/firestore';
import type { GymMember, Payment, GymMembershipPlan } from '@/lib/types';
import Image from 'next/image';
import { useSettings } from '@/contexts/settings-context';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useUser } from '@/contexts/user-context';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email.').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  expiresAt: z.date({ required_error: "An expiry date is required." }),
  photo: z.instanceof(File).optional(),
  photoURL: z.string().optional(),
  membershipFee: z.coerce.number().min(0, 'Fee must be a positive number.').optional(),
  paymentMethod: z.string().optional(),
  planId: z.string().optional(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadImage(file: File, apiKey: string, name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const base64Image = event.target.result.split(',')[1];
                const formData = new FormData();
                formData.append('image', base64Image);
                formData.append('name', name);
                const uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;

                try {
                    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
                    const result = await response.json();
                    if (result.success) resolve(result.data.url);
                    else reject(new Error(result.error?.message || 'Image upload failed'));
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

export function AddEditMemberDialog({ open, onOpenChange, onSuccess, member }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (payment?: Payment) => void;
  member: GymMember | null;
}) {
  const isEditMode = !!member;
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { user, userProfile } = useUser();
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;
  const currency = settings?.currency || 'USD';
  const countryCode = settings?.countryCode || '';

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'paymentMethods');
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const membershipPlansQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'gymMembershipPlans'));
  }, [firestore]);
  const { data: membershipPlans } = useCollection<GymMembershipPlan>(membershipPlansQuery);

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      photoURL: '',
      expiresAt: addDays(new Date(), 30),
      membershipFee: 0,
      paymentMethod: undefined,
      planId: undefined,
    }
  });

  const photoFile = form.watch('photo');
  const photoUrlValue = form.watch('photoURL');
  const imagePreview = photoFile ? URL.createObjectURL(photoFile) : photoUrlValue;
  const selectedPlanId = form.watch('planId');

  React.useEffect(() => {
    if (selectedPlanId && membershipPlans) {
        const plan = membershipPlans.find(p => p.id === selectedPlanId);
        if (plan) {
            form.setValue('membershipFee', plan.price);
            form.setValue('expiresAt', addDays(new Date(), plan.duration));
        }
    }
  }, [selectedPlanId, membershipPlans, form]);


  React.useEffect(() => {
    if (open) {
      if (isEditMode && member && member.expiresAt) {
        form.reset({
          name: member.name || '',
          email: member.email || '',
          phoneNumber: member.phoneNumber || '',
          photoURL: member.photoURL || '',
          expiresAt: member.expiresAt.toDate(),
          photo: undefined,
          membershipFee: member.membershipFee ?? 0,
          planId: member.planId,
          paymentMethod: member.paymentMethod
        });
      } else {
        form.reset({
          name: '', email: '', phoneNumber: '', photoURL: '', photo: undefined, expiresAt: addDays(new Date(), 30),
          membershipFee: 0,
          paymentMethod: undefined,
          planId: undefined,
        });
      }
    }
  }, [open, member, isEditMode, form]);

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
      form.setValue('photo', file, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    form.setValue('photo', undefined, { shouldDirty: true });
    form.setValue('photoURL', '', { shouldDirty: true });
    if(fileInputRef.current) fileInputRef.current.value = '';
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

  const onSubmit = async (data: MemberFormValues) => {
    if (!firestore || !user || !userProfile) return;

    if (!isEditMode && (!data.paymentMethod || data.membershipFee === undefined)) {
        toast({ variant: 'destructive', title: 'Payment Required', description: 'Please provide payment method and fee for new members.'});
        return;
    }

    setIsSaving(true);
    try {
      let finalPhotoURL = data.photoURL;
      if (data.photo) {
        toast({ title: 'Uploading Photo...' });
        const photoName = `gym-member-${data.name.replace(/\s+/g, '_')}_${Date.now()}`;
        finalPhotoURL = await uploadImage(data.photo, imgbbApiKey, photoName);
      }

      const phoneNumberWithCode = data.phoneNumber && countryCode && !data.phoneNumber.startsWith(countryCode)
        ? `${countryCode}${data.phoneNumber}`
        : data.phoneNumber;

      const memberData: Omit<GymMember, 'id' | 'createdAt'> = {
          memberId: isEditMode ? member.memberId : Math.floor(1000000000 + Math.random() * 9000000000),
          name: data.name,
          email: data.email || '',
          phoneNumber: phoneNumberWithCode,
          expiresAt: data.expiresAt,
          photoURL: finalPhotoURL,
          membershipFee: data.membershipFee,
          planId: data.planId,
          paymentMethod: data.paymentMethod,
      };

      if (isEditMode && member) {
        const memberRef = doc(firestore, 'gym-members', member.id);
        await updateDoc(memberRef, memberData);
        toast({ variant: 'success', title: 'Member Updated' });
        onSuccess();
      } else {
        const batch = writeBatch(firestore);
        const newMemberRef = doc(collection(firestore, 'gym-members'));
        batch.set(newMemberRef, { ...memberData, createdAt: serverTimestamp() });

        const totalPaid = (data.membershipFee || 0);
        let paymentRecord: Payment | null = null;

        if (data.paymentMethod && totalPaid > 0) {
            const paymentRef = doc(collection(firestore, 'payments'));
            const paymentData: Payment = {
                id: paymentRef.id,
                guestName: data.name,
                guestEmail: data.email || '',
                amount: totalPaid,
                paymentMethod: data.paymentMethod,
                status: 'Paid',
                transactionDate: new Date(),
                type: 'Gym Membership',
                createdByUid: user.uid,
                createdByName: userProfile.name,
            };
            batch.set(paymentRef, paymentData);
            paymentRecord = paymentData;
        }

        await batch.commit();
        toast({ variant: 'success', title: 'Member Registered' });
        if (paymentRecord) {
          onSuccess(paymentRecord);
        } else {
          onSuccess();
        }
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Gym Member' : 'Register New Gym Member'}</DialogTitle>
          <DialogDescription>Fill in the details below.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6 flex-1 min-h-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="member-form">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <div className="relative"><User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><FormControl><Input placeholder="John Doe" className="pl-10" {...field} /></FormControl></div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><FormControl><Input placeholder="john@example.com" className="pl-10" {...field} /></FormControl></div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                       <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-muted-foreground sm:text-sm">{countryCode}</span>
                          </div>
                          <FormControl><Input placeholder="1 234 567 890" className="pl-10" {...field} /></FormControl>
                       </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Membership Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a membership plan" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {(membershipPlans as any[])?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - ${plan.price} ({plan.duration} days)
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Membership Expires On</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus fromDate={new Date()} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormItem>
                    <FormLabel>Member Photo</FormLabel>
                    {imagePreview ? (
                        <div className="relative group w-40 h-40 mx-auto">
                            <Image src={imagePreview} alt="Member photo" fill style={{ objectFit: 'cover' }} className="rounded-full" />
                            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}><X className="h-5 w-5" /></Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                            {...handleDragEvents}
                            onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-8 h-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p><p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                        </div>
                    )}
                    <FormControl><Input ref={fileInputRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} /></FormControl>
                </FormItem>

                {!isEditMode && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="grid grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="membershipFee"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Membership Fee</FormLabel>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                                        <FormControl><Input type="number" placeholder="e.g. 200" className="pl-10" {...field} readOnly /></FormControl>
                                    </div>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Payment Method</FormLabel>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="pl-10"><SelectValue placeholder="Select a payment method" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(paymentMethods as any[])?.map((method: any) => (
                                                <SelectItem key={method.id} value={method.name}>
                                                    {method.name}
                                                </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                )}
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="member-form" loading={isSaving}>
            {isEditMode ? 'Save Changes' : 'Register Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
