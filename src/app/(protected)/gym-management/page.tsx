
'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  updateDoc,
  where,
  getDocs,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import type { GymMember, Payment, GymMembershipPlan, WhatsAppReminder } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, DollarSign, User, Users, CalendarCheck, ChevronLeft, ChevronRight, Download, Printer, Loader2, History, Search, MessageSquareText, Undo2, RefreshCw, ChevronDown, Phone, MoreHorizontal, Edit, FileText, Trash2, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MemberCard } from '@/components/gym/member-card';
import { AddEditMemberDialog } from '@/components/gym/add-edit-member-dialog';
import { RenewMemberDialog } from '@/components/gym/renew-member-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CalendarClock, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isBefore, isAfter, addDays, isWithinInterval, isToday, startOfToday, startOfDay, endOfDay, format } from 'date-fns';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { StatCard } from '@/components/ui/stat-card';
import { useSettings } from '@/contexts/settings-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import * as htmlToImage from 'html-to-image';
import { exportToCsv } from '@/lib/csv-export';
import { GymHistoryReport } from '@/components/gym/gym-history-report';
import { GymHistoryTable } from '@/components/gym/gym-history-table';
import { useUser } from '@/contexts/user-context';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { GymReceiptDialog } from '@/components/gym/gym-receipt-dialog';
import { Input } from '@/components/ui/input';
import { SendRemindersDialog } from '@/components/gym/send-reminders-dialog';
import { GymRefundDialog } from '@/components/gym/gym-refund-dialog';
import { Label } from '@/components/ui/label';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';

const PAGE_SIZE = 8;

