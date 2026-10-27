
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
import type { Payment, UserProfile } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download, User } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Image from 'next/image';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface ReprintReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  allUsers?: UserProfile[];
}

export function ReprintReceiptDialog({ isOpen, onClose, payment, allUsers }: ReprintReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const [printCopies, setPrintCopies] = React.useState(1);
  const { settings } = useSettings();
  const { currentBranch } = useBranch();
  const firestore = useFirestore();

  // Use provided users or fetch as fallback
  const usersQuery = React.useMemo(() => {
    if (!firestore || allUsers) return null;
    return collection(firestore, 'users');
  }, [firestore, allUsers]);
  const { data: fetchedUsers } = useCollection<UserProfile>(usersQuery);

  const usersData = allUsers || fetchedUsers;
  const isDataReady = !!usersData;

  const userMap = React.useMemo(() => {
    if (!usersData) return new Map();
    return new Map(usersData.map(u => [u.uid, u]));
  }, [usersData]);

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

  const handlePrint = (copies: number) => {
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (printContent) {
      document.body.classList.add('print-container');

      let contentToPrint = '';
      for (let i = 0; i < copies; i++) {
        contentToPrint += `<div class="receipt-copy">${printContent.innerHTML}</div>`;
      }

      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        const tailwindScript = useHDPrinting ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
        printWindow.document.write(`<html><head><title>Print Receipt</title>${tailwindScript}<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-copy { page-break-after: always; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style></head><body>`);
        printWindow.document.write(contentToPrint);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 250);
      }

      document.body.classList.remove('print-container');
    }
  };

  if (!payment) {
    return null;
  }

  const safeTransactionDate = getSafeDate(payment.transactionDate);
  const staffProfile = payment.createdByUid ? userMap.get(payment.createdByUid) : null;
  const staffName = payment.createdByName || 'System';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reprint Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the transaction. You can print either a professional invoice or a terminal-style receipt.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
                <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
                <TabsContent value="invoice">
                    <div ref={invoiceRef} className="p-8 bg-white text-black text-sm rounded-lg">
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
                                <h2 className="font-bold text-2xl uppercase text-slate-800">Payment Receipt</h2>
                                <p className="text-slate-500">Receipt ID: {payment.id.substring(0, 8)}</p>
                                <p className="text-slate-500">Date: {safeTransactionDate ? format(safeTransactionDate, 'PPPp') : 'N/A'}</p>
                            </div>
                             <div className="text-right">
                                <h3 className="font-semibold text-slate-600 mb-1">Bill To:</h3>
                                <p className="font-bold text-slate-800">{payment.guestName}</p>
                                {payment.roomNumber && <p className="text-slate-600">Room: {payment.roomNumber}</p>}
                                <p className="text-slate-600">{payment.guestEmail}</p>
                            </div>
                        </div>

                        <table className="w-full text-left">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Description</th>
                                    <th className="p-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-100">
                                    <td className="p-3">
                                        <p className="font-semibold">{payment.type} Payment</p>
                                        {payment.items && payment.items.length > 0 && (
                                            <ul className="list-disc pl-5 text-slate-500 text-xs">
                                                {payment.items.map((item, i) => <li key={i}>{item.name} (x{item.quantity})</li>)}
                                            </ul>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">{formatCurrency(payment.amount)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="flex justify-end mt-8">
                            <div className="w-full max-w-xs space-y-3 text-slate-700">
                                <div className="flex justify-between font-bold text-lg text-green-600 border-t-2 border-dashed border-green-300 pt-3">
                                    <span>Amount Paid</span>
                                    <span>{formatCurrency(payment.amount)}</span>
                                </div>
                                <p className="text-xs text-right text-slate-500">Paid via: {payment.paymentMethod}</p>
                            </div>
                        </div>

                        <Separator className="my-6"/>

                         <div className="text-sm">
                            <div className="flex items-center gap-3">
                              <p><b>Processed by:</b></p>
                              <div className="flex items-center gap-2">
                                 <Avatar className="h-6 w-6">
                                    <AvatarImage src={staffProfile?.photoURL || undefined} alt={staffName} />
                                    <AvatarFallback className="text-xs">
                                      {staffProfile ? getInitials(staffProfile.name) : <User />}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{staffName}</span>
                              </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="terminal">
                     <div ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                        <div className="text-center space-y-1 mb-4">
                            {logoUrl && (
                                <img src={logoUrl} alt={settings.businessName || 'logo'} style={{ height: `${logoSize}px` }} className="mx-auto" />
                            )}
                            <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                             <p className="text-xs">{settings?.businessAddress}</p>
                             <p className="text-xs">{settings?.businessPhone}</p>
                        </div>
                        <div className="text-center text-xs mb-4">
                            <p>Date: {safeTransactionDate ? format(safeTransactionDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                            <p>Receipt ID: {payment.id.substring(0,8)}</p>
                             <p>Cashier: {staffName}</p>
                        </div>
                        <p className="font-bold uppercase text-center mb-2">Sale</p>
                        <div className="space-y-1 border-y border-dashed border-black py-2">
                            {payment.items && payment.items.length > 0 ? (
                                payment.items.map((item, index) => (
                                    <div key={index}>
                                        <div className="flex justify-between">
                                            <span>{item.name}</span>
                                            <span>{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                        <div className="text-xs ml-2">{item.quantity} @ {formatCurrency(item.price)}</div>
                                    </div>
                                ))
                             ) : (
                                <div className="flex justify-between">
                                    <span>{payment.type} Payment</span>
                                    <span>{formatCurrency(payment.amount)}</span>
                                </div>
                             )}
                        </div>
                         <div className="flex justify-between font-bold text-base pt-2">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(payment.amount)}</span>
                        </div>
                         <div className="my-4 space-y-1 text-center">
                            <p className="font-bold uppercase">{payment.paymentMethod}</p>
                            <p className="font-bold text-lg">Amount Paid: {formatCurrency(payment.amount)}</p>
                        </div>
                    </div>
                </TabsContent>
            </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
          <div className="flex items-center gap-2">
            <div className="relative w-24">
              <Label htmlFor="print-copies" className="absolute -top-5 text-xs">Copies</Label>
              <Input
                id="print-copies"
                type="number"
                min="1"
                value={printCopies}
                onChange={(e) => setPrintCopies(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <Button onClick={() => handlePrint(printCopies)} disabled={printCopies < 1 || !isDataReady}>
              {!isDataReady ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}