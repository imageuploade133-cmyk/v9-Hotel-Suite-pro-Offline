
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Booking, Bill, BillItem, Payment } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useSettings } from '@/contexts/settings-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { CircleDollarSign, CreditCard } from 'lucide-react';


interface FullBillItem extends BillItem {
    billId: string;
}

interface PayBillsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirm: (booking: Booking, paymentMethod: string, items: FullBillItem[], customAmount?: number) => Promise<void>;
}

export function PayBillsDialog({ isOpen, onClose, booking, onConfirm }: PayBillsDialogProps) {
    const { settings } = useSettings();
    const [isSaving, setIsSaving] = React.useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<
        string | undefined
    >();
    const [selectedItems, setSelectedItems] = React.useState<FullBillItem[]>([]);
    const [isCustomAmount, setIsCustomAmount] = React.useState(false);
    const [customAmount, setCustomAmount] = React.useState<string>('');

    const firestore = useFirestore();

    const paymentMethodsQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'paymentMethods'));
    }, [firestore]);
    const { data: paymentMethods } = useCollection(paymentMethodsQuery);

    const billsQuery = React.useMemo(() => {
        if (!firestore || !booking) return null;
        return query(
            collection(firestore, `bookings/${booking.id}/bills`),
            orderBy('createdAt', 'asc')
        );
    }, [firestore, booking]);
    const { data: bills, isLoading: areBillsLoading } = useCollection<Bill>(
        billsQuery
    );

    const { allUnpaidItems, totalBill, totalPaid } = React.useMemo(() => {
        if (!booking) return { allUnpaidItems: [], totalBill: 0, totalPaid: 0 };

        let unpaidItems: FullBillItem[] = [];

        // Add unpaid items from other bills
        if (bills) {
            unpaidItems.push(...bills.flatMap(bill =>
                bill.items.filter(item => !item.paid).map(item => ({ ...item, billId: bill.id }))
            ));
        }

        const additionalChargesTotal = (bills || []).reduce((acc, bill) => acc + bill.total, 0);

        const totalPaymentsForBills = (bills || [])
        .filter(b => b.paid)
        .reduce((acc, bill) => acc + bill.total, 0);

        return { allUnpaidItems: unpaidItems, totalBill: additionalChargesTotal, totalPaid: totalPaymentsForBills };
    }, [bills, booking]);

    const balanceDue = totalBill - totalPaid;

    const selectedItemsTotal = selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const paymentAmount = isCustomAmount ? parseFloat(customAmount) || 0 : selectedItemsTotal;

    React.useEffect(() => {
        if (isOpen) {
            setSelectedPaymentMethod(undefined);
            setIsCustomAmount(false);
            setCustomAmount('');
            setIsSaving(false);
            // Initially select all unpaid items
            setSelectedItems(allUnpaidItems);
        }
    }, [isOpen, allUnpaidItems]);

    const handleItemSelect = (item: FullBillItem, checked: boolean | 'indeterminate') => {
        if (checked) {
            setSelectedItems(prev => [...prev, item]);
        } else {
            setSelectedItems(prev => prev.filter(i => !(i.id === item.id && i.billId === item.billId)));
        }
        setIsCustomAmount(false);
    };

    const handleSelectAll = () => {
        if (selectedItems.length === allUnpaidItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(allUnpaidItems);
        }
        setIsCustomAmount(false);
    };

    const handleConfirm = async () => {
        if (!booking || !selectedPaymentMethod) return;

        setIsSaving(true);
        try {
        await onConfirm(booking, selectedPaymentMethod, selectedItems, isCustomAmount ? paymentAmount : undefined);
        } catch (error) {
        console.error("Payment failed:", error);
        } finally {
        setIsSaving(false);
        }
    };

    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        }).format(value);

    if (!booking) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Pay Outstanding Bills for {booking?.guestName}</DialogTitle>
                    <DialogDescription>
                        Settle unpaid bills for Room {booking?.roomNumber}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <h4 className="font-semibold text-sm">Unpaid Items:</h4>
                    <ScrollArea className="h-48 rounded-md border p-4">
                        <div className="space-y-3">
                            {areBillsLoading ? <p>Loading bills...</p> : (
                            allUnpaidItems.length > 0 ? (
                                allUnpaidItems.map((item, index) => (
                                    <div key={`${item.billId}-${item.id}-${index}`} className="flex items-center gap-3">
                                        <Checkbox
                                            id={`${item.billId}-${item.id}-${index}`}
                                            checked={selectedItems.some(i => i.id === item.id && i.billId === item.billId)}
                                            onCheckedChange={(checked) => handleItemSelect(item, checked)}
                                        />
                                        <Label htmlFor={`${item.billId}-${item.id}-${index}`} className="flex-1 flex justify-between items-center cursor-pointer">
                                            <span>{item.name} (x{item.quantity})</span>
                                            <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                                        </Label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-10">No outstanding bills.</p>
                            )
                            )}
                        </div>
                    </ScrollArea>
                    {allUnpaidItems.length > 0 && (
                        <Button variant="link" size="sm" onClick={handleSelectAll} className="p-0 h-auto">
                            {selectedItems.length === allUnpaidItems.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    )}

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="custom-amount-switch">Pay a custom amount instead?</Label>
                            <Switch
                                id="custom-amount-switch"
                                checked={isCustomAmount}
                                onCheckedChange={(checked) => {
                                    setIsCustomAmount(checked);
                                    if (checked) {
                                        setSelectedItems([]);
                                    } else {
                                        setSelectedItems(allUnpaidItems);
                                    }
                                }}
                            />
                        </div>
                        {isCustomAmount && (
                            <Input
                                type="number"
                                placeholder="Enter amount to pay"
                                value={customAmount}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                step="0.01"
                            />
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-3 rounded-md border p-4">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-muted-foreground">Total Additional Charges:</span>
                            <span>{formatCurrency(totalBill)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-muted-foreground">Total Paid (for extras):</span>
                            <span className="text-green-600">{formatCurrency(totalPaid)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total Outstanding:</span>
                            <span>{formatCurrency(balanceDue)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold text-primary">
                            <span>Paying Now:</span>
                            <span>{formatCurrency(paymentAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-muted-foreground">Remaining Balance:</span>
                            <span className="font-semibold">{formatCurrency(balanceDue - paymentAmount)}</span>
                        </div>
                    </div>

                    <Select
                        onValueChange={setSelectedPaymentMethod}
                        value={selectedPaymentMethod}
                        disabled={isSaving}
                    >
                        <SelectTrigger>
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select a payment method" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethods?.map((method: any) => (
                                <SelectItem key={method.id} value={method.name}>
                                    {method.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter>
                <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={isSaving || !selectedPaymentMethod || paymentAmount <= 0 || paymentAmount > balanceDue}
                    loading={isSaving}
                >
                    <CircleDollarSign className="mr-2 h-4 w-4" />
                    Confirm Payment ({formatCurrency(paymentAmount)})
                </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

