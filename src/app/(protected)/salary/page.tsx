
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, doc, writeBatch, serverTimestamp, where, Timestamp, getDocs, deleteDoc, collectionGroup, orderBy, limit, addDoc } from 'firebase/firestore';
import type { UserProfile, Expense, SalaryDeduction, PaymentMethod, Payment, StockSale, SalonService, StockReturn, Transfer, Booking, SalaryReward } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { Banknote, DollarSign, Wallet, Users, CheckCircle, History, RefreshCw, Undo2, CreditCard, AlertTriangle, Gift, Search, ChevronDown, CalendarIcon, ChevronLeft, ChevronRight, Printer, Trash2 } from 'lucide-react';
import SalaryLoading from './loading';
import { startOfDay, endOfDay, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, subMonths, format, getDaysInMonth, isAfter, eachMonthOfInterval, getYear, getMonth, addMonths, isSameMonth, isToday } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { StatCard } from '@/components/ui/stat-card';
import { DocketStaffDialog } from '@/components/salary/docket-staff-dialog';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { getDocketHistoryColumns } from '@/components/salary/docket-history-columns';
import { ResetDocketsDialog } from '@/components/salary/reset-dockets-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { DocketReceiptDialog } from '@/components/salary/docket-receipt-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RewardStaffDialog } from '@/components/salary/reward-staff-dialog';
import { getRewardHistoryColumns } from '@/components/salary/reward-history-columns';
import { RewardReceiptDialog } from '@/components/salary/reward-receipt-dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


export interface StaffSalaryData {
  profile: UserProfile;
  salary: number;
  isPaid: boolean;
  advances: number;
  rewards: number;
  remainingSalary: number;
  paymentRecordId?: string;
}

function SalaryPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { user: adminUser, userProfile: adminProfile, loading: isAdminProfileLoading } = useUser();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = React.useState(false);
  const [bulkPaymentMethod, setBulkPaymentMethod] = React.useState<string | undefined>();
  const [bulkConfirmationText, setBulkConfirmationText] = React.useState('');

  const [showSingleConfirmation, setShowSingleConfirmation] = React.useState<StaffSalaryData | null>(null);
  const [singlePaymentMethod, setSinglePaymentMethod] = React.useState<string | undefined>();

  const [showReverseConfirmation, setShowReverseConfirmation] = React.useState<StaffSalaryData | null>(null);
  const [staffToDocket, setStaffToDocket] = React.useState<StaffSalaryData | null>(null);
  const [staffToReward, setStaffToReward] = React.useState<StaffSalaryData | null>(null);
  const [staffToReset, setStaffToReset] = React.useState<StaffSalaryData | null>(null);
  const [docketToPrint, setDocketToPrint] = React.useState<SalaryDeduction | null>(null);
  const [actionsDocket, setActionsDocket] = React.useState<SalaryDeduction | null>(null);
  const [showDocketReverseConfirm, setShowDocketReverseConfirm] = React.useState(false);
  const [docketReverseConfirmText, setDocketReverseConfirmText] = React.useState('');
  const CONFIRM_DOCKET_REVERSE_TEXT = "REVERSE";
  const [rewardToPrint, setRewardToPrint] = React.useState<SalaryReward | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [actionsReward, setActionsReward] = React.useState<SalaryReward | null>(null);
  const [showRewardCancelConfirm, setShowRewardCancelConfirm] = React.useState(false);
  const [rewardCancelConfirmText, setRewardCancelConfirmText] = React.useState('');
  const CONFIRM_REWARD_CANCEL_TEXT = "CANCEL REWARD";

  const [allSalaryData, setAllSalaryData] = React.useState<StaffSalaryData[]>([]);
  const [isDataLoading, setIsDataLoading] = React.useState(true);
  const [totalPayout, setTotalPayout] = React.useState(0);
  const [totalPaidSalary, setTotalPaidSalary] = React.useState(0);
  const [totalDocketsCount, setTotalDocketsCount] = React.useState(0);
  const [totalDocketsValue, setTotalDocketsValue] = React.useState(0);
  const [reverseConfirmationText, setReverseConfirmationText] = React.useState('');
  const [displayedMonth, setDisplayedMonth] = React.useState(new Date());

  const [allData, setAllData] = React.useState<{
    allPayments: Payment[];
    allExpenses: Expense[];
    allTransfers: Transfer[];
    allUsers: UserProfile[];
    allBookings: Booking[];
    allStockSales: StockSale[];
    allSalonServices: SalonService[];
  } | null>(null);


  React.useEffect(() => {
    if (!firestore) return;

    const fetchData = async () => {
        const [
            paymentsSnap, expensesSnap, transfersSnap,
            usersSnap,
            bookingsSnap, stockSalesSnap, salonServicesSnap
        ] = await Promise.all([
            getDocs(query(collection(firestore, 'payments'))),
            getDocs(query(collection(firestore, 'expenses'))),
            getDocs(query(collection(firestore, 'transfers'))),
            getDocs(query(collection(firestore, 'users'))),
            getDocs(query(collection(firestore, 'bookings'))),
            getDocs(query(collection(firestore, 'stockSales'))),
            getDocs(query(collection(firestore, 'salonServices'))),
        ]);

        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));

        if (adminProfile && !users.some(u => u.uid === adminProfile.uid)) {
            users.push(adminProfile);
        }

        setAllData({
            allPayments: paymentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Payment),
            allExpenses: expensesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Expense),
            allTransfers: transfersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Transfer),
            allUsers: users,
            allBookings: bookingsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Booking),
            allStockSales: stockSalesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as StockSale),
            allSalonServices: salonServicesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as SalonService),
        });
    }
    fetchData();
  }, [firestore, adminProfile, reloadCounter]);


  const docketHistoryQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collectionGroup(firestore, 'salaryDeductions'), orderBy('date', 'desc'));
  }, [firestore, reloadCounter]);

  const { data: docketHistory, isLoading: isHistoryLoading } = useCollection<SalaryDeduction>(docketHistoryQuery);

  const rewardHistoryQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collectionGroup(firestore, 'salaryRewards'), orderBy('date', 'desc'));
  }, [firestore, reloadCounter]);

  const { data: rewardHistory, isLoading: isRewardHistoryLoading } = useCollection<SalaryReward>(rewardHistoryQuery);

  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const payPeriod = React.useMemo(() => {
    return {
      start: startOfMonth(displayedMonth),
      end: endOfMonth(displayedMonth),
    };
  }, [displayedMonth]);

  const payPeriodLabel = React.useMemo(() => {
      if (!payPeriod) return '';
      return format(payPeriod.start, 'MMMM yyyy');
  }, [payPeriod]);

  const isCurrentPayPeriod = React.useMemo(() => {
    return isSameMonth(displayedMonth, new Date());
  }, [displayedMonth]);

  const accountBalances = React.useMemo(() => {
    const balances = new Map<string, number>();
    if (!allData) return balances;

    const allBookingPayments = (allData.allBookings || [])
        .filter(b => b.paymentMethod && b.status !== 'Refunded' && b.status !== 'Cancelled')
        .map(b => ({
            amount: b.totalAmount || 0,
            date: getSafeDate(b.createdAt)!,
            paymentMethod: b.paymentMethod!,
        }));

    const allAdditionalPayments = (allData.allPayments || []).map(p => ({
        amount: p.amount,
        date: getSafeDate(p.transactionDate)!,
        paymentMethod: p.paymentMethod,
    }));

    const allStockSalesPayments = (allData.allStockSales || [])
      .filter(s => s.paymentStatus === 'Paid')
      .map(s => ({
        amount: s.totalAmount,
        date: getSafeDate(s.soldAt)!,
        paymentMethod: s.paymentMethod,
      }));

    const allSalonServicesPayments = (allData.allSalonServices || [])
      .filter(s => s.paymentStatus === 'Paid')
      .map(s => ({
          amount: s.totalPrice,
          date: getSafeDate(s.createdAt)!,
          paymentMethod: s.paymentMethod,
      }));

    const allIncomeSources = [...allBookingPayments, ...allAdditionalPayments, ...allStockSalesPayments, ...allSalonServicesPayments].filter(p => p.date);

    allIncomeSources.forEach(p => {
      const method = p.paymentMethod;
      if (method) {
        balances.set(method, (balances.get(method) || 0) + p.amount);
      }
    });

    allData.allExpenses.filter(e => e.status !== 'Voided').forEach(expense => {
        const method = expense.paymentMethod;
        balances.set(method, (balances.get(method) || 0) - expense.amount);
    });

    allData.allTransfers.forEach(transfer => {
        balances.set(transfer.fromAccount, (balances.get(transfer.fromAccount) || 0) - transfer.amount);
        balances.set(transfer.toAccount, (balances.get(transfer.toAccount) || 0) + transfer.amount);
    });

    return balances;
  }, [allData]);

  React.useEffect(() => {
    if (!firestore || !allData || !payPeriod) return;
    setIsDataLoading(true);

    const fetchSalaries = async () => {
        try {
            const salaryExpenses = allData.allExpenses.filter(exp =>
                exp.category === 'Salaries' &&
                exp.date &&
                isWithinInterval(getSafeDate(exp.date)!, payPeriod)
            );

            let users: UserProfile[] = allData.allUsers;

            const totalPaid = salaryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            setTotalPaidSalary(totalPaid);

            const isCurrentMonth = isSameMonth(payPeriod.start, new Date());
            const daysInPeriod = isCurrentMonth
              ? new Date().getDate()
              : differenceInDays(payPeriod.end, payPeriod.start) + 1;

            let totalDockets = 0;
            let totalDocketsAmount = 0;

            const staffSalariesPromises = users
                .map(async (user) => {
                    const monthlySalary = user.monthlySalary ?? 0;
                    const rate = monthlySalary > 0 ? monthlySalary / getDaysInMonth(payPeriod.start) : (user.perDayRate ?? settings?.staffPerDayRate ?? 0);

                    const accruedSalary = rate * daysInPeriod;

                    const deductionsQuery = query(
                        collection(firestore, `users/${user.uid}/salaryDeductions`),
                        where('date', '>=', Timestamp.fromDate(payPeriod.start)),
                        where('date', '<=', Timestamp.fromDate(payPeriod.end))
                    );
                    const deductionsSnapshot = await getDocs(deductionsQuery);
                    const advances = deductionsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

                    const rewardsQuery = query(
                        collection(firestore, `users/${user.uid}/salaryRewards`),
                        where('date', '>=', Timestamp.fromDate(payPeriod.start)),
                        where('date', '<=', Timestamp.fromDate(payPeriod.end))
                    );
                    const rewardsSnapshot = await getDocs(rewardsQuery);
                    const rewards = rewardsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);


                    totalDockets += deductionsSnapshot.size;
                    totalDocketsAmount += advances;

                    const paymentRecord = salaryExpenses.find(exp => exp.recordedByUid === user.uid);

                    return {
                        profile: user,
                        salary: accruedSalary,
                        advances: advances,
                        rewards: rewards,
                        remainingSalary: accruedSalary - advances + rewards,
                        isPaid: !!paymentRecord,
                        paymentRecordId: paymentRecord?.id,
                    };
                });

            const salaries = (await Promise.all(staffSalariesPromises))
                .filter(s => s.salary > 0 || s.advances > 0 || s.rewards > 0)
                .sort((a, b) => {
                    if (a.isPaid && !b.isPaid) return 1;
                    if (!a.isPaid && b.isPaid) return -1;
                    return a.profile.name.localeCompare(b.profile.name);
                });

            setAllSalaryData(salaries);
            setTotalPayout(salaries.filter(s => !s.isPaid).reduce((acc, s) => acc + s.remainingSalary, 0));
            setTotalDocketsCount(totalDockets);
            setTotalDocketsValue(totalDocketsAmount);

        } catch (error) {
            console.error("Error fetching salary data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch salary data.' });
        } finally {
            setIsDataLoading(false);
        }
    };

    fetchSalaries();
  }, [firestore, payPeriod, settings, allData, reloadCounter, toast]);


  const filteredSalaryData = React.useMemo(() => {
    if (!searchTerm) return allSalaryData;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return allSalaryData.filter(staff =>
      staff.profile.name.toLowerCase().includes(lowerCaseSearch) ||
      (staff.profile.email && staff.profile.email.toLowerCase().includes(lowerCaseSearch))
    );
  }, [allSalaryData, searchTerm]);

  const filteredDocketHistory = React.useMemo(() => {
    if (!searchTerm) return docketHistory || [];
    const lowerCaseSearch = searchTerm.toLowerCase();
    return (docketHistory || []).filter(docket =>
      docket.userName.toLowerCase().includes(lowerCaseSearch)
    );
  }, [docketHistory, searchTerm]);

  const filteredRewardHistory = React.useMemo(() => {
    if (!searchTerm) return rewardHistory || [];
    const lowerCaseSearch = searchTerm.toLowerCase();
    return (rewardHistory || []).filter(reward =>
      reward.userName && reward.userName.toLowerCase().includes(lowerCaseSearch)
    );
  }, [rewardHistory, searchTerm]);

  const totalRewardsValue = React.useMemo(() => {
    if (!payPeriod) return 0;
    const periodRewards = (rewardHistory || []).filter(reward => {
        const rewardDate = getSafeDate(reward.date);
        return rewardDate && isWithinInterval(rewardDate, payPeriod);
    });
    return periodRewards.reduce((sum, reward) => sum + reward.amount, 0);
  }, [rewardHistory, payPeriod]);


  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const processPayroll = async (staffList: StaffSalaryData[], paymentMethod: string) => {
    if (!firestore || !adminProfile || staffList.length === 0 || !payPeriod) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot process payroll.' });
      return;
    }

    setIsProcessing(true);
    setShowBulkConfirmation(false);
    setShowSingleConfirmation(null);

    try {
        const batch = writeBatch(firestore);

        const transactionDate = payPeriod.end;

        for (const staffData of staffList) {
            if (staffData.remainingSalary <= 0) continue;

            const expenseRef = doc(collection(firestore, 'expenses'));
            batch.set(expenseRef, {
                description: `Salary for ${staffData.profile.name} (${format(payPeriod.start, 'MMM yyyy')})`,
                amount: staffData.remainingSalary,
                category: 'Salaries',
                date: Timestamp.fromDate(transactionDate),
                paymentMethod: paymentMethod,
                status: 'Active',
                recordedBy: adminProfile.name,
                recordedByUid: staffData.profile.uid,
                createdAt: serverTimestamp(),
            });

            const notificationRef = doc(collection(firestore, `users/${staffData.profile.uid}/notifications`));
            const notificationMessage = `Your salary of ${formatCurrency(staffData.remainingSalary)} for the period ending ${format(payPeriod.end, 'MMM d, yyyy')} has been paid.`;
            batch.set(notificationRef, {
                message: notificationMessage,
                notes: `Processed by ${adminProfile.name}`,
                createdAt: serverTimestamp(),
                read: false,
                type: 'SALARY_PAYMENT',
            });
        }

        const totalAmount = staffList.reduce((sum, s) => sum + s.remainingSalary, 0);

        const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        batch.set(auditLogRef, {
            timestamp: serverTimestamp(),
            userId: adminProfile.uid,
            userName: adminProfile.name,
            changeType: 'Create',
            entityType: 'Payroll',
            entityId: `payroll-${Date.now()}`,
            details: `Processed payroll for ${staffList.length} staff member(s), totaling ${formatCurrency(totalAmount)}.`,
        });

        await batch.commit();

        toast({
            variant: 'success',
            title: 'Payroll Processed',
            description: `Successfully processed transactions.`,
        });
        setReloadCounter(c => c + 1);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDocket = async (admin: UserProfile, staffData: StaffSalaryData, amount: number, notes?: string) => {
    if (!firestore || !admin) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot record docket. Admin user not found.' });
        return;
    }

    if (!payPeriod) {
        toast({ variant: 'destructive', title: 'Error', description: 'Pay period not defined.' });
        return;
    }

    setIsProcessing(true);
    setStaffToDocket(null);

    try {
        const batch = writeBatch(firestore);
        const deductionRef = doc(collection(firestore, `users/${staffData.profile.uid}/salaryDeductions`));
        batch.set(deductionRef, {
            amount: amount,
            date: Timestamp.fromDate(payPeriod.end), // Use end of pay period for consistency
            notes: notes || '',
            processedBy: admin.name,
            processedByUid: admin.uid,
            userId: staffData.profile.uid,
            userName: staffData.profile.name,
            id: deductionRef.id
        });

        const notificationRef = doc(collection(firestore, `users/${staffData.profile.uid}/notifications`));
        const notificationMessage = `A salary deduction of ${formatCurrency(amount)} was recorded by ${admin.name}. Reason: ${notes || 'Not specified'}.`;
        batch.set(notificationRef, {
            message: notificationMessage,
            notes: notes || null,
            createdAt: serverTimestamp(),
            read: false,
            type: 'SALARY_DEDUCTION',
            deductionId: deductionRef.id,
        });

        const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        batch.set(auditLogRef, {
            timestamp: serverTimestamp(),
            userId: admin.uid,
            userName: admin.name,
            changeType: 'Create',
            entityType: 'Salary Advance',
            entityId: staffData.profile.uid,
            details: `Recorded salary advance for ${staffData.profile.name}, totaling ${formatCurrency(amount)}.`,
        });

        if (staffData.profile.phoneNumber && settings?.googleAppsScriptUrl) {
            const message = `Dear ${staffData.profile.name},\n\nA salary deduction of ${formatCurrency(amount)} has been processed for you by ${admin.name}. Notes: ${notes || 'N/A'}`;
            await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: staffData.profile.phoneNumber,
                    message,
                    senderName: settings.businessName || 'HR Department',
                    greeting: 'Salary Deduction Notification',
                }),
            });
        }

        await batch.commit();
        toast({
            variant: 'success',
            title: 'Advance Recorded',
            description: `Successfully recorded salary advance for ${staffData.profile.name}.`,
        });
        setReloadCounter(c => c + 1);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleReverseDocket = async () => {
    if (!firestore || !adminProfile || !actionsDocket) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);

        const docketRef = doc(firestore, `users/${actionsDocket.userId}/salaryDeductions`, actionsDocket.id);
        batch.delete(docketRef);

        const notificationsQuery = query(
            collection(firestore, `users/${actionsDocket.userId}/notifications`),
            where('deductionId', '==', actionsDocket.id),
            limit(1)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        if (!notificationsSnapshot.empty) {
            const notificationDoc = notificationsSnapshot.docs[0];
            batch.update(notificationDoc.ref, { status: 'Reversed' });
        }

        const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        batch.set(auditLogRef, {
            timestamp: serverTimestamp(),
            userId: adminProfile.uid,
            userName: adminProfile.name,
            changeType: 'Delete',
            entityType: 'Salary Advance',
            entityId: actionsDocket.userId,
            details: `Reversed salary deduction of ${formatCurrency(actionsDocket.amount)} for ${actionsDocket.userName}.`,
        });

        await batch.commit();
        toast({ variant: 'success', title: 'Deduction Reversed', description: 'The salary deduction has been successfully reversed.' });
        setReloadCounter(c => c + 1);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsProcessing(false);
        setActionsDocket(null);
        setShowDocketReverseConfirm(false);
        setDocketReverseConfirmText('');
    }
};

    const handleConfirmCancelReward = async () => {
        if (!firestore || !adminProfile || !actionsReward) return;

        if (rewardCancelConfirmText !== CONFIRM_REWARD_CANCEL_TEXT) {
            toast({
                variant: 'destructive',
                title: 'Confirmation Failed',
                description: `Please type "${CONFIRM_REWARD_CANCEL_TEXT}" to confirm cancellation.`
            });
            return;
        }

        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const rewardRef = doc(firestore, `users/${actionsReward.userId}/salaryRewards`, actionsReward.id);
            batch.delete(rewardRef);

            const notificationsQuery = query(
                collection(firestore, `users/${actionsReward.userId}/notifications`),
                where('rewardId', '==', actionsReward.id),
                limit(1)
            );
            const notificationsSnapshot = await getDocs(notificationsQuery);
            if (!notificationsSnapshot.empty) {
                const notificationDoc = notificationsSnapshot.docs[0];
                batch.delete(notificationDoc.ref);
            }

            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            batch.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: adminProfile.uid,
                userName: adminProfile.name,
                changeType: 'Delete',
                entityType: 'Reward',
                entityId: actionsReward.userId,
                details: `Cancelled reward of ${formatCurrency(actionsReward.amount)} for ${actionsReward.userName}.`,
            });

            await batch.commit();
            toast({ variant: 'success', title: 'Reward Cancelled', description: 'The reward has been successfully cancelled.' });
            setReloadCounter(c => c + 1);
            handleCloseRewardActions();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetDockets = async (staffData: StaffSalaryData) => {
        if (!firestore || !adminProfile || !payPeriod) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);

            const deductionsQuery = query(
                collection(firestore, `users/${staffData.profile.uid}/salaryDeductions`),
                where('date', '>=', Timestamp.fromDate(payPeriod.start)),
                where('date', '<=', Timestamp.fromDate(payPeriod.end))
            );

            const deductionsSnapshot = await getDocs(deductionsQuery);
            if (deductionsSnapshot.empty) {
                toast({ title: "No deductions to reset.", variant: "default" });
                return;
            }

            deductionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            batch.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: adminProfile.uid,
                userName: adminProfile.name,
                changeType: 'Delete',
                entityType: 'Salary Advance',
                entityId: staffData.profile.uid,
                details: `Reset all salary deductions for ${staffData.profile.name} for the current period.`,
            });

            await batch.commit();
            toast({ variant: 'success', title: 'Deductions Reset', description: `All advances for ${staffData.profile.name} in this period have been cleared.` });
            setReloadCounter(c => c + 1);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsProcessing(false);
            setStaffToReset(null);
        }
    }

    const handleReversePayment = async () => {
        if (!firestore || !showReverseConfirmation || !showReverseConfirmation.paymentRecordId || !adminProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not reverse payment. Record not found.' });
            return;
        }

        setIsProcessing(true);
        const { profile, paymentRecordId, remainingSalary } = showReverseConfirmation;

        try {
            const batch = writeBatch(firestore);

            const expenseRef = doc(firestore, 'expenses', paymentRecordId);
            batch.delete(expenseRef);

            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            batch.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: adminProfile.uid,
                userName: adminProfile.name,
                changeType: 'Delete',
                entityType: 'Payroll',
                entityId: profile.uid,
                details: `Reversed salary payment for ${profile.name}, totaling ${formatCurrency(remainingSalary)}.`,
            });

            await batch.commit();
            toast({ variant: 'success', title: 'Payment Reversed', description: `Salary payment for ${profile.name} has been reversed.` });
            setReloadCounter(c => c + 1);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Reversal Failed', description: error.message });
        } finally {
            setIsProcessing(false);
            setShowReverseConfirmation(null);
            setReverseConfirmationText('');
        }
    };

    const handleReward = async (staffData: StaffSalaryData, amount: number, notes: string) => {
        if (!firestore || !adminProfile) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const rewardRef = doc(collection(firestore, `users/${staffData.profile.uid}/salaryRewards`));
            batch.set(rewardRef, {
                amount,
                notes,
                date: serverTimestamp(),
                processedBy: adminProfile.name,
                processedByUid: adminProfile.uid,
                userId: staffData.profile.uid,
                userName: staffData.profile.name,
                id: rewardRef.id,
            });

            const notificationRef = doc(collection(firestore, `users/${staffData.profile.uid}/notifications`));
            const notificationMessage = `Congratulations! You have received a reward of ${formatCurrency(amount)} from ${adminProfile.name}. Reason: ${notes}`;
            batch.set(notificationRef, {
                message: notificationMessage,
                notes: notes,
                createdAt: serverTimestamp(),
                read: false,
                type: 'REWARD',
                rewardId: rewardRef.id,
            });

            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            batch.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: adminProfile.uid,
                userName: adminProfile.name,
                changeType: 'Create',
                entityType: 'Reward',
                entityId: staffData.profile.uid,
                details: `Gave a reward of ${formatCurrency(amount)} to ${staffData.profile.name}.`,
            });

            await batch.commit();
            toast({ variant: 'success', title: 'Reward Given!', description: `${staffData.profile.name} has been notified of their reward.` });
            setReloadCounter(c => c + 1);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Give Reward', description: error.message });
        } finally {
            setIsProcessing(false);
            setStaffToReward(null);
        }
    };


    const CONFIRM_REVERSE_PHRASE = 'REVERSE PAYMENT';
    const CONFIRM_BULK_PHRASE = 'YES PAY ALL STAFF';


    const docketHistoryColumns = React.useMemo(() => getDocketHistoryColumns({
        currency,
        onActions: setActionsDocket,
    }), [currency]);

    const rewardHistoryColumns = React.useMemo(() => getRewardHistoryColumns({
        currency,
        onActions: setActionsReward,
    }), [currency]);

    const isLoading = isDataLoading || isHistoryLoading || isRewardHistoryLoading || isAdminProfileLoading;

    const handleCloseRewardActions = () => {
        setActionsReward(null);
        setShowRewardCancelConfirm(false);
        setRewardCancelConfirmText('');
    };

  if (isLoading) {
    return <SalaryLoading />;
  }

  const isBulkOverdraft = typeof accountBalances.get(bulkPaymentMethod || '') === 'number' && totalPayout > accountBalances.get(bulkPaymentMethod || '')!;
  const isSingleOverdraft = showSingleConfirmation && typeof accountBalances.get(singlePaymentMethod || '') === 'number' && showSingleConfirmation.remainingSalary > accountBalances.get(singlePaymentMethod || '')!;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Banknote className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Salary / Dockets</h1>
              <p className="text-muted-foreground">
                Review and process staff salaries for the current pay period.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {payPeriodLabel}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={displayedMonth}
                        onSelect={(day) => day && setDisplayedMonth(day)}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={2020}
                        toYear={new Date().getFullYear()}
                    />
                </PopoverContent>
            </Popover>
            <Button onClick={() => setShowBulkConfirmation(true)} disabled={allSalaryData.filter(s => !s.isPaid && s.remainingSalary > 0).length === 0 || isProcessing || isCurrentPayPeriod}>
              <DollarSign className="mr-2 h-4 w-4" />
              Process Payroll ({formatCurrency(totalPayout)})
            </Button>
          </div>
        </div>

         <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Selected Pay Period"
                    value={payPeriodLabel}
                    icon={Wallet}
                    description={isCurrentPayPeriod ? 'This is the current, ongoing pay period.' : `Based on a payday set to the ${settings?.salaryPayday || 28}th of the month.`}
                    className={isCurrentPayPeriod ? 'border-blue-500' : ''}
                />
                 <StatCard
                    title="Total Paid Salary (Period)"
                    value={formatCurrency(totalPaidSalary)}
                    icon={CheckCircle}
                    description={`Sum of salaries already paid out in this period.`}
                    className="border-green-500 text-green-600"
                />
                <StatCard
                    title="Total Payout for Period"
                    value={formatCurrency(totalPayout)}
                    icon={Users}
                    description={`Calculated remaining salary for ${allSalaryData.filter(s => !s.isPaid).length} unpaid staff.`}
                    className="border-yellow-500 text-yellow-600"
                />
                <StatCard
                    title="Total Docket Value (Period)"
                    value={formatCurrency(totalDocketsValue)}
                    icon={DollarSign}
                    description={`Total value of all deductions in this period.`}
                    className="border-destructive text-destructive"
                />
            </div>
            <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Rewards Value (Period)"
                    value={formatCurrency(totalRewardsValue)}
                    icon={Gift}
                    description={`Total value of all bonuses given in this period.`}
                    className="border-green-500 text-green-600"
                />
            </CollapsibleContent>
            <div className="mt-4 flex items-center justify-center">
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                        {isStatsExpanded ? 'Show Less' : 'Show More Stats'}
                        <ChevronDown className={cn('ml-2 h-4 w-4 transition-transform', isStatsExpanded && 'rotate-180')}/>
                    </Button>
                </CollapsibleTrigger>
            </div>
        </Collapsible>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-center mb-4">
                <TabsList className="grid w-fit grid-cols-3">
                    <TabsTrigger value="list">Salary List</TabsTrigger>
                    <TabsTrigger value="dockets">Docket History</TabsTrigger>
                    <TabsTrigger value="rewards">Reward History</TabsTrigger>
                </TabsList>
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                    placeholder="Search by staff name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    />
                </div>
            </div>

            <TabsContent value="list" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Staff Salary List</CardTitle>
                    <CardDescription>
                      The following salaries have been calculated for the current period. {isCurrentPayPeriod && <span className="font-semibold text-yellow-600">Payments are disabled until the period ends.</span>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredSalaryData.length === 0 ? (
                        <EmptyState icon={Users} title="No Staff Found" description="No staff members match your search criteria."/>
                      ) : (
                        filteredSalaryData.map((staffData) => (
                          <div key={staffData.profile.uid} className={cn("flex items-center justify-between p-4 border rounded-lg", staffData.isPaid && "bg-muted/50 opacity-60")}>
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={staffData.profile.photoURL} alt={staffData.profile.name} />
                                <AvatarFallback>{getInitials(staffData.profile.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">{staffData.profile.name}</p>
                                <p className="text-sm text-muted-foreground">{staffData.profile.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    {staffData.isPaid ? (
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle className="h-5 w-5"/>
                                            <span className="font-bold text-lg">Paid</span>
                                        </div>
                                    ) : (
                                      <>
                                        <p className={cn("text-xl font-bold", staffData.remainingSalary < 0 && "text-destructive")}>{formatCurrency(staffData.remainingSalary)}</p>
                                        <p className="text-xs font-semibold text-muted-foreground">
                                            Base: {formatCurrency(staffData.salary)} | Deducted: {formatCurrency(staffData.advances)} | Rewarded: {formatCurrency(staffData.rewards)}
                                        </p>
                                      </>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    {staffData.isPaid ? (
                                        <Button size="sm" variant="destructive" onClick={() => setShowReverseConfirmation(staffData)} disabled={isProcessing}>
                                            <Undo2 className="mr-2 h-4 w-4" /> Reverse Payment
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="default" onClick={() => setShowSingleConfirmation(staffData)} disabled={staffData.remainingSalary <= 0 || isProcessing || isCurrentPayPeriod}>
                                            Pay Salary
                                        </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={() => setStaffToReward(staffData)}
                                      disabled={isProcessing || isLoading || isAdminProfileLoading}
                                      style={{ backgroundImage: 'linear-gradient(to right, #FBBF24, #F59E0B)', color: 'white' }}
                                    >
                                        <Gift className="mr-2 h-4 w-4" />
                                        Reward Staff
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setStaffToDocket(staffData)} disabled={staffData.isPaid || isProcessing || isLoading || isAdminProfileLoading}>
                                        Record Advance/Deduction
                                    </Button>
                                     <Button variant="ghost" size="sm" onClick={() => setStaffToReset(staffData)} disabled={staffData.isPaid || staffData.advances === 0 || isProcessing || isLoading}>
                                        <RefreshCw className="mr-2 h-3 w-3" />
                                        Reset Dockets
                                    </Button>
                                </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="dockets" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Docket History</CardTitle>
                        <CardDescription>A log of all salary advances and deductions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={docketHistoryColumns}
                            data={filteredDocketHistory}
                            filterColumn="userName"
                            filterPlaceholder="Filter by staff name..."
                            tableId="docket-history"
                            emptyStateIcon={History}
                            emptyStateTitle="No Docket History"
                            emptyStateDescription="No salary advances or deductions have been recorded yet."
                        />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="rewards" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Reward History</CardTitle>
                        <CardDescription>A log of all bonuses and rewards given to staff.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={rewardHistoryColumns}
                            data={filteredRewardHistory}
                            filterColumn="userName"
                            filterPlaceholder="Filter by staff name..."
                            tableId="reward-history"
                            emptyStateIcon={Gift}
                            emptyStateTitle="No Reward History"
                            emptyStateDescription="No rewards have been recorded yet."
                        />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showBulkConfirmation} onOpenChange={(open) => {if (!open) {setBulkConfirmationText(''); setBulkPaymentMethod(undefined);} setShowBulkConfirmation(open);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payroll Processing</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to process payroll for <span className="font-bold">{allSalaryData.filter(s => !s.isPaid && s.remainingSalary > 0).length} staff members</span>, totaling <span className="font-bold">{formatCurrency(totalPayout)}</span>.
              This will create expense entries and send WhatsApp notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="bulk-payment-method">Payment Withdrawal Account</Label>
              <Select onValueChange={setBulkPaymentMethod} value={bulkPaymentMethod}>
                  <SelectTrigger id="bulk-payment-method">
                    <SelectValue placeholder="Select an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(accountBalances.keys()).map(method => {
                        const balance = accountBalances.get(method);
                        return (
                          <SelectItem key={method} value={method}>
                            <div className="flex justify-between w-full">
                                <span>{method}</span>
                                {balance !== undefined && (
                                    <span className="font-semibold text-green-600 ml-2">(Bal: {formatCurrency(balance)})</span>
                                )}
                            </div>
                          </SelectItem>
                        )
                    })}
                  </SelectContent>
              </Select>
               {bulkPaymentMethod && isBulkOverdraft && (
                <p className="text-sm font-medium text-destructive flex items-center gap-2 mt-2">
                    <AlertTriangle className="h-4 w-4"/>
                    Amount exceeds selected account balance.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="bulk-pay-confirmation">To confirm, please type "<span className="font-semibold text-destructive">{CONFIRM_BULK_PHRASE}</span>" below.</Label>
              <Input
                  id="bulk-pay-confirmation"
                  value={bulkConfirmationText}
                  onChange={(e) => setBulkConfirmationText(e.target.value)}
                  autoComplete="off"
                  disabled={isProcessing}
                  placeholder={`Type '${CONFIRM_BULK_PHRASE}' to confirm`}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button onClick={() => processPayroll(allSalaryData.filter(s => !s.isPaid && s.remainingSalary > 0), bulkPaymentMethod!)} loading={isProcessing} disabled={isProcessing || bulkConfirmationText !== CONFIRM_BULK_PHRASE || !bulkPaymentMethod || isBulkOverdraft}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Yes, Process Payroll
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showSingleConfirmation} onOpenChange={(open) => {if (!open) setSinglePaymentMethod(undefined); setShowSingleConfirmation(null)}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Salary Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to pay <span className="font-bold">{showSingleConfirmation?.profile.name}</span> the remaining salary of <span className="font-bold">{formatCurrency(showSingleConfirmation?.remainingSalary || 0)}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
           <div className="space-y-2 py-2">
              <Label htmlFor="single-payment-method">Payment Withdrawal Account</Label>
              <Select onValueChange={setSinglePaymentMethod} value={singlePaymentMethod}>
                  <SelectTrigger id="single-payment-method">
                    <SelectValue placeholder="Select an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(accountBalances.keys()).map(method => {
                       const balance = accountBalances.get(method);
                       return (
                          <SelectItem key={method} value={method}>
                              <div className="flex justify-between w-full">
                                <span>{method}</span>
                                {balance !== undefined && (
                                    <span className="font-semibold text-green-600 ml-2">(Bal: {formatCurrency(balance)})</span>
                                )}
                            </div>
                          </SelectItem>
                       )
                    })}
                  </SelectContent>
              </Select>
               {singlePaymentMethod && isSingleOverdraft && (
                <p className="text-sm font-medium text-destructive flex items-center gap-2 mt-2">
                    <AlertTriangle className="h-4 w-4"/>
                    Amount exceeds selected account balance.
                </p>
              )}
            </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button onClick={() => processPayroll([showSingleConfirmation!], singlePaymentMethod!)} loading={isProcessing} disabled={isProcessing || !singlePaymentMethod || isSingleOverdraft}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Yes, Pay Now
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showReverseConfirmation} onOpenChange={(open) => {if(!open) {setShowReverseConfirmation(null); setReverseConfirmationText('');}}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse Salary Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reverse the salary payment for <span className="font-bold">{showReverseConfirmation?.profile.name}</span>? This will delete the associated expense record and mark their salary as unpaid for this period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reverse-confirmation">To confirm, please type "<span className="font-semibold text-destructive">{CONFIRM_REVERSE_PHRASE}</span>" below.</Label>
            <Input
                id="reverse-confirmation"
                value={reverseConfirmationText}
                onChange={(e) => setReverseConfirmationText(e.target.value)}
                autoComplete="off"
                disabled={isProcessing}
                placeholder={`Type '${CONFIRM_REVERSE_PHRASE}' to confirm`}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleReversePayment} loading={isProcessing} disabled={isProcessing || reverseConfirmationText !== CONFIRM_REVERSE_PHRASE}>
                <Undo2 className="mr-2 h-4 w-4" />
                Yes, Reverse Payment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocketStaffDialog
        isOpen={!!staffToDocket}
        onClose={() => setStaffToDocket(null)}
        staffData={staffToDocket}
        onConfirm={handleDocket}
      />

      <RewardStaffDialog
        isOpen={!!staffToReward}
        onClose={() => setStaffToReward(null)}
        staffData={staffToReward}
        onConfirm={handleReward}
      />

      <RewardReceiptDialog
        isOpen={!!rewardToPrint}
        onClose={() => setRewardToPrint(null)}
        reward={rewardToPrint}
      />
      <Dialog open={!!actionsDocket} onOpenChange={(open) => {if (!open) {setActionsDocket(null); setShowDocketReverseConfirm(false); setDocketReverseConfirmText('');}}}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{showDocketReverseConfirm ? 'Confirm Reversal' : 'Actions for Docket'}</DialogTitle>
                <DialogDescription>
                    {showDocketReverseConfirm
                        ? `This will permanently reverse the deduction for ${actionsDocket?.userName}. This action cannot be undone.`
                        : `Docket ID: ${actionsDocket?.id.substring(0,8)}... for ${actionsDocket?.userName}`
                    }
                </DialogDescription>
            </DialogHeader>
            {!showDocketReverseConfirm ? (
                 <div className="grid gap-3 py-4">
                    <Button variant="outline" className="justify-start" onClick={() => { setDocketToPrint(actionsDocket); setActionsDocket(null); }}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print Docket
                    </Button>
                    {actionsDocket?.status !== 'Reversed' && (
                        <Button variant="destructive" className="justify-start" onClick={() => setShowDocketReverseConfirm(true)}>
                            <Undo2 className="mr-2 h-4 w-4" />
                            Reverse Docket
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2 py-4">
                    <Label htmlFor="docket-reverse-confirm">Type "<span className="font-semibold text-destructive">{CONFIRM_DOCKET_REVERSE_TEXT}</span>" to confirm</Label>
                    <Input id="docket-reverse-confirm" value={docketReverseConfirmText} onChange={(e) => setDocketReverseConfirmText(e.target.value)} />
                </div>
            )}
            <DialogFooter>
                {!showDocketReverseConfirm ? (
                    <Button variant="ghost" onClick={() => setActionsDocket(null)}>Close</Button>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => setShowDocketReverseConfirm(false)} disabled={isProcessing}>Go Back</Button>
                        <Button variant="destructive" onClick={handleReverseDocket} loading={isProcessing} disabled={isProcessing || docketReverseConfirmText !== CONFIRM_DOCKET_REVERSE_TEXT}>
                            Confirm Reversal
                        </Button>
                    </>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionsReward} onOpenChange={handleCloseRewardActions}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{showRewardCancelConfirm ? 'Confirm Reward Cancellation' : 'Actions for Reward'}</DialogTitle>
                <DialogDescription>
                    {showRewardCancelConfirm
                        ? `This will permanently cancel the reward for ${actionsReward?.userName}. This action cannot be undone.`
                        : `Reward for ${actionsReward?.userName} of ${formatCurrency(actionsReward?.amount || 0)}`}
                </DialogDescription>
            </DialogHeader>

            {!showRewardCancelConfirm ? (
                <div className="grid gap-3 py-4">
                    <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                            setRewardToPrint(actionsReward);
                            setActionsReward(null);
                        }}
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Print Receipt
                    </Button>
                    <Button
                        variant="destructive"
                        className="justify-start"
                        onClick={() => setShowRewardCancelConfirm(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancel Reward
                    </Button>
                </div>
            ) : (
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reward-cancel-confirm" className="text-destructive font-semibold">
                            Type "{CONFIRM_REWARD_CANCEL_TEXT}" to confirm.
                        </Label>
                        <Input
                            id="reward-cancel-confirm"
                            value={rewardCancelConfirmText}
                            onChange={(e) => setRewardCancelConfirmText(e.target.value)}
                            autoComplete="off"
                            className="mt-2"
                        />
                    </div>
                </div>
            )}

            <DialogFooter>
                {!showRewardCancelConfirm ? (
                    <Button variant="ghost" onClick={handleCloseRewardActions}>Close</Button>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => setShowRewardCancelConfirm(false)} disabled={isProcessing}>Go Back</Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmCancelReward}
                            disabled={rewardCancelConfirmText !== CONFIRM_REWARD_CANCEL_TEXT || isProcessing}
                            loading={isProcessing}
                        >
                            Confirm Cancellation
                        </Button>
                    </>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(SalaryPage, PagePermission.VIEW_ACCOUNTING_PAGE);
