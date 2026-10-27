'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Payment } from '@/lib/types';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import {
  Bed,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  CreditCard,
  FileText,
} from 'lucide-react';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';

interface ViewPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: (Payment & { outstandingBalance?: number }) | null;
  currency: string;
}

const DetailItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-4">
    <Icon className="mt-1 h-5 w-5 text-muted-foreground" />
    <div className="flex flex-col">
      <span className="text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-semibold text-foreground">{value}</span>
    </div>
  </div>
);

export function ViewPaymentDialog({
  isOpen,
  onClose,
  payment,
  currency,
}: ViewPaymentDialogProps) {
  if (!payment) return null;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(payment.amount);

  const outstandingBalanceFormatted = payment.outstandingBalance !== undefined ? new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(payment.outstandingBalance) : 'N/A';


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Payment Details</DialogTitle>
          <DialogDescription>
            Transaction ID: {payment.id.substring(0, 10)}...
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center gap-4">
             <Avatar className="h-16 w-16">
                <AvatarImage src={payment.guestPhotoURL} alt={payment.guestName} />
                <AvatarFallback className="text-xl">{getInitials(payment.guestName || 'G')}</AvatarFallback>
            </Avatar>
            <div>
                 <h3 className="text-xl font-bold">{payment.guestName}</h3>
                 <p className="text-sm text-muted-foreground">{payment.guestEmail}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DetailItem
              icon={DollarSign}
              label="Amount"
              value={formattedAmount}
            />
            <DetailItem
              icon={CreditCard}
              label="Payment Method"
              value={payment.paymentMethod}
            />
            <DetailItem
              icon={Calendar}
              label="Transaction Date"
              value={format(payment.transactionDate, 'PPP')}
            />
            <DetailItem
              icon={FileText}
              label="Booking Status"
              value={<Badge variant={payment.status === 'Active' || payment.status === 'Checked-in' ? 'success' : 'secondary'}>{payment.status}</Badge>}
            />
            <DetailItem
              icon={Bed}
              label="Room"
              value={`#${payment.roomNumber}`}
            />
             <DetailItem
              icon={Phone}
              label="Phone"
              value={payment.bookingDetails?.guestPhoneNumber || 'N/A'}
            />
             {payment.outstandingBalance !== undefined && (
                <DetailItem
                  icon={DollarSign}
                  label="Outstanding Balance"
                  value={outstandingBalanceFormatted}
                />
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
