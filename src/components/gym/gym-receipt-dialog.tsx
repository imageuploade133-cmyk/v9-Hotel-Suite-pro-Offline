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
import type { Payment, GymMembershipPlan, UserProfile } from '@/lib/types';
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


interface GymReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  allUsers?: UserProfile[];
  allGymPlans?: GymMembershipPlan[];
}

export function GymReceiptDialog({
  isOpen,
  onClose,
  payment,
  allUsers,
  allGymPlans,
}: GymReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const { settings } = useSettings();
  const { currentBranch } = useBranch();
  const firestore = useFirestore();

  // Use provided data or fetch as fallback
  const membershipPlansQuery = React.useMemo(() => {
    if (!firestore || allGymPlans) return null;
    return collection(firestore, 'gymMembershipPlans');
  }, [firestore, allGymPlans]);
  const { data: fetchedGymPlans } = useCollection<GymMembershipPlan>(membershipPlansQuery);

  const usersQuery = React.useMemo(() => {
    if (!firestore || allUsers) return null;
    return collection(firestore, 'users');
  }, [firestore, allUsers]);
  const { data: fetchedUsers } = useCollection<UserProfile>(usersQuery);

  const membershipPlans = allGymPlans || fetchedGymPlans;
  const usersData = allUsers || fetchedUsers;
  const isDataReady = !!membershipPlans && !!usersData;

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


  const handlePrint = () => {
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;

    if (printContent) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Document</title>');
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

  if (!payment) return null;

  const isRefunded = payment.status === 'Refunded';
  const plan = membershipPlans?.find(p => p.id === (payment as any).planId);
  const safeTransactionDate = getSafeDate(payment.transactionDate);
  const footerLine1 = settings?.unpaidInvoiceFooterLine1 || 'Thank you for choosing Hotel Suite Pro!';
  const footerLine2 = settings?.unpaidInvoiceFooterLine2 || 'This is a computer-generated document.';

  const staffProfile = payment.createdByUid ? userMap.get(payment.createdByUid) : null;
  const staffName = payment.createdByName || 'System';


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
          <DialogTitle>Gym Membership Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the recent gym transaction.
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
                        {isRefunded && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-45">
                                <p className="text-8xl font-bold text-red-500 opacity-20 border-4 border-red-500 p-4 rounded-lg">REFUNDED</p>
                            </div>
                        )}
                         <div style={{ position: 'relative', zIndex: 1 }}>
                            <header className="flex justify-between items-start mb-8">
                                <div>
                                    {logoUrl ? (
                                        <Image src={logoUrl} alt={settings?.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain" />
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
                                    <p className="text-slate-500">Receipt ID: {payment.id.substring(0,8)}</p>
                                    <p className="text-slate-500">Date: {safeTransactionDate ? format(safeTransactionDate, 'PPP') : 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-semibold text-slate-600 mb-1">Bill To:</h3>
                                    <p className="font-bold text-slate-800">{payment.guestName}</p>
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
                                            <p className="font-semibold">Gym Membership</p>
                                            <p className="text-slate-500 text-xs">{plan ? `${plan.name} (${plan.duration} days)` : 'Standard Plan'}</p>
                                        </td>
                                        <td className="p-3 text-right">{formatCurrency(payment.amount)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="flex justify-end mt-8">
                                <div className="w-full max-w-xs space-y-3 text-slate-700">
                                    <div className="flex justify-between font-bold text-lg text-green-600 border-t-2 border-dashed border-green-300 pt-3">
                                        <span>Amount {isRefunded ? 'Refunded' : 'Paid'}</span>
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
                                <Image src={logoUrl} alt={settings?.businessName || 'logo'} width={logoSize} height={logoSize} className="object-contain mx-auto" />
                            )}
                            <h1 className="font-bold text-lg">{settings?.businessName || 'Hotel Suite Pro'}</h1>
                             <p className="text-xs">{settings?.businessAddress || '123 Luxury Lane, Suite 100, Metropolis, ST 12345'}</p>
                             <p className="text-xs">{settings?.businessPhone || 'contact@example.com'}</p>
                        </div>
                        <div className="text-center text-xs mb-4">
                            <p>Date: {safeTransactionDate ? format(safeTransactionDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                            <p>Receipt ID: {payment.id.substring(0,8)}</p>
                             <p>Cashier: {staffName}</p>
                        </div>
                        <p className="font-bold uppercase text-center mb-2">Sale</p>
                        <div className="space-y-1 border-b border-dashed border-black pb-2">
                             <div className="flex justify-between">
                                <span>{plan ? `${plan.name} (${plan.duration} days)` : 'Gym Membership'}</span>
                                <span>{formatCurrency(payment.amount)}</span>
                            </div>
                        </div>
                         <div className="flex justify-between font-bold text-base pt-2">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(payment.amount)}</span>
                        </div>
                         <div className="my-4 space-y-1 text-center">
                            <p className="font-bold uppercase">{payment.paymentMethod}</p>
                            <p className="font-bold text-lg">Amount {isRefunded ? 'Refunded' : 'Paid'}: {formatCurrency(payment.amount)}</p>
                        </div>
                         {isRefunded && (
                            <div className="text-center font-bold text-lg uppercase border-y-2 border-dashed border-black my-4 py-2">
                                *** REFUNDED ***
                            </div>
                         )}
                        <div className="text-center text-xs mt-6">
                            <p>{footerLine1}</p>
                        </div>
                    </div>
                </TabsContent>
            </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
            <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={!isDataReady}>
                        {!isDataReady ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                            </>
                        ) : (
                            <>
                                <Printer className="mr-2 h-4 w-4" /> Print / Download
                            </>
                        )}
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
