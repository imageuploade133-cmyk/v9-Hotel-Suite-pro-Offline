
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
import type { SalaryDeduction } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';


interface DocketReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  docket: SalaryDeduction | null;
}

export function DocketReceiptDialog({
  isOpen,
  onClose,
  docket,
}: DocketReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const { settings } = useSettings();
  const { currentBranch } = useBranch();

  const currency = settings?.currency || 'USD';
  const logoSize = settings?.businessLogoSize || 48;
  // Use branch logo if available, otherwise fall back to settings logo
  const logoUrl = currentBranch?.logoUrl || settings?.businessLogoUrl;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handlePrint = () => {
    const content = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (content) {
        document.body.classList.add('print-container');
        window.print();
    }
  };

  if (!docket) return null;

  const safeDocketDate = getSafeDate(docket.date);
  const footerLine1 = settings?.deductionReceiptFooter || 'This is an official receipt for salary advance/deduction.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Deduction/Advance Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the recorded salary deduction.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoice">Professional Receipt</TabsTrigger>
            <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
          </TabsList>

          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="invoice">
              <div ref={invoiceRef} className="print-content p-8 bg-white text-black text-sm rounded-lg">
                <header className="flex justify-between items-start mb-8">
                  <div>
                    {logoUrl ? (
                      <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} />
                    ) : (
                      <Logo className="h-10 w-10 text-slate-800" />
                    )}
                  </div>
                  <div className="text-right">
                    <h1 className="font-bold text-xl text-slate-800">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                    <p className="text-slate-500 text-xs">{settings?.businessAddress}</p>
                    <p className="text-slate-500 text-xs">{settings?.businessPhone}</p>
                  </div>
                </header>
                <Separator className="my-4" />
                <div className="flex justify-between items-center mb-8">
                  <div className="text-left">
                    <h2 className="font-bold text-2xl uppercase text-slate-800">{settings?.deductionReceiptTitle || 'Salary Deduction'}</h2>
                    <p className="text-slate-500">Receipt ID: {docket.id.substring(0, 8)}</p>
                    <p className="text-slate-500">Date: {safeDocketDate ? format(safeDocketDate, 'PPpp') : 'N/A'}</p>
                  </div>
                </div>

                <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                        <tr>
                            <th className="p-3">Staff Member</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-100">
                            <td className="p-3 font-semibold">{docket.userName}</td>
                            <td className="p-3">Salary Advance / Deduction</td>
                            <td className="p-3 text-right">{formatCurrency(docket.amount)}</td>
                        </tr>
                    </tbody>
                </table>

                <Separator className="my-6" />

                 <div className="text-sm space-y-1">
                  <p><b>Notes:</b> {docket.notes || 'N/A'}</p>
                  <p><b>Processed by:</b> {docket.processedBy}</p>
                </div>

                <div className="mt-12 text-center text-xs text-slate-500">
                  <p>{footerLine1}</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="terminal">
              <div ref={terminalRef} className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                <div className="text-center space-y-1 mb-4">
                  {logoUrl && (
                    <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />
                  )}
                  <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                  <p className="text-xs">{settings?.businessAddress}</p>
                </div>
                <div className="text-center text-xs mb-4">
                  <p>Date: {safeDocketDate ? format(safeDocketDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                  <p>ID: {docket.id.substring(0, 8)}</p>
                  <p>Processed By: {docket.processedBy}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2">{settings?.deductionReceiptTitle || 'Salary Deduction'}</p>
                <div className="space-y-1 border-y border-dashed border-black py-2">
                    <div className="flex justify-between">
                        <span>Staff:</span>
                        <span>{docket.userName}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Amount:</span>
                        <span>{formatCurrency(docket.amount)}</span>
                    </div>
                </div>
                {docket.notes && <p className="text-xs text-center my-2">Notes: {docket.notes}</p>}
                <div className="text-center text-xs mt-6">
                  <p>{footerLine1}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
          <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
