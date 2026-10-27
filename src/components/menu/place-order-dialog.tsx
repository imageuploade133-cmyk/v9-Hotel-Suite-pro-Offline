
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Hash, User, Phone } from 'lucide-react';
import type { CartItem, Order, Booking } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { useSettings } from '@/contexts/settings-context';

interface PlaceOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onSuccess: () => void;
  menuId: string;
}

export function PlaceOrderDialog({ isOpen, onClose, cart, onSuccess, menuId }: PlaceOrderDialogProps) {
  const [isPlacingOrder, setIsPlacingOrder] = React.useState(false);
  const [roomNumber, setRoomNumber] = React.useState('');
  const [guestName, setGuestName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();

  const totalPrice = cart.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);
  const currency = settings?.currency || 'USD';

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  const handlePlaceOrder = async () => {
    if (!roomNumber.trim() || !guestName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter your room number and name.',
      });
      return;
    }
    if (!firestore) return;
    setIsPlacingOrder(true);

    try {
      const orderNumber = `WEB-${Date.now().toString().slice(-6)}`;

      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('roomNumber', '==', roomNumber),
        where('status', 'in', ['Active', 'Checked-in']),
        limit(1)
      );
      const bookingSnapshot = await getDocs(bookingsQuery);
      const currentBooking = !bookingSnapshot.empty ? { id: bookingSnapshot.docs[0].id, ...bookingSnapshot.docs[0].data() } as Booking : null;

      const orderData: Omit<Order, 'id'> = {
        orderNumber,
        roomNumber,
        guestName,
        phoneNumber,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            images: item.images || [],
        })),
        totalPrice,
        status: 'Pending',
        createdAt: serverTimestamp() as any,
        source: 'guest',
        menuId: menuId,
        bookingId: currentBooking?.id,
      };

      await addDoc(collection(firestore, 'orders'), orderData);
      onSuccess();
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: 'There was a problem placing your order. Please try again.',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm Your Order</DialogTitle>
          <DialogDescription>
            Please confirm the items and provide your details below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <h4 className="font-semibold">Order Summary</h4>
            <ScrollArea className="h-48 rounded-md border p-4">
               <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-start text-sm">
                    <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency((item.price || 0) * item.quantity)}</p>
                  </div>
                ))}
               </div>
            </ScrollArea>
             <Separator />
             <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(totalPrice)}</span>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold">Your Details</h4>
             <div className="space-y-2">
                <Label htmlFor="guestName">Name</Label>
                 <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="guestName" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your full name" className="pl-10" />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="roomNumber">Room Number</Label>
                <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="roomNumber" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g., 101" className="pl-10" />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                 <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phoneNumber" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="For order updates" className="pl-10" />
                </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPlacingOrder}>Cancel</Button>
          <Button onClick={handlePlaceOrder} disabled={isPlacingOrder || !roomNumber || !guestName}>
            {isPlacingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Place Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
