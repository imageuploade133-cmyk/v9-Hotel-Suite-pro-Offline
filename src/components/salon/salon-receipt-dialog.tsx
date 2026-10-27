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
import type { SalonService, UserProfile } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, Download, User } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Label } from '../ui/label';
import { Input } from '../ui/input';


interface SalonReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalonService | null;
  allUsers?: UserProfile[];
}

export function SalonReceiptDialog({
  isOpen,
  onClose,
  order,
  allUsers,
}: SalonReceiptDialogProps) {
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
  const showWatermark = settings?.showWatermarkLogo;
  const watermarkUrl = settings?.watermarkLogoUrl;
  const watermarkOpacity = settings?.watermarkOpacity ?? 0.07;
  const watermarkSize = settings?.watermarkSize ?? 50;
  const watermarkPosition = settings?.watermarkPosition ?? 'center';
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
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        const tailwindScript = useHDPrinting ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
        printWindow.document.write(`<html><head><title>Print Document</title>${tailwindScript}<style>@media print { @page { margin: 0mm !important; } body { margin: 1cm !important; } @page { margin: 0mm !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-copy { page-break-after: always; } .no-print { display: none !important; } } .receipt { font-family: monospace; }</style></head><body>`);

        let contentToPrint = '';
        for (let i = 0; i < copies; i++) {
          contentToPrint += `<div class="receipt-copy">${printContent.innerHTML}</div>`;
        }
        printWindow.document.write(contentToPrint);

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

  if (!order) return null;

  const isPaid = order.paymentStatus === 'Paid';
  const completedAtDate = getSafeDate(order.createdAt);
  const footerLine1 = settings?.unpaidInvoiceFooterLine1 || 'Thank you for choosing Hotel Suite Pro!';
  const footerLine2 = settings?.unpaidInvoiceFooterLine2 || 'This is a computer-generated document.';

  const staffProfile = order.staffId ? userMap.get(order.staffId) : null;
  const staffName = order.staffName || 'System';


  const getWatermarkPositionStyle = () => {
    switch (watermarkPosition) {
      case 'top-left': return { top: '5%', left: '5%', transform: 'translate(0, 0)' };
      case 'top-right': return { top: '5%', right: '5%', transform: 'translate(0, 0)' };
      case 'bottom-left': return { bottom: '5%', left: '5%', transform: 'translate(0, 0)' };
      case 'bottom-right': return { bottom: '5%', right: '5%', transform: 'translate(0, 0)' };
      default: return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const watermarkContainerStyle: React.CSSProperties = watermarkPosition === 'tile' ? {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${watermarkSize * 2}px, 1fr))`,
    gap: '20px',
    opacity: watermarkOpacity,
    zIndex: 0,
    pointerEvents: 'none',
  } : {
    position: 'absolute',
    opacity: watermarkOpacity,
    zIndex: 0,
    pointerEvents: 'none',
    width: `${watermarkSize}%`,
    height: 'auto',
    ...getWatermarkPositionStyle(),
  };

  const WatermarkComponent = () => {
    if (!showWatermark || !watermarkUrl) return null;

    if (watermarkPosition === 'tile') {
      return (
        <div style={watermarkContainerStyle}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="relative w-full aspect-square">
              <Image src={watermarkUrl!} alt="Watermark" layout="fill" objectFit="contain" />
            </div>
          ))}
        </div>
      );
    }

    return (
       <div style={watermarkContainerStyle}>
            <div style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
                <Image src={watermarkUrl!} alt="Watermark" layout="fill" objectFit="contain" />
            </div>
        </div>
    );
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Salon Service Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the service provided. You can print this for your records or for the customer.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
                <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
                <TabsContent value="invoice">
                    <div ref={invoiceRef} className="p-8 bg-white text-black text-sm rounded-lg relative overflow-hidden">
                        <WatermarkComponent />
                        {isPaid && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-45">
                                <p className="text-8xl font-bold text-green-500 opacity-20 border-4 border-green-500 p-4 rounded-lg">PAID</p>
                            </div>
                        )}
                         <div style={{ position: 'relative', zIndex: 1 }}>
                            <header className="flex justify-between items-start mb-8">
                                <div>
                                    {logoUrl ? (
                                        <Image src={logoUrl} alt={settings.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain" />
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
                                    <h2 className="font-bold text-2xl uppercase text-slate-800">Service Receipt</h2>
                                    <p className="text-slate-500">Order #: {order.orderNumber}</p>
                                    <p className="text-slate-500">Date: {completedAtDate ? format(completedAtDate, 'PPP') : format(new Date(), 'PPP')}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-semibold text-slate-600 mb-1">Customer:</h3>
                                    <p className="font-bold text-slate-800">{order.customerName}</p>
                                    {order.roomNumber && <p className="text-slate-600">Room: {order.roomNumber}</p>}
                                </div>
                            </div>

                            <table className="w-full text-left">
                                <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                                    <tr>
                                        <th className="p-3">Service</th>
                                        <th className="p-3 text-right">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items?.map((item, index) => (
                                        <tr key={index} className="border-b border-slate-100">
                                            <td className="p-3">
                                                <p className="font-semibold">{item.name}</p>
                                            </td>
                                            <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="flex justify-end mt-8">
                                <div className="w-full max-w-xs space-y-3 text-slate-700">
                                    <div className="flex justify-between font-bold text-lg text-slate-800 border-t-2 border-dashed border-slate-300 pt-3">
                                        <span>Total</span>
                                        <span>{formatCurrency(order.totalPrice)}</span>
                                    </div>
                                    {isPaid && (
                                        <div className="flex justify-between font-bold text-lg text-green-600 border-t-2 border-dashed border-green-300 pt-3">
                                            <span>Amount Paid</span>
                                            <span>{formatCurrency(order.totalPrice)}</span>
                                        </div>
                                    )}
                                    {isPaid && order.paymentMethod && <p className="text-xs text-right text-slate-500">Paid via: {order.paymentMethod}</p>}
                                </div>
                            </div>

                            <Separator className="my-6"/>

                             <div className="text-sm">
                                <div className="flex items-center gap-3">
                                  <p><b>Processed by:</b></p>
                                  <div className="flex items-center gap-2">
                                     <Avatar className="h-6 w-6">
                                        <AvatarImage src={staffProfile?.photoURL} alt={staffProfile?.name} />
                                        <AvatarFallback className="text-xs">
                                          {staffProfile ? getInitials(staffProfile.name) : <User />}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>{staffName}</span>
                                  </div>
                                </div>
                            </div>


                            <div className="mt-12 text-center text-xs text-slate-500">
                                <p>{footerLine1}</p>
                                <p>{footerLine2}</p>
                            </div>
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
                             <p className="text-xs">{settings?.businessAddress || '123 Luxury Lane, Suite 100, Metropolis, ST 12345'}</p>
                             <p className="text-xs">{settings?.businessPhone || 'contact@example.com'}</p>
                        </div>
                        <div className="text-center text-xs mb-4">
                            <p>Date: {completedAtDate ? format(completedAtDate, 'MM/dd/yyyy HH:mm:ss') : format(new Date(), 'MM/dd/yyyy HH:mm:ss')}</p>
                            <p>Receipt ID: {order.orderNumber}</p>
                             <p>Cashier: {staffName}</p>
                        </div>
                        <p className="font-bold uppercase text-center mb-2">Sale</p>
                        <div className="space-y-1 border-b border-dashed border-black pb-2">
                             {order.items?.map((item, index) => (
                                <div key={index} className="flex justify-between">
                                    <span>{item.name}</span>
                                    <span>{formatCurrency(item.price)}</span>
                                </div>
                             ))}
                        </div>
                         <div className="flex justify-between font-bold text-base pt-2">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(order.totalPrice)}</span>
                        </div>
                         <div className="my-4 space-y-1 text-center">
                            {isPaid ? (
                                <>
                                    <p className="font-bold uppercase">{order.paymentMethod || 'Paid'}</p>
                                    <p className="font-bold text-lg">Amount Paid: {formatCurrency(order.totalPrice)}</p>
                                </>
                            ) : (
                                <p className="font-bold text-lg text-red-600">AMOUNT DUE</p>
                            )}
                        </div>
                        <div className="text-center text-xs mt-6">
                            <p>{footerLine1}</p>
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
