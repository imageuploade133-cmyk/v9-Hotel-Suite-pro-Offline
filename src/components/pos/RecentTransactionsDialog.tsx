
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { HistorySection } from './HistorySection';
import { History, Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';

interface RecentTransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecentTransactionsDialog({ isOpen, onOpenChange }: RecentTransactionsDialogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col min-h-0 sm:max-w-6xl sm:h-[88vh] sm:max-h-[56rem] p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <span>Recent Transactions</span>
          </DialogTitle>
          <DialogDescription>
            A log of recent sales and refunds processed through the POS.
          </DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0 my-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or Sale ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2">
          <HistorySection searchTerm={searchTerm} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
