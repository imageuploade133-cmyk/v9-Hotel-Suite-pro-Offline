
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
import { AiChat } from '../ai/ai-chat';
import { useFirestore } from '@/firebase';


interface MyHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (booking: Booking) => void;
}

export function MyHistoryDialog({ isOpen, onClose, onViewDetails }: MyHistoryDialogProps) {

  const content = (
      <div className="flex-1 min-h-0 -mx-6">
          <ScrollArea className="h-full px-6">
            <MyHistory onViewDetails={onViewDetails} />
          </ScrollArea>
        </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none rounded-none border-0 flex flex-col">
        <DialogHeader>
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
