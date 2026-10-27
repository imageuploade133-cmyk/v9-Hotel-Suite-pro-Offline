
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
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-6 w-6" />
            Recent Transactions
          </DialogTitle>
          <DialogDescription>
            A log of the most recent sales processed through the POS.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or Sale ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex-1 overflow-auto -mx-6 px-6">
          <HistorySection searchTerm={searchTerm} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
