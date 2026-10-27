'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Loader2, PlusCircle, Trash2, User, DollarSign, Bed, CreditCard, ChevronsUpDown, Check } from 'lucide-react';
import type { SalonService, SalonServiceItem, UserProfile } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettings } from '@/contexts/settings-context';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/user-context';

const serviceItemSchema = z.object({
  name: z.string().min(1, 'Service is required.'),
  price: z.coerce.number().min(0, 'Price must be non-negative.'),
});

const salonOrderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required.'),
  roomNumber: z.string().optional(),
  bookingId: z.string().optional(),
  items: z.array(serviceItemSchema).min(1, 'At least one service is required.'),
  notes: z.string().optional(),
  paymentStatus: z.enum(['Paid', 'Unpaid']),
  paymentMethod: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentStatus === 'Paid' && !data.paymentMethod) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['paymentMethod'],
            message: 'Payment method is required for paid services.',
        });
    }
});


type SalonOrderFormValues = z.infer<typeof salonOrderSchema>;

interface CreateSalonOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: SalonService) => void;
}

export function CreateSalonOrderDialog({ isOpen, onClose, onSuccess }: CreateSalonOrderDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const currency = settings?.currency || 'USD';

  const form = useForm<SalonOrderFormValues>({
    resolver: zodResolver(salonOrderSchema),
    defaultValues: {
      customerName: '',
      roomNumber: '',
      items: [],
      notes: '',
      paymentStatus: 'Unpaid',
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (fields.length === 0) {
      append({ name: '', price: 0 });
    }
  }, [fields, append]);

  const salonServicesQuery = React.useMemo(() => {
    return firestore ? query(collection(firestore, 'salonServiceItems')) : null;
  }, [firestore]);
  const { data: serviceItems } = useCollection<SalonServiceItem>(salonServicesQuery);

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const handleServiceSelect = (service: SalonServiceItem, index: number) => {
    update(index, {
      ...fields[index],
      name: service.name,
      price: service.price,
    });
  };

  const handleFormSubmit = async (data: SalonOrderFormValues) => {
    if (!userProfile) return;
    setIsSaving(true);
    const totalPrice = data.items.reduce((sum, item) => sum + item.price, 0);

    try {
      const orderData: Omit<SalonService, 'id'> = {
        ...data,
        totalPrice,
        status: 'Pending',
        orderNumber: Math.floor(100000 + Math.random() * 900000).toString(),
        createdAt: serverTimestamp() as any,
        staffId: userProfile.uid,
        staffName: userProfile.name,
      };

      const docRef = await addDoc(collection(firestore, 'salonServices'), orderData);

      toast({ variant: 'success', title: 'Service Created' });
      onSuccess({ id: docRef.id, ...orderData } as SalonService);
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        customerName: '',
        roomNumber: '',
        items: [{ name: '', price: 0 }],
        notes: '',
        paymentStatus: 'Unpaid',
        paymentMethod: undefined,
      });
    }
  }, [isOpen, form]);

  const watchItems = form.watch('items');
  const totalPrice = watchItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const paymentStatus = form.watch('paymentStatus');

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Salon Service</DialogTitle>
          <DialogDescription>Add a new service for a customer.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="salon-order-form" onSubmit={form.handleSubmit(handleFormSubmit)}>
            <ScrollArea className="max-h-[65vh] -mx-6 px-6">
              <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <FormControl><Input placeholder="e.g., John Doe" className="pl-10" {...field} /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="roomNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Room Number (Optional)</FormLabel>
                            <div className="relative">
                                <Bed className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <FormControl><Input placeholder="e.g., 102" className="pl-10" {...field} /></FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Separator />

                <div className="space-y-4">
                  <FormLabel>Services</FormLabel>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <FormField
                            control={form.control}
                            name={`items.${index}.name`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Service</FormLabel>
                                    <Popover open={openPopovers[index]} onOpenChange={() => togglePopover(index)}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                                    {field.value || "Select item or type..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search items..." onValueChange={(value) => field.onChange(value)} />
                                                <CommandList>
                                                    <CommandEmpty>No item found. You can add it as a custom item.</CommandEmpty>
                                                    <CommandGroup>
                                                        {serviceItems?.map(item => (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                onSelect={() => {
                                                                    handleServiceSelect(item, index);
                                                                    closePopover(index);
                                                                }}
                                                            >
                                                                {item.name}
                                                                <Check className={cn("ml-auto h-4 w-4", item.name === field.value ? "opacity-100" : "opacity-0")} />
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
                         <FormField
                            control={form.control}
                            name={`items.${index}.price`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Price ({currency})</FormLabel>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <FormControl><Input type="number" {...field} className="pl-8" /></FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                      </div>
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', price: 0 })}><PlusCircle className="mr-2 h-4 w-4" />Add Service</Button>
                </div>

                 <Separator />

                <div className="flex justify-end items-center text-xl font-bold">
                    <span>Total:</span>
                    <span className="ml-4">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(totalPrice)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="paymentStatus"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Payment Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Set payment status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {paymentStatus === 'Paid' && (
                         <FormField
                            control={form.control}
                            name="paymentMethod"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Payment Method</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                <SelectValue placeholder="Select a payment method" />
                                            </div>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {paymentMethods?.map((method: any) => (
                                        <SelectItem key={method.id} value={method.name}>
                                            {method.name}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>
              </div>
            </ScrollArea>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="salon-order-form" loading={isSaving}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
