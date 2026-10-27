'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Booking } from '@/lib/types';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';

interface MarkAsPaidDialogProps {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking | null;
    onConfirm: (booking: Booking, paymentMethod: string) => Promise<void>;
}

export function MarkAsPaidDialog({ isOpen, onClose, booking, onConfirm }: MarkAsPaidDialogProps) {
    const [paymentMethod, setPaymentMethod] = React.useState('Cash');
    const [isConfirming, setIsConfirming] = React.useState(false);
    const { toast } = useToast();

    if (!booking) return null;

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirm(booking, paymentMethod);
            onClose();
        } catch (error) {
            // error handled in parent
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mark Reservation as Paid</DialogTitle>
                    <DialogDescription>
                        Confirm payment for {booking.guestName}'s reservation in Room {booking.roomNumber}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <p>Amount Due: <strong>${booking.amount.toFixed(2)}</strong></p>
                    <div className="space-y-2">
                        <Label htmlFor="payment-method-paid">Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger id="payment-method-paid">
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="Card">Card</SelectItem>
                                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isConfirming}>Cancel</Button>
                    <Button onClick={handleConfirm} loading={isConfirming}>
                        Confirm Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}