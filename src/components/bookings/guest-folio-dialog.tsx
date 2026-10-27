
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { Booking, Bill, Payment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { GuestBillDialog } from './guest-bill-dialog';
import { X } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface GuestFolioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  allBills: Bill[] | null;
  allPayments: Payment[] | null;
  isLoading: boolean;
  onViewImage: (url: string) => void;
  onBillPrinted?: () => void;
}

export function GuestFolioDialog({
  isOpen,
  onClose,
  booking,
  allBills,
  allPayments,
  isLoading,
  onViewImage,
  onBillPrinted,
}: GuestFolioDialogProps) {

  if (!booking) {
    return null;
  }

  return (
    <GuestBillDialog
      isOpen={isOpen}
      onClose={onClose}
      booking={booking}
      allBills={allBills}
      allPayments={allPayments}
      isLoading={isLoading}
      onViewImage={onViewImage}
      onBillPrinted={onBillPrinted}
    />
  );
}
