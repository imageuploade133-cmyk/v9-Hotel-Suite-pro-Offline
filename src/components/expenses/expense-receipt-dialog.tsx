'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '../ui/separator';
import type { Expense } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';

interface ExpenseReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
}

export function ExpenseReceiptDialog({ isOpen, onClose, expense }: ExpenseReceiptDialogProps) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const { currentBranch } = useBranch();
  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;
  // Use branch logo if available, otherwise fall back to settings logo
  const logoUrl = currentBranch?.logoUrl || settings?.businessLogoUrl;
  const useHDPrinting = settings?.useHDPrinting ?? true;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (printContent) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Expense Receipt</title>');
        if (useHDPrinting) {
          printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        }
        printWindow.document.write('<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  if (!expense) return null;

  const expenseDate = getSafeDate(expense.date);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Expense Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the recorded business expense.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
          <div ref={receiptRef} className="p-4 bg-white text-black receipt text-sm">
            <div className="text-center space-y-1 mb-4">
              {logoUrl && (
                  <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} className="mx-auto" />
              )}
              <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
              <p className="font-bold uppercase">Expense Receipt</p>
            </div>

            <Separator className="my-2 border-dashed border-black"/>

            <div className="text-xs mb-2 space-y-0.5">
                <div className="flex justify-between">
                    <span>Receipt ID:</span>
                    <span className="font-bold">#{expense.id.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{expenseDate ? format(expenseDate, 'MM/dd/yyyy HH:mm') : 'N/A'}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Processed By:</span>
                    <span className="font-bold">{expense.staffName}</span>
                </div>
            </div>

            <Separator className="my-2 border-dashed border-black"/>

            <p className="font-bold uppercase text-xs mb-1">Details</p>
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span>Description:</span>
                    <span className="font-semibold text-right">{expense.description}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-semibold">{expense.category}</span>
                </div>
            </div>

            <Separator className="my-2 border-dashed border-black"/>

            <div className="text-right font-bold text-lg space-y-1">
                <div className="flex justify-between">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(expense.amount)}</span>
                </div>
                 <div className="flex justify-between text-base">
                    <span>METHOD:</span>
                    <span>{expense.paymentMethod}</span>
                </div>
            </div>

             <div className="text-center text-xs mt-6">
                <p>This is a computer-generated document for record-keeping.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex-row pt-4">
            <Button variant="ghost" onClick={onClose}>
                <X className="mr-2 h-4 w-4" /> Close
            </Button>
            <Button onClick={() => handlePrint()}>
                <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
