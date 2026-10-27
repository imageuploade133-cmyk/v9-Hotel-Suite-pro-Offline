
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
import type { Transfer } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface TransferReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: (Transfer & { beforeBalances?: { from: number, to: number }, afterBalances?: { from: number, to: number }}) | null;
}

export function TransferReceiptDialog({
  isOpen,
  onClose,
  transfer,
}: TransferReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const [printCopies, setPrintCopies] = React.useState(1);
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

  if (!transfer) return null;

  const safeTransferDate = getSafeDate(transfer.transferredAt);
  const footerLine2 = 'This is a computer-generated document.';

  const fromBalanceBefore = transfer.beforeBalances?.from ?? 0;
  const toBalanceBefore = transfer.beforeBalances?.to ?? 0;
  const fromBalanceAfter = transfer.afterBalances?.from ?? (fromBalanceBefore - transfer.amount);
  const toBalanceAfter = transfer.afterBalances?.to ?? (toBalanceBefore + transfer.amount);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Transfer Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the internal fund transfer.
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
                    <h2 className="font-bold text-2xl uppercase text-slate-800">Fund Transfer</h2>
                    <p className="text-slate-500">Transfer ID: {transfer.transferId.substring(0, 8)}</p>
                    <p className="text-slate-500">Date: {safeTransferDate ? format(safeTransferDate, 'PPpp') : 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border rounded-lg p-4 space-y-2">
                        <h3 className="font-semibold text-base">From: {transfer.fromAccount}</h3>
                        <div className="flex justify-between text-xs"><span>Old Balance:</span><span>{formatCurrency(fromBalanceBefore)}</span></div>
                        <div className="flex justify-between text-xs text-red-600"><span>Amount Transferred:</span><span>-{formatCurrency(transfer.amount)}</span></div>
                        <Separator/>
                        <div className="flex justify-between font-bold"><span>New Balance:</span><span>{formatCurrency(fromBalanceAfter)}</span></div>
                    </div>
                     <div className="border rounded-lg p-4 space-y-2">
                        <h3 className="font-semibold text-base">To: {transfer.toAccount}</h3>
                        <div className="flex justify-between text-xs"><span>Old Balance:</span><span>{formatCurrency(toBalanceBefore)}</span></div>
                        <div className="flex justify-between text-xs text-green-600"><span>Amount Transferred:</span><span>+{formatCurrency(transfer.amount)}</span></div>
                        <Separator/>
                        <div className="flex justify-between font-bold"><span>New Balance:</span><span>{formatCurrency(toBalanceAfter)}</span></div>
                    </div>
                </div>

                <Separator className="my-6" />
                <div className="text-sm space-y-1">
                  <p><b>Notes:</b> {transfer.notes || 'N/A'}</p>
                  <p><b>Processed by:</b> {transfer.transferredByName}</p>
                </div>
                <div className="mt-12 text-center text-xs text-slate-500">
                  <p>{footerLine2}</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="terminal">
              <div ref={terminalRef} className="print-content p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                <div className="text-center space-y-1 mb-4">
                  {logoUrl && (
                    <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} className="mx-auto" />
                  )}
                  <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                  <p className="font-bold uppercase">Internal Fund Transfer</p>
                </div>
                <div className="text-center text-xs mb-4">
                  <p>Date: {safeTransferDate ? format(safeTransferDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                  <p>Transfer ID: {transfer.transferId.substring(0, 8)}</p>
                  <p>Processed By: {transfer.transferredByName}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2">Internal Fund Transfer</p>
                <div className="space-y-3 border-y border-dashed border-black py-2">
                    <div className="space-y-1">
                        <p className="uppercase font-semibold">From: {transfer.fromAccount}</p>
                        <div className="flex justify-between text-xs"><span>OLD BAL:</span><span>{formatCurrency(fromBalanceBefore)}</span></div>
                        <div className="flex justify-between text-xs"><span>AMOUNT:</span><span>-{formatCurrency(transfer.amount)}</span></div>
                        <div className="flex justify-between font-bold"><span>NEW BAL:</span><span>{formatCurrency(fromBalanceAfter)}</span></div>
                    </div>
                    <div className="space-y-1">
                        <p className="uppercase font-semibold">To: {transfer.toAccount}</p>
                        <div className="flex justify-between text-xs"><span>OLD BAL:</span><span>{formatCurrency(toBalanceBefore)}</span></div>
                        <div className="flex justify-between text-xs"><span>AMOUNT:</span><span>+{formatCurrency(transfer.amount)}</span></div>
                        <div className="flex justify-between font-bold"><span>NEW BAL:</span><span>{formatCurrency(toBalanceAfter)}</span></div>
                    </div>
                </div>

                {transfer.notes && <p className="text-xs text-center my-2">Notes: {transfer.notes}</p>}
                <div className="text-center text-xs mt-6">
                  <p>{footerLine2}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
            <div className="flex items-center gap-2">
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
