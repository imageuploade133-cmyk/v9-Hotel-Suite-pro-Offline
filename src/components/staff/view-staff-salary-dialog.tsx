'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { UserProfile, SalaryDeduction, SalaryReward } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useFirestore } from '@/firebase';
import { getInitials, getSafeDate, formatCurrency } from '@/lib/helpers';
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import {
  Wallet,
  Calendar,
  TrendingDown,
  TrendingUp,
  Award,
  Receipt,
  Gift,
  AlertCircle,
  Clock,
  Briefcase,
  DollarSign,
  FileMinus,
  FilePlus,
  ExternalLink,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface StaffSalaryDetails {
  profile: UserProfile;
  monthlySalary: number;
  perDayRate: number;
  daysWorked: number;
  accruedSalary: number;
  totalDockets: number;
  totalRewards: number;
  netPayable: number;
  isPaid: boolean;
  paidAmount: number;
  paymentDate?: Date;
  employmentDuration: {
    years: number;
    months: number;
    days: number;
    text: string;
  };
}

interface ViewStaffSalaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staff: UserProfile | null;
}

export function ViewStaffSalaryDialog({
  isOpen,
  onClose,
  staff,
}: ViewStaffSalaryDialogProps) {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [salaryDetails, setSalaryDetails] = React.useState<StaffSalaryDetails | null>(null);
  const [dockets, setDockets] = React.useState<SalaryDeduction[]>([]);
  const [rewards, setRewards] = React.useState<SalaryReward[]>([]);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [indexUrl, setIndexUrl] = React.useState<string | null>(null);

  const currency = settings?.currency || 'USD';

  const { monthStart, monthEnd, daysInMonth, currentMonth } = React.useMemo(() => {
    const now = new Date();
    return {
      currentMonth: now,
      monthStart: startOfMonth(now),
      monthEnd: endOfMonth(now),
      daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    };
  }, []);

  const extractIndexUrl = (error: any): string | null => {
    if (!error) return null;
    const errorMessage = error.message || String(error);
    const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com\/[^\s'"]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
    if (errorMessage.includes('create an index') || errorMessage.includes('requires an index')) {
      const indexUrl = errorMessage.match(/(https?:\/\/[^\s'"]+)/);
      if (indexUrl) {
        return indexUrl[0];
      }
    }
    return null;
  };

  React.useEffect(() => {
    if (!isOpen || !staff || !firestore) {
      setSalaryDetails(null);
      setDockets([]);
      setRewards([]);
      setIndexUrl(null);
      return;
    }

    let cancelled = false;

    const fetchStaffSalaryData = async () => {
      setIsLoading(true);
      setIndexUrl(null);
      try {
        const now = new Date();
        const joinDate = getSafeDate(staff.createdAt) || now;

        const years = differenceInYears(now, joinDate);
        const months = differenceInMonths(now, joinDate) % 12;
        const days = differenceInDays(now, joinDate) % 30;

        let durationText = '';
        if (years > 0) durationText += `${years} year${years > 1 ? 's' : ''} `;
        if (months > 0) durationText += `${months} month${months > 1 ? 's' : ''} `;
        if (days > 0 || durationText === '') durationText += `${days} day${days > 1 ? 's' : ''}`;

        const monthlySalary = staff.monthlySalary || 0;
        const perDayRate = monthlySalary > 0
          ? monthlySalary / daysInMonth
          : (staff.perDayRate || settings?.staffPerDayRate || 0);

        const daysWorked = Math.min(now.getDate(), daysInMonth);
        const accruedSalary = perDayRate * daysWorked;

        let docketsData: SalaryDeduction[] = [];
        let rewardsData: SalaryReward[] = [];

        try {
          const docketsQuery = query(
            collection(firestore, `users/${staff.uid}/salaryDeductions`),
            where('date', '>=', Timestamp.fromDate(monthStart)),
            where('date', '<=', Timestamp.fromDate(monthEnd)),
            orderBy('date', 'desc')
          );
          const docketsSnap = await getDocs(docketsQuery);
          docketsData = docketsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as SalaryDeduction));
        } catch (docketError: any) {
          const url = extractIndexUrl(docketError);
          if (url && !cancelled) {
            setIndexUrl(url);
          } else {
            const docketsQueryNoOrder = query(
              collection(firestore, `users/${staff.uid}/salaryDeductions`),
              where('date', '>=', Timestamp.fromDate(monthStart)),
              where('date', '<=', Timestamp.fromDate(monthEnd))
            );
            const docketsSnap = await getDocs(docketsQueryNoOrder);
            docketsData = docketsSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            } as SalaryDeduction));
          }
        }

        try {
          const rewardsQuery = query(
            collection(firestore, `users/${staff.uid}/salaryRewards`),
            where('date', '>=', Timestamp.fromDate(monthStart)),
            where('date', '<=', Timestamp.fromDate(monthEnd)),
            orderBy('date', 'desc')
          );
          const rewardsSnap = await getDocs(rewardsQuery);
          rewardsData = rewardsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as SalaryReward));
        } catch (rewardError: any) {
          const url = extractIndexUrl(rewardError);
          if (url && !indexUrl && !cancelled) {
            setIndexUrl(url);
          } else {
            const rewardsQueryNoOrder = query(
              collection(firestore, `users/${staff.uid}/salaryRewards`),
              where('date', '>=', Timestamp.fromDate(monthStart)),
              where('date', '<=', Timestamp.fromDate(monthEnd))
            );
            const rewardsSnap = await getDocs(rewardsQueryNoOrder);
            rewardsData = rewardsSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            } as SalaryReward));
          }
        }

        if (cancelled) return;

        setDockets(docketsData);
        setRewards(rewardsData);

        const totalDockets = docketsData.reduce((sum, d) => sum + d.amount, 0);
        const totalRewards = rewardsData.reduce((sum, r) => sum + r.amount, 0);
        const netPayable = accruedSalary - totalDockets + totalRewards;

        let isPaid = false;
        let paidAmount = 0;
        let paymentDate: Date | undefined;

        try {
          const expensesQuery = query(
            collection(firestore, 'expenses'),
            where('category', '==', 'Salaries'),
            where('recordedByUid', '==', staff.uid),
            where('date', '>=', Timestamp.fromDate(monthStart)),
            where('date', '<=', Timestamp.fromDate(monthEnd))
          );
          const expensesSnap = await getDocs(expensesQuery);
          isPaid = !expensesSnap.empty;
          paidAmount = isPaid
            ? expensesSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0)
            : 0;
          paymentDate = isPaid && expensesSnap.docs[0]
            ? getSafeDate(expensesSnap.docs[0].data().date) ?? undefined
            : undefined;
        } catch (expenseError) {
          console.error('Error fetching expense data:', expenseError);
        }

        if (cancelled) return;

        setSalaryDetails({
          profile: staff,
          monthlySalary,
          perDayRate,
          daysWorked,
          accruedSalary,
          totalDockets,
          totalRewards,
          netPayable,
          isPaid,
          paidAmount,
          paymentDate,
          employmentDuration: {
            years,
            months,
            days,
            text: durationText.trim(),
          },
        });
      } catch (error: any) {
        if (cancelled) return;
        console.error('Error fetching staff salary data:', error);
        const url = extractIndexUrl(error);
        if (url) {
          setIndexUrl(url);
          toast({
            variant: 'destructive',
            title: 'Database Index Required',
            description: 'A Firestore index is required to load salary details. Click the link in the dialog to create it.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load salary details. Please try again.',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchStaffSalaryData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, staff?.uid, firestore, settings?.staffPerDayRate, settings?.currency, monthStart, monthEnd, daysInMonth]);

  const formatDate = (timestamp: any) => {
    const date = getSafeDate(timestamp);
    return date ? format(date, 'MMM d, yyyy') : 'N/A';
  };

  const formatDateTime = (timestamp: any) => {
    const date = getSafeDate(timestamp);
    return date ? format(date, 'MMM d, yyyy h:mm a') : 'N/A';
  };

  if (!staff) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Staff Salary Details
          </DialogTitle>
          <DialogDescription>
            View salary breakdown, dockets, rewards, and employment history for {staff.name}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="px-6 pb-6 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : salaryDetails ? (
          <>
            <div className="px-6 pb-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={staff.photoURL} alt={staff.name} />
                  <AvatarFallback className="text-lg">{getInitials(staff.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{staff.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{staff.role}</span>
                    {staff.shift && (
                      <>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{staff.shift} Shift</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Employed for:</span>
                    <span className="font-medium text-primary">{salaryDetails.employmentDuration.text}</span>
                  </div>
                </div>
                <Badge
                  variant={salaryDetails.isPaid ? 'success' : 'secondary'}
                  className="text-sm px-3 py-1"
                >
                  {salaryDetails.isPaid ? 'Paid' : 'Pending'}
                </Badge>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 px-6">
                <TabsTrigger value="overview">
                  <Wallet className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="dockets">
                  <FileMinus className="h-4 w-4 mr-2" />
                  Dockets ({dockets.length})
                </TabsTrigger>
                <TabsTrigger value="rewards">
                  <FilePlus className="h-4 w-4 mr-2" />
                  Rewards ({rewards.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="max-h-[50vh]">
                <div className="px-6 pb-6 pt-4">
                  <TabsContent value="overview" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(currentMonth, 'MMMM yyyy')} Salary Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Monthly Salary</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(salaryDetails.monthlySalary, currency)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Daily Rate</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(salaryDetails.perDayRate, currency)}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Days Worked</p>
                            <p className="text-lg font-semibold">{salaryDetails.daysWorked} / {daysInMonth}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Accrued Salary</p>
                            <p className="text-lg font-semibold text-blue-600">
                              {formatCurrency(salaryDetails.accruedSalary, currency)}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-red-600">
                              <TrendingDown className="h-4 w-4" />
                              <span className="text-sm">Deductions / Dockets</span>
                            </div>
                            <span className="font-semibold text-red-600">
                              -{formatCurrency(salaryDetails.totalDockets, currency)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-green-600">
                              <TrendingUp className="h-4 w-4" />
                              <span className="text-sm">Rewards / Bonuses</span>
                            </div>
                            <span className="font-semibold text-green-600">
                              +{formatCurrency(salaryDetails.totalRewards, currency)}
                            </span>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                          <span className="font-semibold">Net Payable Amount</span>
                          <span className={`text-2xl font-bold ${salaryDetails.netPayable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(salaryDetails.netPayable, currency)}
                          </span>
                        </div>

                        {salaryDetails.isPaid && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700">
                            <Award className="h-5 w-5" />
                            <div>
                              <p className="font-medium">Salary Paid</p>
                              <p className="text-sm">
                                Amount: {formatCurrency(salaryDetails.paidAmount, currency)}
                                {salaryDetails.paymentDate && ` • Paid on ${format(salaryDetails.paymentDate, 'MMM d, yyyy')}`}
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                          <Receipt className="h-5 w-5 mx-auto mb-2 text-orange-500" />
                          <p className="text-2xl font-bold">{dockets.length}</p>
                          <p className="text-xs text-muted-foreground">Dockets This Month</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                          <Gift className="h-5 w-5 mx-auto mb-2 text-purple-500" />
                          <p className="text-2xl font-bold">{rewards.length}</p>
                          <p className="text-xs text-muted-foreground">Rewards This Month</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                          <DollarSign className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                          <p className="text-2xl font-bold">{formatCurrency(salaryDetails.monthlySalary, currency)}</p>
                          <p className="text-xs text-muted-foreground">Base Salary</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="dockets" className="mt-0">
                    {dockets.length === 0 ? (
                      <EmptyState
                        icon={Receipt}
                        title="No Dockets This Month"
                        description={`${staff.name} has no salary deductions or advances recorded for ${format(currentMonth, 'MMMM yyyy')}.`}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-50">
                          <div className="flex items-center gap-2 text-red-700">
                            <TrendingDown className="h-5 w-5" />
                            <span className="font-medium">Total Deductions</span>
                          </div>
                          <span className="text-xl font-bold text-red-700">
                            {formatCurrency(salaryDetails?.totalDockets || 0, currency)}
                          </span>
                        </div>

                        {dockets.map((docket) => (
                          <Card key={docket.id} className="border-l-4 border-l-red-500">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      {formatDateTime(docket.date)}
                                    </span>
                                  </div>
                                  {docket.notes && (
                                    <p className="text-sm text-muted-foreground">{docket.notes}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Processed by: {docket.processedBy}
                                  </p>
                                </div>
                                <span className="text-lg font-bold text-red-600">
                                  -{formatCurrency(docket.amount, currency)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="rewards" className="mt-0">
                    {rewards.length === 0 ? (
                      <EmptyState
                        icon={Gift}
                        title="No Rewards This Month"
                        description={`${staff.name} has no rewards or bonuses recorded for ${format(currentMonth, 'MMMM yyyy')}.`}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                          <div className="flex items-center gap-2 text-green-700">
                            <TrendingUp className="h-5 w-5" />
                            <span className="font-medium">Total Rewards</span>
                          </div>
                          <span className="text-xl font-bold text-green-700">
                            {formatCurrency(salaryDetails?.totalRewards || 0, currency)}
                          </span>
                        </div>

                        {rewards.map((reward) => (
                          <Card key={reward.id} className="border-l-4 border-l-green-500">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Gift className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      {formatDateTime(reward.date)}
                                    </span>
                                  </div>
                                  {reward.notes && (
                                    <p className="text-sm text-muted-foreground">{reward.notes}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Awarded by: {reward.processedBy}
                                  </p>
                                </div>
                                <span className="text-lg font-bold text-green-600">
                                  +{formatCurrency(reward.amount, currency)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>

            <div className="px-6 pb-6 pt-2">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </>
        ) : (
          <div className="px-6 pb-6">
            <EmptyState
              icon={AlertCircle}
              title={indexUrl ? "Database Index Required" : "Unable to Load Details"}
              description={
                indexUrl
                  ? "This query requires a Firestore index to be created. Click the button below to create the required index in Firebase Console."
                  : "There was a problem loading the salary details. Please try again."
              }
            >
              {indexUrl && (
                <Button
                  variant="default"
                  className="mt-4"
                  onClick={() => window.open(indexUrl, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Create Firestore Index
                </Button>
              )}
            </EmptyState>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
