
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
import type { SalaryReward, UserProfile } from '@/lib/types';
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


interface RewardReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reward: SalaryReward | null;
  allUsers?: UserProfile[];
}

export function RewardReceiptDialog({
  isOpen,
  onClose,
  reward,
  allUsers,
}: RewardReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
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

  if (!reward) return null;

  const safeRewardDate = getSafeDate(reward.date);
  const titleText = settings?.rewardReceiptTitle || 'Staff Reward / Bonus';
  const footerLine1 = settings?.rewardReceiptFooter || 'This is an official receipt.';

  const staffProfile = reward.processedByUid ? userMap.get(reward.processedByUid) : null;
  const staffName = reward.processedBy;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reward/Bonus Receipt</DialogTitle>
          <DialogDescription>
            A receipt for the recorded staff reward.
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
                    <h2 className="font-bold text-2xl uppercase text-slate-800">{titleText}</h2>
                    <p className="text-slate-500">Receipt ID: {reward.id.substring(0, 8)}</p>
                    <p className="text-slate-500">Date: {safeRewardDate ? format(safeRewardDate, 'PPpp') : 'N/A'}</p>
                  </div>
                </div>

                <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                        <tr>
                            <th className="p-3">Staff Member</th>
                            <th className="p-3">Reason</th>
                            <th className="p-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-100">
                            <td className="p-3 font-semibold">{reward.userName}</td>
                            <td className="p-3 italic">"{reward.notes || 'N/A'}"</td>
                            <td className="p-3 text-right text-green-600 font-bold">{formatCurrency(reward.amount)}</td>
                        </tr>
                    </tbody>
                </table>

                <Separator className="my-6" />

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
                  <p>Date: {safeRewardDate ? format(safeRewardDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>
                  <p>ID: {reward.id.substring(0, 8)}</p>
                  <p>Processed By: {reward.processedBy}</p>
                </div>
                <p className="font-bold uppercase text-center mb-2">{titleText}</p>
                <div className="space-y-1 border-y border-dashed border-black py-2">
                    <div className="flex justify-between">
                        <span>Staff:</span>
                        <span>{reward.userName}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Amount:</span>
                        <span>{formatCurrency(reward.amount)}</span>
                    </div>
                </div>
                {reward.notes && <p className="text-xs text-center my-2">Reason: {reward.notes}</p>}
                <div className="text-center text-xs mt-6">
                  <p>{footerLine1}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
          <Button onClick={handlePrint} disabled={!isDataReady}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
