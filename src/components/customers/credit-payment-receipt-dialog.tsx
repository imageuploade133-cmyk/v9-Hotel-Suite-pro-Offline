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
import type { Payment, Customer } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';


interface CreditPaymentReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  customer: Customer;
  remainingBalance: number;
}

export function CreditPaymentReceiptDialog({
  isOpen,
  onClose,
  payment,
  customer,
  remainingBalance,
}: CreditPaymentReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
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
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (!printContent) return;

    const contentToPrint = printContent.innerHTML;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Print Credit Payment Receipt</title>
          ${useHDPrinting ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
          <style>
            @media print { @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
            body { font-family: sans-serif; }
            .receipt { font-family: monospace; }
          </style>
        </head>
        <body>${contentToPrint}</body>
      </html>
    `);
    doc.close();

    const handleLoad = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    };

    if (iframe.contentWindow) {
      iframe.onload = handleLoad;
    } else {
      handleLoad();
    }
  };

  const safeTransactionDate = getSafeDate(payment.transactionDate);
  const balanceBeforePayment = remainingBalance + payment.amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Credit Payment Receipt</DialogTitle>
          <DialogDescription>A receipt for the credit repayment transaction.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
                <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
            </TabsList>
            <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
                <TabsContent value="invoice">
                    <div ref={invoiceRef} className="p-8 bg-white text-black text-sm rounded-lg">
                      <header className="flex justify-between items-start mb-6">
                        <div>
                          {logoUrl ? (
                            <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain" />
                          ) : (
                            <Logo className="h-10 w-10 text-slate-800" />
                          )}
                        </div>
                        <div className="text-right">
                          <h1 className="font-bold text-lg text-slate-800">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                          <p className="text-slate-500 text-xs">{settings?.businessAddress}</p>
                        </div>
                      </header>
                      <Separator className="my-4" />
                      <div className="flex justify-between items-center mb-6">
                        <div className="text-left">
                          <h2 className="font-bold text-xl uppercase text-slate-800">Credit Payment</h2>
                          <p className="text-slate-500">Receipt ID: {payment.id.substring(0, 8)}</p>
                          <p className="text-slate-500">Date: {safeTransactionDate ? format(safeTransactionDate, 'PPP') : 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <h3 className="font-semibold text-slate-600 mb-1">Paid By:</h3>
                          <p className="font-bold text-slate-800">{customer.name}</p>
                          <p className="text-slate-600">{customer.email}</p>
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <div className="w-full max-w-sm space-y-3 text-slate-700">
                           <div className="flex justify-between">
                            <span>Balance Before Payment:</span>
                            <span>{formatCurrency(balanceBeforePayment)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-green-600">
                            <span>Amount Paid ({payment.paymentMethod}):</span>
                            <span>-{formatCurrency(payment.amount)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-base text-destructive">
                            <span>Total New Balance Due:</span>
                            <span>{formatCurrency(remainingBalance)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 text-center text-xs text-slate-500">
                        <p>Thank you for your payment!</p>
                      </div>
                    </div>
                </TabsContent>
                <TabsContent value="terminal">
                     <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                        <div className="text-center space-y-1 mb-4">
                            {logoUrl && (
                                <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />
                            )}
                            <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                             <p className="text-xs">{settings?.businessAddress}</p>
                             <p className="text-xs">{settings?.businessPhone}</p>
                        </div>
                        <div className="text-center text-xs mb-4">
                            <p>Date: {safeTransactionDate ? format(safeTransactionDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                            <p>Receipt ID: {payment.id.substring(0,8)}</p>
                            {payment.createdByName && <p>Cashier: {payment.createdByName}</p>}
                        </div>
                        <div className="font-bold uppercase text-center mb-2">Credit Payment</div>
                         <div className="space-y-1 mb-2 border-y border-dashed border-black py-2">
                           <p className="uppercase font-bold text-xs">Customer</p>
                            <div className="flex justify-between">
                                <span>Name:</span>
                                <span>{customer.name}</span>
                            </div>
                        </div>
                        <div className="space-y-1 my-2">
                          <div className="flex justify-between">
                            <span>Balance Before:</span>
                            <span>{formatCurrency(balanceBeforePayment)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>Payment ({payment.paymentMethod}):</span>
                            <span>-{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                         <div className="flex justify-between font-bold text-base border-t border-dashed border-black pt-2">
                            <span>TOTAL NEW BALANCE DUE:</span>
                            <span>{formatCurrency(remainingBalance)}</span>
                        </div>
                        <div className="text-center text-xs mt-6">
                            <p>Thank you for your payment!</p>
                        </div>
                    </div>
                </TabsContent>
            </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" />Close</Button>
           <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button>
                        <Printer className="mr-2 h-4 w-4" /> Print / Download
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handlePrint()}><Printer className="mr-2 h-4 w-4" />Print</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePrint()}><Download className="mr-2 h-4 w-4" />Download as PDF</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
