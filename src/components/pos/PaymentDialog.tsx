
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, documentId, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import type { Booking, Customer, UnifiedItem } from '@/lib/types';
import { DollarSign, CreditCard, CheckCircle, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: UnifiedItem[];
  activeRunningItems?: UnifiedItem[];
  customer: Partial<Customer> | null;
  onConfirm: (total: number, paymentMethod: string, paymentStatus: 'Paid' | 'Credit' | 'Unpaid', initialPaymentAmount?: number, initialPaymentMethod?: string, billToRoomBookingId?: string, applyExcessToOutstanding?: boolean, totalTenderedAmount?: number) => Promise<void>;
  isProcessing: boolean;
  discount: { type: 'percentage' | 'amount'; value: number } | null;
  allowBillToRoom?: boolean;
  canCreateCreditSales?: boolean;
  startInCreditMode?: boolean;
}

export function PaymentDialog({ isOpen, onClose, cart, activeRunningItems = [], customer, onConfirm, isProcessing, discount, allowBillToRoom = false, canCreateCreditSales = false, startInCreditMode = false }: PaymentDialogProps) {
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = React.useState(startInCreditMode ? 'Credit' : '');
  const [amountPaid, setAmountPaid] = React.useState<number>(0);
  const [initialPaymentMethod, setInitialPaymentMethod] = React.useState<string>('Cash');
  const [paymentTab, setPaymentTab] = React.useState<'pay-now' | 'bill-to-room'>('pay-now');
  const [selectedBookingId, setSelectedBookingId] = React.useState<string>('');
  const [roomSearchTerm, setRoomSearchTerm] = React.useState('');
  const [roomPageIndex, setRoomPageIndex] = React.useState(0);
  const [roomPageCursors, setRoomPageCursors] = React.useState<string[]>([]);
  const ROOM_PAGE_SIZE = 10;
  const [showExcessDecision, setShowExcessDecision] = React.useState(false);

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const activeBookingsQuery = React.useMemo(() => {
    if (!firestore || !allowBillToRoom) return null;
    const bookings = collection(firestore, 'bookings');
    const activeStatus = where('status', 'in', ['Active', 'Checked-in']);

    // Normal browsing reads one small page. An explicit search retains the
    // previous full-list substring matching behaviour.
    if (roomSearchTerm.trim()) {
      return query(bookings, activeStatus);
    }

    const cursor = roomPageCursors[roomPageIndex];
    return cursor
      ? query(bookings, activeStatus, orderBy(documentId()), startAfter(cursor), limit(ROOM_PAGE_SIZE + 1))
      : query(bookings, activeStatus, orderBy(documentId()), limit(ROOM_PAGE_SIZE + 1));
  }, [firestore, allowBillToRoom, roomSearchTerm, roomPageCursors, roomPageIndex]);
  const { data: activeBookings, isLoading: areActiveBookingsLoading, error: activeBookingsError } = useCollection<Booking>(activeBookingsQuery);

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
      setPaymentMethod(startInCreditMode ? 'Credit' : '');
      setInitialPaymentMethod('Cash');
      setAmountPaid(startInCreditMode ? 0 : total);
      setPaymentTab('pay-now');
      setSelectedBookingId(customer?.id || '');
      setRoomSearchTerm('');
      setRoomPageIndex(0);
      setRoomPageCursors([]);
    }
  }, [isOpen, total, customer?.id, startInCreditMode]);

  React.useEffect(() => {
    if (!allowBillToRoom || startInCreditMode) return;
    if (paymentTab === 'bill-to-room') {
      setPaymentMethod('Bill to Room');
    } else if (paymentMethod === 'Bill to Room') {
      setPaymentMethod('');
    }
  }, [paymentTab, paymentMethod, allowBillToRoom, startInCreditMode]);

  React.useEffect(() => {
    if (paymentMethod === 'Credit') {
      setAmountPaid(0);
    } else if (paymentMethod && paymentMethod !== 'Bill to Room') {
      setAmountPaid(total);
    }
  }, [paymentMethod, total]);

  const change = Math.max(0, amountPaid - total);
  const customerOutstandingBalance = Math.max(0, Number(customer?.outstandingBalance) || 0);
  const excessAvailableForOldBalance = Math.min(change, customerOutstandingBalance);
  const saleInitialPayment = Math.min(Math.max(0, amountPaid), total);

  const completeCreditSale = async (applyExcessToOutstanding: boolean) => {
    setShowExcessDecision(false);
    await onConfirm(total, 'Credit', 'Credit', saleInitialPayment > 0 ? saleInitialPayment : undefined, saleInitialPayment > 0 ? initialPaymentMethod : undefined, undefined, applyExcessToOutstanding, amountPaid);
  };

  const handlePaymentMethodChange = (value: string) => {
    if (value === 'Credit' && !canCreateCreditSales) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to create credit sales. Please contact your administrator.' });
      setPaymentMethod('');
      return;
    }
    setPaymentMethod(value);
  };

  const handleConfirm = async () => {
    if (paymentMethod === 'Credit' && !canCreateCreditSales) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to create credit sales.' });
      return;
    }
    if (!paymentMethod) {
      toast({ variant: 'destructive', title: 'Payment method required' });
      return;
    }

    if (paymentMethod === 'Credit' && (!customer || !customer.id)) {
      toast({ variant: 'destructive', title: 'Customer Required', description: "Please select an existing customer to process a credit sale." });
      return;
    }

    if (paymentMethod === 'Credit') {
        if (!Number.isFinite(amountPaid) || amountPaid < 0) {
          toast({ variant: 'destructive', title: 'Invalid Initial Payment', description: 'Enter a valid payment amount greater than or equal to zero.' });
          return;
        }
        if (amountPaid > total) {
          setShowExcessDecision(true);
          return;
        }
        await completeCreditSale(false);
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
  const newBalance = paymentMethod === 'Credit' ? Math.max(0, total - Math.min(total, paymentAmountNumber)) : 0;

  const hasRoomSearch = !!roomSearchTerm.trim();
  const hasNextRoomPage = !hasRoomSearch && (activeBookings?.length || 0) > ROOM_PAGE_SIZE;
  const visibleRoomPage = React.useMemo(
    () => (activeBookings || []).slice(0, ROOM_PAGE_SIZE),
    [activeBookings]
  );
  const filteredBookings = React.useMemo(() => {
    if (!activeBookings) return [];
    const normalizedSearch = roomSearchTerm.trim().toLowerCase();
    const sourceBookings = hasRoomSearch ? activeBookings : visibleRoomPage;
    const sortedBookings = [...sourceBookings].sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''));
    if (!normalizedSearch) return sortedBookings;
    return sortedBookings.filter(booking => {
      const roomMatch = booking.roomNumber?.toLowerCase().includes(normalizedSearch);
      const guestMatch = booking.guestName?.toLowerCase().includes(normalizedSearch);
      return roomMatch || guestMatch;
    });
  }, [activeBookings, visibleRoomPage, roomSearchTerm, hasRoomSearch]);

  const goToNextRoomPage = () => {
    const lastVisibleBooking = visibleRoomPage[visibleRoomPage.length - 1];
    if (!lastVisibleBooking?.id || !hasNextRoomPage) return;
    setRoomPageCursors(current => {
      const next = [...current];
      next[roomPageIndex + 1] = lastVisibleBooking.id;
      return next;
    });
    setRoomPageIndex(current => current + 1);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("mobile-fullscreen-dialog flex min-h-0 flex-col overflow-hidden p-0 gap-0", allowBillToRoom ? "h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none" : "max-h-[90vh] w-[95vw] max-w-2xl")}>
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{paymentMethod === 'Credit' ? 'Complete Credit Sale' : 'Process Payment'}</DialogTitle>
          <DialogDescription>Total amount due is {formatCurrency(total)}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <div className="flex min-h-full flex-col space-y-4 px-6 py-4">
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

          {allowBillToRoom && !startInCreditMode ? (
            <Tabs value={paymentTab} onValueChange={(value) => setPaymentTab(value as 'pay-now' | 'bill-to-room')} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="pay-now">Pay Now</TabsTrigger>
                <TabsTrigger value="bill-to-room">Bill to Room</TabsTrigger>
              </TabsList>
              <TabsContent value="pay-now" className="space-y-4">
                {!startInCreditMode && paymentMethod !== 'Credit' ? (
                  <Select onValueChange={handlePaymentMethodChange} value={paymentMethod}>
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
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">Credit sale for {customer?.name || 'selected customer'}</p>
                    <p className="mt-1 text-xs">The unpaid amount will be added to this customer’s credit balance.</p>
                  </div>
                )}

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
                        <Input id="initial-payment" type="number" min="0" step="0.01" value={amountPaid} placeholder="Enter amount received from customer" onChange={(e) => setAmountPaid(e.target.value === "" ? 0 : Number(e.target.value))} />
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
              <TabsContent value="bill-to-room" className="mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden data-[state=inactive]:hidden">
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
                <ScrollArea className="min-h-[160px] flex-1 rounded-md border">
                  {activeBookingsError ? (
                    <div className="p-6 text-center text-sm text-destructive">Unable to load active rooms. Please try again.</div>
                  ) : areActiveBookingsLoading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Loading active rooms…</div>
                  ) : filteredBookings.length === 0 ? (
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
                {!hasRoomSearch && (
                  <div className="flex shrink-0 items-center justify-between gap-3 border-t pt-3">
                    <span className="text-xs text-muted-foreground">Page {roomPageIndex + 1} · Showing up to {ROOM_PAGE_SIZE} rooms</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={roomPageIndex === 0 || areActiveBookingsLoading} onClick={() => setRoomPageIndex(current => Math.max(0, current - 1))}>Previous</Button>
                      <Button type="button" size="sm" variant="outline" disabled={!hasNextRoomPage || areActiveBookingsLoading} onClick={goToNextRoomPage}>Next</Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {!startInCreditMode && paymentMethod !== 'Credit' ? (
                  <Select onValueChange={handlePaymentMethodChange} value={paymentMethod}>
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
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-semibold">Credit sale for {customer?.name || 'selected customer'}</p>
                  <p className="mt-1 text-xs">The unpaid amount will be added to this customer’s credit balance.</p>
                </div>
              )}

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
                      <Input id="initial-payment" type="number" min="0" step="0.01" value={amountPaid} placeholder="Enter amount received from customer" onChange={(e) => setAmountPaid(e.target.value === "" ? 0 : Number(e.target.value))} />
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
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex justify-between gap-3"><span>Amount applied to this sale</span><strong>{formatCurrency(saleInitialPayment)}</strong></div>
              <div className="flex justify-between gap-3"><span>Outstanding on this sale</span><strong>{formatCurrency(newBalance)}</strong></div>
              {change > 0 && <div className="flex justify-between gap-3 border-t border-amber-300 pt-2"><span>Excess available</span><strong>{formatCurrency(change)}</strong></div>}
              {customerOutstandingBalance > 0 && <p className="text-xs text-amber-800 dark:text-amber-200">Previous outstanding credit: {formatCurrency(customerOutstandingBalance)}. Any excess can be applied to this balance.</p>}
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
    <AlertDialog open={showExcessDecision} onOpenChange={setShowExcessDecision}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{customerOutstandingBalance > 0 ? 'Use the excess to pay previous balance?' : 'Save the excess as customer advance credit?'}</AlertDialogTitle>
          <AlertDialogDescription>
            Amount received: {formatCurrency(amountPaid)}. New sale total: {formatCurrency(total)}.
            Excess available: {formatCurrency(change)}. Existing customer balance: {formatCurrency(customerOutstandingBalance)}.
            {customerOutstandingBalance > 0
              ? <>Apply {formatCurrency(excessAvailableForOldBalance)} to the previous balance? Any excess remaining after settling it will be returned to the customer as change.</>
              : <>Would you like to save {formatCurrency(change)} as advance credit for this customer? It will be available to settle a future credit sale.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing} onClick={() => completeCreditSale(false)}>No, give as change</AlertDialogCancel>
          <AlertDialogAction disabled={isProcessing} onClick={(event) => { event.preventDefault(); completeCreditSale(true); }}>
            {customerOutstandingBalance > 0 ? 'Yes, pay outstanding balance' : 'Yes, save as advance credit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
