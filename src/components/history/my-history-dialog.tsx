
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MyHistory } from './my-history';
import type { Booking } from '@/lib/types';


interface MyHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (booking: Booking) => void;
}

export function MyHistoryDialog({ isOpen, onClose, onViewDetails }: MyHistoryDialogProps) {

  const content = (
      <div className="min-h-0 min-w-0 flex-1 -mx-3 overflow-hidden sm:-mx-6">
        <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-3 sm:px-6">
          <MyHistory onViewDetails={onViewDetails} />
        </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mobile-fullscreen-dialog laundry-mobile-drawer flex h-[100dvh] w-screen max-h-none max-w-none flex-col overflow-hidden rounded-none p-3 sm:h-auto sm:max-h-[min(90dvh,52rem)] sm:max-w-6xl sm:rounded-lg sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>My History</DialogTitle>
          <DialogDescription>
            A record of all the bookings and actions you have personally processed.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
