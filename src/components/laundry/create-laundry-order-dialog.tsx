
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { WashingMachine, Plus, Minus, Trash2, Bed, Search, ShoppingCart } from 'lucide-react';
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
      <DialogContent className="mobile-fullscreen-dialog mobile-fullscreen-laundry-dialog flex h-[100dvh] w-screen max-h-none max-w-none flex-col gap-3 overflow-hidden rounded-none p-3 sm:h-[90dvh] sm:max-h-[min(90dvh,54rem)] sm:max-w-5xl sm:rounded-xl sm:p-6">
        <DialogHeader className="shrink-0 space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl"><WashingMachine className="h-5 w-5 text-primary" /> New Laundry Order</DialogTitle>
          <DialogDescription>Select the guest's room, add laundry services, review the total and create the order.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="laundry-order-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="mobile-fullscreen-dialog-laundry-body grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(9rem,0.85fr)_minmax(0,1.15fr)] gap-3 overflow-hidden pt-1 md:grid-cols-2 md:grid-rows-1 md:gap-5 md:pt-3">
             {/* Left Column: Available Services */}
             <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-xl border bg-muted/30 p-3 sm:gap-3 sm:p-4">
                <div className="flex shrink-0 items-center justify-between gap-2"><div><h3 className="font-semibold">Available services</h3><p className="text-xs text-muted-foreground">Choose items to add to this order</p></div><Badge variant="secondary">{filteredLaundryItems.length} services</Badge></div>
                <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search services..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <ScrollArea className="min-h-0 min-w-0 flex-1 -mx-3 sm:-mx-4">
                    <div className="space-y-2 px-3 sm:px-4">
                        {filteredLaundryItems.length === 0 ? (
                          <div className="rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                            {searchTerm ? 'No services match your search.' : 'No laundry services are configured yet.'}
                          </div>
                        ) : filteredLaundryItems.map(item => (
                            <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background p-2.5 sm:p-3">
                                <div>
                                    <p className="truncate text-sm font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 gap-1.5" aria-label={`Add ${item.name}`} onClick={() => handleAddItem(item)}>
                                    <Plus className="h-4 w-4" /><span className="hidden sm:inline">Add</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </section>

            {/* Right Column: Order Details & Cart */}
            <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain pr-1 sm:gap-4">
                <FormField
                    control={form.control}
                    name="roomNumber"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Room Number</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <div className="flex items-center gap-2"><Bed className="h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Choose an occupied room" /></div>
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

                <div className="flex min-h-[9rem] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card p-3 sm:min-h-[11rem] sm:p-4">
                     <div className="mb-2 flex shrink-0 items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-5 w-5" /> Order summary</h3><Badge variant="outline">{watchItems.length} {watchItems.length === 1 ? 'item' : 'items'}</Badge></div>
                     <ScrollArea className="min-h-0 flex-1 -mx-3 pr-1 sm:-mx-4">
                        <div className="space-y-3 px-3 sm:px-4">
                            {fields.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground"><ShoppingCart className="mx-auto mb-2 h-7 w-7 opacity-40" /><p>Your order is empty</p><p className="mt-1 text-xs">Choose a service from the list to get started.</p></div> : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="flex min-w-0 items-center gap-2 border-b pb-2 last:border-0">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm">{field.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(field.price)}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1 rounded-full border px-1">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Decrease ${field.name} quantity`} onClick={() => handleQuantityChange(index, -1)}><Minus className="h-4 w-4" /></Button>
                                            <span className="font-bold w-5 text-center">{field.quantity}</span>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Increase ${field.name} quantity`} onClick={() => handleQuantityChange(index, 1)}><Plus className="h-4 w-4" /></Button>
                                        </div>
                                        <p className="w-[4.5rem] shrink-0 text-right text-sm font-semibold">{formatCurrency(field.price * field.quantity)}</p>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label={`Remove ${field.name}`} onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))
                            )}
                        </div>
                     </ScrollArea>
                     <Separator className="my-4"/>
                    <div className="flex shrink-0 items-center justify-between gap-3 text-base font-bold sm:text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(totalPrice)}</span>
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Special instructions <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                        <FormControl><Textarea className="min-h-[64px] resize-y" placeholder="e.g. Express service, delicate fabric, or other guest requests..." {...field} value={field.value || ''}/></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </section>
          </form>
        </Form>
        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t pb-[env(safe-area-inset-bottom)] pt-3 sm:flex-row sm:justify-end sm:pb-0 sm:pt-4">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="laundry-order-form" className="w-full sm:w-auto" loading={isSaving} disabled={isSaving}>Create Laundry Order · {formatCurrency(totalPrice)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
