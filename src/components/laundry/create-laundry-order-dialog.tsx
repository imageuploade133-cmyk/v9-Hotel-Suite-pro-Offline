
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
import { Loader2, Plus, Minus, Trash2, User, Bed, Search, ShoppingCart } from 'lucide-react';
import type { LaundryOrder, Booking, LaundryServiceItem } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettings } from '@/contexts/settings-context';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/user-context';

const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Item name is required.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  quantity: z.coerce.number().min(1, 'Must be at least 1.'),
});

const laundryOrderSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required.'),
  items: z.array(itemSchema).min(1, 'At least one item is required.'),
  notes: z.string().optional(),
});

type LaundryOrderFormValues = z.infer<typeof laundryOrderSchema>;

interface CreateLaundryOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: Omit<LaundryOrder, 'id' | 'createdAt' | 'orderNumber' | 'source'>) => Promise<void>;
}

export function CreateLaundryOrderDialog({ isOpen, onClose, onSubmit }: CreateLaundryOrderDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const currency = settings?.currency || 'USD';

  const form = useForm<LaundryOrderFormValues>({
    resolver: zodResolver(laundryOrderSchema),
    defaultValues: {
      roomNumber: '',
      items: [],
      notes: '',
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        roomNumber: '',
        items: [],
        notes: '',
      });
      setIsSaving(false);
      setSearchTerm('');
    }
  }, [isOpen, form]);

  const activeBookingsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in']));
  }, [firestore]);
  const { data: activeBookings } = useCollection<Booking>(activeBookingsQuery);

  const laundryItemsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'laundryItems'));
  }, [firestore]);
  const { data: laundryServiceItems } = useCollection<LaundryServiceItem>(laundryItemsQuery);

  const filteredLaundryItems = React.useMemo(() => {
      if (!laundryServiceItems) return [];
      if (!searchTerm) return laundryServiceItems;
      return laundryServiceItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [laundryServiceItems, searchTerm]);

  const handleAddItem = (item: LaundryServiceItem) => {
    const existingItemIndex = fields.findIndex(field => field.id === item.id);
    if (existingItemIndex > -1) {
      const currentItem = fields[existingItemIndex];
      update(existingItemIndex, { ...currentItem, quantity: currentItem.quantity + 1 });
    } else {
      append({ id: item.id, name: item.name, price: item.price, quantity: 1 });
    }
  };

  const handleQuantityChange = (index: number, change: number) => {
    const currentItem = fields[index];
    const newQuantity = currentItem.quantity + change;
    if (newQuantity <= 0) {
      remove(index);
    } else {
      update(index, { ...currentItem, quantity: newQuantity });
    }
  };

  const handleFormSubmit = async (data: LaundryOrderFormValues) => {
    setIsSaving(true);
    const totalPrice = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const booking = activeBookings?.find(b => b.roomNumber === data.roomNumber);

    try {
      await onSubmit({
        ...data,
        guestName: booking?.guestName || 'Unknown Guest',
        bookingId: booking?.id,
        status: 'Pending',
        totalPrice,
        items: data.items.map(i => ({ serviceId: i.id, serviceName: i.name, ...i })),
        source: 'staff',
      });
      form.reset();
    } finally {
      setIsSaving(false);
    }
  };

  const watchItems = form.watch('items');
  const totalPrice = watchItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Laundry Order</DialogTitle>
          <DialogDescription>Create a new laundry request for a guest.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="laundry-order-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 pt-4">
             {/* Left Column: Available Services */}
             <div className="flex flex-col gap-4 border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold">Available Laundry Services</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search services..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <ScrollArea className="flex-1 -mx-4">
                    <div className="px-4 space-y-2">
                        {filteredLaundryItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 border rounded-md bg-background">
                                <div>
                                    <p className="font-medium text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => handleAddItem(item)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Column: Order Details & Cart */}
            <div className="flex flex-col gap-4">
                <FormField
                    control={form.control}
                    name="roomNumber"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Room Number</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <div className="flex items-center gap-2"><Bed className="h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Select a guest's room..." /></div>
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {activeBookings?.map(b => (
                            <SelectItem key={b.id} value={b.roomNumber}>{b.roomNumber} ({b.guestName})</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <div className="border rounded-lg p-4 flex-1 flex flex-col min-h-0">
                     <h3 className="font-semibold flex items-center gap-2 mb-3"><ShoppingCart className="h-5 w-5" /> Current Order</h3>
                     <ScrollArea className="flex-1 -mx-4 pr-1">
                        <div className="px-4 space-y-3">
                            {fields.length === 0 ? <p className="text-sm text-center py-10 text-muted-foreground">Add items from the list.</p> : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{field.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(field.price)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(index, -1)}><Minus className="h-4 w-4" /></Button>
                                            <span className="font-bold w-5 text-center">{field.quantity}</span>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(index, 1)}><Plus className="h-4 w-4" /></Button>
                                        </div>
                                        <p className="font-semibold w-20 text-right">{formatCurrency(field.price * field.quantity)}</p>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))
                            )}
                        </div>
                     </ScrollArea>
                     <Separator className="my-4"/>
                    <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(totalPrice)}</span>
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Guest requests express service." {...field} value={field.value || ''}/></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
          </form>
        </Form>
        <DialogFooter className="pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="laundry-order-form" loading={isSaving}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