function MemberGrid({ members, onOpenActions, onRenew, onSendReminder, searchTerm }: { members: GymMember[], onOpenActions: (member: GymMember) => void, onRenew: (member: GymMember) => void, onSendReminder: (member: GymMember) => void, searchTerm: string }) {
    if (members.length === 0) {
        return (
             <div className="col-span-full">
                <EmptyState
                    icon={Users}
                    title={searchTerm ? "No Members Found" : "No Members"}
                    description={searchTerm ? `Your search for "${searchTerm}" returned no results in this category.` : "There are no members in this category."}
                />
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {members.map(member => (
                <MemberCard
                    key={member.id}
                    member={member}
                    onOpenActions={onOpenActions}
                    onRenew={onRenew}
                    onSendReminder={onSendReminder}
                />
            ))}
        </div>
    );
}

function GymManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isRenewOpen, setIsRenewOpen] = React.useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false);
  const [isRemindersOpen, setIsRemindersOpen] = React.useState(false);
  const [isRefundOpen, setIsRefundOpen] = React.useState(false);
  const [reminderList, setReminderList] = React.useState<GymMember[]>([]);
  const [copyToPhoneNumber, setCopyToPhoneNumber] = React.useState('');

  const [selectedMember, setSelectedMember] = React.useState<GymMember | null>(null);
  const [paymentToRefund, setPaymentToRefund] = React.useState<Payment | null>(null);
  const [receiptPayment, setReceiptPayment] = React.useState<Payment | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [reminderToConfirm, setReminderToConfirm] = React.useState<{ member: GymMember; message: string; copyTo?: string; } | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);

  const [actionsMember, setActionsMember] = React.useState<GymMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const CONFIRM_DELETE_TEXT = "DELETE";

  const userCurrency = settings?.currency || 'USD';

  const gymPaymentsQuery = React.useMemo(() => {
    return firestore ? query(collection(firestore, 'payments'), where('type', '==', 'Gym Membership'), orderBy('transactionDate', 'desc')) : null;
  }, [firestore, reloadCounter]);
  const { data: gymPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(gymPaymentsQuery);

  const allMembersQuery = React.useMemo(() => {
    return firestore ? query(collection(firestore, 'gym-members')) : null;
  }, [firestore, reloadCounter]);
  const { data: allMembers, isLoading: areMembersLoading } = useCollection<GymMember>(allMembersQuery);

  const membershipPlansQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'gymMembershipPlans'));
  }, [firestore]);
  const { data: membershipPlans } = useCollection<GymMembershipPlan>(membershipPlansQuery);

  const remindersSentQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'whatsapp-reminders'));
  }, [firestore]);
  const { data: remindersSent } = useCollection<WhatsAppReminder>(remindersSentQuery);

  const refundedPaymentsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'payments'),
        where('type', '==', 'Gym Membership'),
        where('status', '==', 'Refunded')
    );
  }, [firestore, reloadCounter]);
  const { data: refundedPayments } = useCollection<Payment>(refundedPaymentsQuery);

  const { activeMembers, expiringMembers, expiredMembers } = React.useMemo(() => {
    if (!allMembers) return { activeMembers: [], expiringMembers: [], expiredMembers: [] };

    const filteredMembers = allMembers.filter(member => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        return (
            member.name.toLowerCase().includes(lowerCaseSearch) ||
            (member.email && member.email.toLowerCase().includes(lowerCaseSearch)) ||
            (member.phoneNumber && member.phoneNumber.includes(lowerCaseSearch)) ||
            (member.memberId && String(member.memberId).includes(lowerCaseSearch))
        );
    });

    const now = new Date();
    const expiryThreshold = addDays(now, 7);

    const active: GymMember[] = [];
    const expiring: GymMember[] = [];
    const expired: GymMember[] = [];

    filteredMembers.forEach(member => {
      const isRefunded = (member as any).status === 'Refunded';

      if (isRefunded) {
        expired.push(member);
        return;
      }

      const expiresAt = getSafeDate(member.expiresAt);
      if (!expiresAt) {
          active.push(member); // Treat members with no expiry as active
      } else if (isBefore(expiresAt, now)) {
          expired.push(member);
      } else if (isWithinInterval(expiresAt, { start: now, end: expiryThreshold })) {
          expiring.push(member);
      } else {
          active.push(member);
      }
    });

    return {
        activeMembers: active.sort((a,b) => getSafeDate(a.expiresAt)!.getTime() - getSafeDate(b.expiresAt)!.getTime()),
        expiringMembers: expiring.sort((a,b) => getSafeDate(a.expiresAt)!.getTime() - getSafeDate(b.expiresAt)!.getTime()),
        expiredMembers: expired.sort((a,b) => getSafeDate(a.expiresAt)!.getTime() - getSafeDate(b.expiresAt)!.getTime())
    };
  }, [allMembers, searchTerm]);


  const { totalGymIncome, todaysGymIncome, totalMembers, totalRenewals, totalRefunds } = React.useMemo(() => {
      const payments = gymPayments || [];
      const nonRefundedPayments = payments.filter(p => p.status !== 'Refunded');

      const total = nonRefundedPayments.reduce((acc, payment) => acc + payment.amount, 0);
      const today = nonRefundedPayments.filter(p => isToday(getSafeDate(p.transactionDate)!)).reduce((acc, p) => acc + p.amount, 0);

      const refunds = (refundedPayments || []).reduce((acc, payment) => acc + payment.amount, 0);

      return {
          totalGymIncome: total,
          todaysGymIncome: today,
          totalMembers: allMembers?.length || 0,
          totalRenewals: payments.length,
          totalRefunds: refunds,
      };
  }, [gymPayments, allMembers, refundedPayments]);

  const historyData = React.useMemo(() => {
    if (!gymPayments || !allMembers) return [];

    const memberMap = new Map(allMembers.map(m => [m.email, m]));

    let filteredPayments = (gymPayments || []);

    if (dateRange?.from) {
        const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
        filteredPayments = filteredPayments.filter(p => {
            const transactionDate = getSafeDate(p.transactionDate);
            return transactionDate && isWithinInterval(transactionDate, interval);
        });
    }

    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        filteredPayments = filteredPayments.filter(p => {
            const member = memberMap.get(p.guestEmail || '');
            return (
                p.guestName.toLowerCase().includes(lowerCaseSearch) ||
                (p.guestEmail && p.guestEmail.toLowerCase().includes(lowerCaseSearch)) ||
                (member?.phoneNumber && member.phoneNumber.includes(lowerCaseSearch)) ||
                (member?.memberId && String(member.memberId).includes(lowerCaseSearch))
            )
        })
    }

    return filteredPayments.map(p => {
        const member = memberMap.get(p.guestEmail || '');
        return {
            ...p,
            expiresAt: member?.expiresAt,
            planId: member?.planId,
            membershipFee: member?.membershipFee,
            phoneNumber: member?.phoneNumber,
        }
    });
  }, [gymPayments, allMembers, dateRange, searchTerm]);

    const handleSendReminder = (member: GymMember, copyTo?: string) => {
        const expiryDate = getSafeDate(member.expiresAt);
        if (!expiryDate || !member.phoneNumber) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Cannot send reminder. Member phone number is missing.'
            });
            return;
        }

        const businessName = settings?.businessName || 'Your Hotel';
        const template = settings?.gymReminderMessage || `Hi {{MEMBER_NAME}},\n\nThis is a friendly reminder from {{BUSINESS_NAME}} that your gym membership is set to expire on {{EXPIRY_DATE}}. We'd love for you to continue your fitness journey with us!\n\nPlease visit the front desk to renew your membership at your earliest convenience.\n\nThank you,\n{{BUSINESS_NAME}} Team`;

        const message = template
            .replace(/{{MEMBER_NAME}}/g, member.name)
            .replace(/{{EXPIRY_DATE}}/g, format(expiryDate, 'EEEE, dd-MM-yyyy'))
            .replace(/{{BUSINESS_NAME}}/g, businessName);

        setReminderToConfirm({ member, message, copyTo });
    };

    const confirmSendReminder = async () => {
        if (!reminderToConfirm) return;
        const { member, message, copyTo } = reminderToConfirm;
        setIsSending(true);

        try {
            const result = await sendWhatsAppMessage({
                phone: member.phoneNumber!,
                message: message,
            });

            if (result.status !== 'success') {
                throw new Error(result.message || 'Failed to send message via API.');
            }

            toast({
                variant: 'success',
                title: 'Reminder Sent',
                description: `A renewal reminder has been sent to ${member.name}.`
            });

            const phoneToCopyTo = copyTo || copyToPhoneNumber;
            if (phoneToCopyTo) {
                const copyMessage = `(Copy of message sent to ${member.name})\n\n${message}`;
                const copyResult = await sendWhatsAppMessage({
                    phone: phoneToCopyTo,
                    message: copyMessage,
                });

                if (copyResult.status === 'success') {
                    toast({
                        variant: 'success',
                        title: 'Copy Sent',
                        description: `A copy of the reminder was sent to ${phoneToCopyTo}.`
                    });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Copy Failed',
                        description: `Could not send copy to ${phoneToCopyTo}: ${copyResult.message}`
                    });
                }
            }

        } catch (error: any) {
            console.error("Error sending WhatsApp message:", error);
            toast({
                variant: 'destructive',
                title: 'Failed to Send',
                description: error.message || 'There was an error sending the reminder.'
            });
        } finally {
            setIsSending(false);
            setCopyToPhoneNumber('');
            setReminderToConfirm(null);
        }
    };


  const handleDataMutation = (payment?: Payment) => {
    setReloadCounter(c => c + 1);
    if (payment) {
        setReceiptPayment(payment);
        setIsReceiptOpen(true);
    }
  };

  const handleEdit = (member: GymMember) => {
    setSelectedMember(member);
    setIsEditOpen(true);
  };

  const handleRenew = (member: GymMember) => {
    setSelectedMember(member);
    setIsRenewOpen(true);
  };

  const handleOpenActions = (member: GymMember) => {
    setActionsMember(member);
  };

  const handleReprintReceipt = (payment: Payment) => {
    setReceiptPayment(payment);
    setIsReceiptOpen(true);
  };

  const confirmDelete = async () => {
    if (!firestore || !actionsMember) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'gym-members', actionsMember.id));
      toast({ variant: 'success', title: 'Member Deleted', description: `${actionsMember.name} has been removed.` });
      setReloadCounter(c => c + 1);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Deleting', description: error.message });
    } finally {
      setIsDeleting(false);
      handleCloseActions();
    }
  };

  const handleRefund = (payment: Payment) => {
    setPaymentToRefund(payment);
    setIsRefundOpen(true);
  };

  const confirmRefund = async (paymentToRefund: Payment) => {
    if (!firestore) return;

    const batch = writeBatch(firestore);

    const paymentRef = doc(firestore, 'payments', paymentToRefund.id);
    batch.update(paymentRef, { status: 'Refunded' });

    const membersQuery = query(collection(firestore, 'gym-members'), where('email', '==', paymentToRefund.guestEmail), limit(1));
    const membersSnapshot = await getDocs(membersQuery);

    if (!membersSnapshot.empty) {
        const memberDoc = membersSnapshot.docs[0];
        const memberRef = doc(firestore, 'gym-members', memberDoc.id);
        batch.update(memberRef, { expiresAt: new Date(), status: 'Refunded' });
    } else {
        toast({ variant: 'destructive', title: 'Member Not Found', description: `Could not find a member with email ${paymentToRefund.guestEmail} to update their status.` });
    }

    try {
        await batch.commit();
        toast({ variant: 'success', title: 'Refund Processed', description: `Payment for ${paymentToRefund.guestName} has been refunded.`});
        handleDataMutation();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Processing Refund', description: error.message });
    } finally {
        setIsRefundOpen(false);
        setPaymentToRefund(null);
    }
  };


  const openRemindersDialog = (members: GymMember[]) => {
      setReminderList(members);
      setIsRemindersOpen(true);
  }

  const handleCloseActions = () => {
    setActionsMember(null);
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  }

  const closeDialogs = () => {
    setIsAddOpen(false);
    setIsEditOpen(false);
    setIsRenewOpen(false);
    setIsReceiptOpen(false);
    setIsRemindersOpen(false);
    setIsRefundOpen(false);
    setSelectedMember(null);
    setReceiptPayment(null);
    setReminderToConfirm(null);
    setPaymentToRefund(null);
    setCopyToPhoneNumber('');
    handleCloseActions();
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);

  const handlePrint = () => {
    const content = printRef.current;
    if (content) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Gym History Report</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body class="p-8">');
        printWindow.document.write(content.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  };

  const handleDownloadImage = async () => {
    const reportNode = printRef.current;
    if (!reportNode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find report content.' });
        return;
    }
    setIsExporting(true);
    toast({ title: 'Generating Image', description: 'Your report is being converted to an image.' });
    try {
        const dataUrl = await htmlToImage.toPng(reportNode, { quality: 1.0, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `gym-history-report_${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
        toast({ variant: 'success', title: 'Image Downloaded' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Image Generation Failed', description: 'Could not generate image.' });
    } finally {
       setIsExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (!historyData || historyData.length === 0) {
      toast({ variant: 'destructive', title: 'No Data to Export'});
      return;
    }
    setIsExporting(true);
    try {
      const dataToExport = historyData.map(p => ({
        'Transaction ID': p.id,
        'Member Name': p.guestName,
        'Member Email': p.guestEmail,
        'Amount': p.amount,
        'Payment Method': p.paymentMethod,
        'Date': getSafeDate(p.transactionDate)?.toISOString(),
      }));
      exportToCsv(dataToExport, `gym-payments-history_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
       setIsExporting(false);
    }
  };


  const isLoading = areMembersLoading || arePaymentsLoading;

  return (
    <>
      <div className="hidden">
        <div ref={printRef}>
          <GymHistoryReport payments={historyData || []} settings={settings} userProfile={userProfile} membershipPlans={membershipPlans || []} />
        </div>
      </div>
      <style>{`
        @media print { @page { margin: 0mm !important; }
          body > *, body > #__next > * { visibility: hidden; }
          #gym-report-print, #gym-report-print * { visibility: visible; }
          #gym-report-print { position: absolute; left: 0; top: 0; width: 100%; z-index: 9999; }
        }
      `}</style>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Dumbbell className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Gym Management</h1>
              <p className="text-muted-foreground">Register and manage gym member access.</p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Member
          </Button>
        </div>

        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                <StatCard title="Total Gym Income" value={formatCurrency(totalGymIncome)} icon={DollarSign} description="All-time revenue from gym memberships." />
                <StatCard title="Today's Gym Income" value={formatCurrency(todaysGymIncome)} icon={CalendarCheck} description="Revenue from gym memberships today." />
                <StatCard title="Total Members" value={totalMembers} icon={Users} description="Total number of registered members." />
            </div>

            <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                 <StatCard title="Total Renewals" value={totalRenewals} icon={RefreshCw} description="Total number of renewal payments." />
                <StatCard title="WhatsApp Reminders" value={remindersSent?.length || 0} icon={MessageSquareText} description="Total renewal reminders sent." />
                <StatCard title="Total Refunds" value={formatCurrency(totalRefunds)} icon={Undo2} description="Total amount refunded to members." className="bg-accent text-accent-foreground" iconClassName="text-accent-foreground" />
            </CollapsibleContent>

             <div className="mt-4 flex items-center justify-center">
                <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    {isStatsExpanded ? 'Show Less' : 'Show More Stats'}
                    <ChevronDown
                    className={cn(
                        'ml-2 h-4 w-4 transition-transform',
                        isStatsExpanded && 'rotate-180'
                    )}
                    />
                </Button>
                </CollapsibleTrigger>
            </div>
        </Collapsible>

        <Tabs defaultValue="members">
            <div className="flex justify-between items-center">
              <TabsList className="grid w-fit grid-cols-3">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="refunds">Refunds</TabsTrigger>
              </TabsList>
               <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Search by name, email, phone, or ID..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
            </div>
            <TabsContent value="members" className="mt-4">
                 {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : allMembers && allMembers.length > 0 ? (
                <div className="space-y-4">
                    <Collapsible defaultOpen>
                        <div className="w-full flex items-center justify-between p-3 border rounded-lg bg-card font-semibold text-lg hover:bg-accent transition-colors">
                            <CollapsibleTrigger className="flex-1 text-left flex items-center gap-2">
                                <Users className="h-5 w-5 text-green-500" />Active Members <Badge variant="success">{activeMembers.length}</Badge>
                            </CollapsibleTrigger>
                             <Button size="sm" onClick={() => openRemindersDialog(activeMembers)} disabled={activeMembers.length === 0} style={{ backgroundImage: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary) / 0.8))'}}>
                                Send All Reminders
                            </Button>
                        </div>
                        <CollapsibleContent className="pt-4">
                            <MemberGrid members={activeMembers} onOpenActions={handleOpenActions} onRenew={handleRenew} onSendReminder={handleSendReminder} searchTerm={searchTerm} />
                        </CollapsibleContent>
                    </Collapsible>
                    <Collapsible>
                        <div className="w-full flex items-center justify-between p-3 border rounded-lg bg-card font-semibold text-lg hover:bg-accent transition-colors">
                            <CollapsibleTrigger className="flex-1 text-left flex items-center gap-2">
                                <CalendarClock className="h-5 w-5 text-yellow-500" />Expiring Soon <Badge variant="warning">{expiringMembers.length}</Badge>
                            </CollapsibleTrigger>
                             <Button size="sm" onClick={() => openRemindersDialog(expiringMembers)} disabled={expiringMembers.length === 0} style={{ backgroundImage: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary) / 0.8))'}}>
                                Send All Reminders
                            </Button>
                        </div>
                        <CollapsibleContent className="pt-4">
                            <MemberGrid members={expiringMembers} onOpenActions={handleOpenActions} onRenew={handleRenew} onSendReminder={handleSendReminder} searchTerm={searchTerm} />
                        </CollapsibleContent>
                    </Collapsible>
                    <Collapsible>
                         <div className="w-full flex items-center justify-between p-3 border rounded-lg bg-card font-semibold text-lg hover:bg-accent transition-colors">
                            <CollapsibleTrigger className="flex-1 text-left flex items-center gap-2">
                                <Ban className="h-5 w-5 text-destructive" />Expired Members <Badge variant="destructive">{expiredMembers.length}</Badge>
                            </CollapsibleTrigger>
                            <Button size="sm" onClick={() => openRemindersDialog(expiredMembers)} disabled={expiredMembers.length === 0} style={{ backgroundImage: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary) / 0.8))'}}>
                                Send All Reminders
                            </Button>
                        </div>
                        <CollapsibleContent className="pt-4">
                            <MemberGrid members={expiredMembers} onOpenActions={handleOpenActions} onRenew={handleRenew} onSendReminder={handleSendReminder} searchTerm={searchTerm} />
                        </CollapsibleContent>
                    </Collapsible>
                </div>
                ) : (
                <EmptyState icon={Users} title="No Members Registered" description="Get started by registering your first gym member." className="min-h-[50vh]">
                    <Button onClick={() => setIsAddOpen(true)} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" /> Add Member
                    </Button>
                </EmptyState>
                )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Transaction History</h3>
                                <p className="text-sm text-muted-foreground">A record of all gym membership payments.</p>
                            </div>
                             <div className="flex items-center gap-2">
                                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                                <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                                <Button variant="outline" onClick={handleDownloadImage} disabled={isExporting}><Download className="mr-2 h-4 w-4"/>Download</Button>
                             </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <GymHistoryTable
                          data={historyData}
                          currency={userCurrency}
                          isLoading={isLoading}
                          membershipPlans={membershipPlans || []}
                          onReprintReceipt={handleReprintReceipt}
                          onRefund={handleRefund}
                          searchTerm={searchTerm}
                        />
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="refunds" className="mt-4">
                <Card>
                    <CardHeader>
                        <h3 className="text-xl font-bold">Refunded Transactions</h3>
                        <p className="text-sm text-muted-foreground">A record of all refunded gym membership payments.</p>
                    </CardHeader>
                    <CardContent>
                        <GymHistoryTable
                          key="refunds-table"
                          data={refundedPayments || []}
                          currency={userCurrency}
                          isLoading={isLoading}
                          membershipPlans={membershipPlans || []}
                          onReprintReceipt={handleReprintReceipt}
                          onRefund={() => {}}
                        />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>

      <AddEditMemberDialog open={isAddOpen || isEditOpen} onOpenChange={closeDialogs} onSuccess={handleDataMutation} member={selectedMember} />

      {selectedMember && ( <RenewMemberDialog open={isRenewOpen} onOpenChange={closeDialogs} onSuccess={handleDataMutation} member={selectedMember} /> )}

      {receiptPayment && <GymReceiptDialog isOpen={isReceiptOpen} onClose={closeDialogs} payment={receiptPayment} />}

      {paymentToRefund && <GymRefundDialog isOpen={isRefundOpen} onClose={closeDialogs} payment={paymentToRefund} onConfirm={() => confirmRefund(paymentToRefund)} />}

      <SendRemindersDialog
        isOpen={isRemindersOpen}
        onClose={closeDialogs}
        members={reminderList}
        onSendReminder={handleSendReminder}
      />

      <Dialog open={!!actionsMember} onOpenChange={handleCloseActions}>
        <DialogContent>
          {actionsMember && (
            <>
              <DialogHeader>
                  <DialogTitle>{showDeleteConfirm ? 'Confirm Deletion' : `Actions for ${actionsMember.name}`}</DialogTitle>
                  {!showDeleteConfirm && <DialogDescription>{actionsMember.email}</DialogDescription>}
              </DialogHeader>
              {!showDeleteConfirm ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                      <Button variant="outline" asChild>
                          <Link href={`/gym-management/${actionsMember.id}`}><FileText className="mr-2 h-4 w-4" />View Statement</Link>
                      </Button>
                      <Button variant="outline" onClick={() => { handleEdit(actionsMember); handleCloseActions(); }}>
                          <Pencil className="mr-2 h-4 w-4" />Edit Member
                      </Button>
                      <Button variant="outline" onClick={() => { handleRenew(actionsMember); handleCloseActions(); }}>
                          <RefreshCw className="mr-2 h-4 w-4" />Renew
                      </Button>
                      <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                          <Trash2 className="mr-2 h-4 w-4" />Delete Member
                      </Button>
                  </div>
              ) : (
                  <div className="py-4 space-y-4">
                      <DialogDescription>
                          This will permanently delete the member profile for <span className="font-bold">{actionsMember.name}</span>. This action cannot be undone.
                      </DialogDescription>
                      <div>
                          <Label htmlFor="delete-confirm" className="text-destructive font-semibold">Type "{CONFIRM_DELETE_TEXT}" to confirm.</Label>
                          <Input
                              id="delete-confirm"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              autoComplete="off"
                              className="mt-2"
                          />
                      </div>
                  </div>
              )}
              <DialogFooter>
                  {!showDeleteConfirm ? (
                      <Button variant="ghost" onClick={handleCloseActions}>Close</Button>
                  ) : (
                      <>
                          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Go Back</Button>
                          <Button variant="destructive" onClick={confirmDelete} disabled={deleteConfirmText !== CONFIRM_DELETE_TEXT || isDeleting} loading={isDeleting}>
                              Confirm Deletion
                          </Button>
                      </>
                  )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {reminderToConfirm && (
        <AlertDialog open={!!reminderToConfirm} onOpenChange={closeDialogs}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Reminder</AlertDialogTitle>
                    <AlertDialogDescription>
                        You are about to send the following WhatsApp message to <b>{reminderToConfirm.member.name}</b> at <b>{reminderToConfirm.member.phoneNumber}</b>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4 p-4 bg-muted rounded-md text-sm whitespace-pre-wrap">
                    {reminderToConfirm.message}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="copy-phone">Send copy to (optional):</Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="copy-phone"
                            placeholder="Enter phone number"
                            value={copyToPhoneNumber}
                            onChange={(e) => setCopyToPhoneNumber(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
                    <Button onClick={confirmSendReminder} loading={isSending}>
                        Confirm & Send
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

const AuthenticatedGymManagementPage = withAuth(GymManagementPage, PagePermission.MANAGE_GYM_MEMBERS);

export default AuthenticatedGymManagementPage;
