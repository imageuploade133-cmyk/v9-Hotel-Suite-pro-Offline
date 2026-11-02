
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
import { ScrollArea } from '../ui/scroll-area';


interface MyHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (booking: Booking) => void;
}

export function MyHistoryDialog({ isOpen, onClose, onViewDetails }: MyHistoryDialogProps) {

  const content = (
      <div className="min-h-0 min-w-0 flex-1 -mx-4 overflow-hidden sm:-mx-6">
          <ScrollArea className="h-full px-4 sm:px-6">
            <MyHistory onViewDetails={onViewDetails} />
          </ScrollArea>
        </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-h-0 overflow-hidden sm:max-h-[min(90dvh,52rem)] sm:max-w-6xl">
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
