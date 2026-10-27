
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Booking, Customer, UnifiedItem } from '@/lib/types';
import { DollarSign, CreditCard, CheckCircle, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: UnifiedItem[];
  activeRunningItems?: UnifiedItem[];
  customer: Partial<Customer> | null;
  onConfirm: (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit' | 'Unpaid', initialPaymentAmount?: number, initialPaymentMethod?: string, billToRoomBookingId?: string) => Promise<void>;
  isProcessing: boolean;
  discount: { type: 'percentage' | 'amount'; value: number } | null;
  allowBillToRoom?: boolean;
}

export function PaymentDialog({ isOpen, onClose, cart, activeRunningItems = [], customer, onConfirm, isProcessing, discount, allowBillToRoom = false }: PaymentDialogProps) {
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [amountPaid, setAmountPaid] = React.useState<number>(0);
  const [initialPaymentMethod, setInitialPaymentMethod] = React.useState<string>('Cash');
  const [paymentTab, setPaymentTab] = React.useState<'pay-now' | 'bill-to-room'>('pay-now');
  const [selectedBookingId, setSelectedBookingId] = React.useState<string>('');
  const [roomSearchTerm, setRoomSearchTerm] = React.useState('');

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const activeBookingsQuery = React.useMemo(() => {
    if (!firestore || !allowBillToRoom) return null;
    return query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in']));
  }, [firestore, allowBillToRoom]);
  const { data: activeBookings } = useCollection<Booking>(activeBookingsQuery);

  const allItems = [...activeRunningItems, ...cart];
  const subtotal = allItems.reduce((sum, item) => sum + ((item.price || item.sellingPrice) * item.sellQuantity), 0);

  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = (subtotal * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }
  }

  const total = subtotal - discountAmount;

  React.useEffect(() => {
    if (isOpen) {
      setPaymentMethod('');
      setInitialPaymentMethod('Cash');
      setAmountPaid(total);
      setPaymentTab('pay-now');
      setSelectedBookingId(customer?.id || '');
      setRoomSearchTerm('');
    }
  }, [isOpen, total, customer?.id]);

  React.useEffect(() => {
    if (!allowBillToRoom) return;
    if (paymentTab === 'bill-to-room') {
      setPaymentMethod('Bill to Room');
    } else if (paymentMethod === 'Bill to Room') {
      setPaymentMethod('');
    }
  }, [paymentTab, paymentMethod, allowBillToRoom]);

  React.useEffect(() => {
    if (paymentMethod === 'Credit') {
      setAmountPaid(0);
    } else if (paymentMethod && paymentMethod !== 'Bill to Room') {
      setAmountPaid(total);
    }
  }, [paymentMethod, total]);

  const change = amountPaid - total;

  const handleConfirm = async () => {
    if (!paymentMethod) {
      toast({ variant: 'destructive', title: 'Payment method required' });
      return;
    }

    if (paymentMethod === 'Credit' && (!customer || !customer.id)) {
      toast({ variant: 'destructive', title: 'Customer Required', description: "Please select an existing customer to process a credit sale." });
      return;
    }

    if (paymentMethod === 'Credit') {
        const initialPayment = amountPaid > 0 ? amountPaid : undefined;
        await onConfirm(total, paymentMethod, 'Credit', initialPayment, initialPayment ? initialPaymentMethod : undefined);
    } else if (paymentMethod === 'Bill to Room') {
        if (!selectedBookingId) {
          toast({ variant: 'destructive', title: 'Room selection required', description: 'Please select a checked-in room to bill.' });
          return;
        }
        await onConfirm(total, paymentMethod, 'Unpaid', undefined, undefined, selectedBookingId);
    } else {
        if (amountPaid < total) {
            toast({ variant: 'destructive', title: 'Insufficient Payment' });
            return;
        }
        await onConfirm(total, paymentMethod, 'Paid');
    }
  };

  const formatCurrency = (value: number) => {
    const currency = settings?.currency || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const paymentAmountNumber = parseFloat(String(amountPaid)) || 0;
  const newBalance = paymentMethod === 'Credit' ? total - paymentAmountNumber : 0;

  const filteredBookings = React.useMemo(() => {
    if (!activeBookings) return [];
    const normalizedSearch = roomSearchTerm.trim().toLowerCase();
    const sortedBookings = [...activeBookings].sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''));
    if (!normalizedSearch) return sortedBookings;
    return sortedBookings.filter(booking => {
      const roomMatch = booking.roomNumber?.toLowerCase().includes(normalizedSearch);
      const guestMatch = booking.guestName?.toLowerCase().includes(normalizedSearch);
      return roomMatch || guestMatch;
    });
  }, [activeBookings, roomSearchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>Total amount due is {formatCurrency(total)}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
          <div className="p-3 rounded-md border bg-muted space-y-1 text-sm">
             <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
            </div>
             {discountAmount > 0 && (
                <div className="flex justify-between text-destructive">
                    <span>Discount ({discount?.type === 'percentage' ? `${discount.value}%` : 'Fixed'}):</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                </div>
            )}
             <Separator />
            <div className="flex justify-between font-bold text-lg">
                <span>Total Due:</span>
                <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {allowBillToRoom ? (
            <Tabs value={paymentTab} onValueChange={(value) => setPaymentTab(value as 'pay-now' | 'bill-to-room')}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="pay-now">Pay Now</TabsTrigger>
                <TabsTrigger value="bill-to-room">Bill to Room</TabsTrigger>
              </TabsList>
              <TabsContent value="pay-now" className="space-y-4">
                <Select onValueChange={setPaymentMethod} value={paymentMethod}>
                  <SelectTrigger>
                      <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select Payment Method" />
                      </div>
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods?.map((method: any) => (
                      <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                    ))}
                    <SelectItem value="Credit">On Credit</SelectItem>
                  </SelectContent>
                </Select>

                {paymentMethod !== 'Credit' && paymentMethod !== 'Bill to Room' ? (
                    <div className="space-y-2">
                      <Label htmlFor="amount-paid">Amount Paid</Label>
                      <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="amount-paid" type="number" value={amountPaid} onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} className="pl-8" />
                      </div>
                    </div>
                ) : paymentMethod === 'Credit' ? (
                  <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="initial-payment">Initial Payment (Optional)</Label>
                        <Input id="initial-payment" type="number" value={amountPaid} placeholder="Enter any initial payment amount" onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} />
                    </div>
                    {amountPaid > 0 && (
                          <Select onValueChange={setInitialPaymentMethod} value={initialPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue placeholder="Initial Payment Method" />
                            </SelectTrigger>
                            <SelectContent>
                                {paymentMethods?.map((method: any) => (
                                  <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                              ))}
                            </SelectContent>
                        </Select>
                    )}
                  </div>
                ) : null}
              </TabsContent>
              <TabsContent value="bill-to-room" className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Select a checked-in room to add these items to the guest folio. The bill will remain unpaid until settled at checkout.
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by room or guest name"
                    value={roomSearchTerm}
                    onChange={(event) => setRoomSearchTerm(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-56 rounded-md border">
                  {filteredBookings.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {roomSearchTerm ? 'No matching active rooms found.' : 'No active check-ins available to bill.'}
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      {filteredBookings.map((booking) => {
                        const isSelected = selectedBookingId === booking.id;
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => setSelectedBookingId(booking.id)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors',
                              isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                            )}
                          >
                            <div>
                              <p className="font-medium">Room {booking.roomNumber}</p>
                              <p className="text-xs text-muted-foreground">{booking.guestName}</p>
                            </div>
                            <Badge variant={isSelected ? 'default' : 'secondary'}>{booking.status}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <Select onValueChange={setPaymentMethod} value={paymentMethod}>
                <SelectTrigger>
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Select Payment Method" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((method: any) => (
                    <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                  ))}
                  <SelectItem value="Credit">On Credit</SelectItem>
                </SelectContent>
              </Select>

              {paymentMethod !== 'Credit' && paymentMethod !== 'Bill to Room' ? (
                  <div className="space-y-2">
                    <Label htmlFor="amount-paid">Amount Paid</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amount-paid" type="number" value={amountPaid} onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} className="pl-8" />
                    </div>
                  </div>
              ) : paymentMethod === 'Credit' ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="initial-payment">Initial Payment (Optional)</Label>
                      <Input id="initial-payment" type="number" value={amountPaid} placeholder="Enter any initial payment amount" onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} />
                  </div>
                  {amountPaid > 0 && (
                        <Select onValueChange={setInitialPaymentMethod} value={initialPaymentMethod}>
                          <SelectTrigger>
                              <SelectValue placeholder="Initial Payment Method" />
                          </SelectTrigger>
                          <SelectContent>
                              {paymentMethods?.map((method: any) => (
                                <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                            ))}
                          </SelectContent>
                      </Select>
                  )}
                </div>
              ) : null}
            </>
          )}

          {change > 0 && paymentMethod !== 'Credit' && paymentMethod !== 'Bill to Room' && (
            <div className="p-4 rounded-md bg-blue-100 text-blue-800 text-center font-semibold">
              Change Due: {formatCurrency(change)}
            </div>
          )}

          {paymentMethod === 'Credit' && (
            <div className="p-4 rounded-md bg-yellow-100 text-yellow-800 text-center font-semibold">
              New Credit Balance: {formatCurrency(newBalance)}
            </div>
          )}
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            loading={isProcessing}
            disabled={isProcessing || !paymentMethod || (paymentMethod === 'Bill to Room' && !selectedBookingId)}
          >
            <CheckCircle className="mr-2 h-4 w-4" /> Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
