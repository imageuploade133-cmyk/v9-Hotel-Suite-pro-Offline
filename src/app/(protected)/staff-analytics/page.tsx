'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import type { Payment, Booking, StockSale, SalonService, UserProfile, StockReturn } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { TrendingUp, User, DollarSign, Bot, ChevronDown, MessageSquareText, ChevronLeft, ChevronRight } from 'lucide-react';
import { isSameDay, isWithinInterval, startOfDay, endOfDay, format, startOfMonth, endOfMonth, subMonths, differenceInDays } from 'date-fns';
import { getSafeDate, getInitials } from '@/lib/helpers';
import StaffAnalyticsLoading from './loading';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useUser } from '@/contexts/user-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { StatCard } from '@/components/ui/stat-card';
import { TopHeader } from '@/components/top-header';


const PAGE_SIZE = 9;

interface SoldItem {
    name: string;
    quantity: number;
    price: number;
}

interface StaffPerformanceData {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  perDayRate: number;
  daysWorked: number;
  totalIncome: number;
  periodIncome: number;
  salary: number;
  breakdown: {
    total: Record<string, number>;
    period: Record<string, number>;
  };
  totalSoldItems: SoldItem[];
  periodSoldItems: SoldItem[];
}

interface AllData {
    bookings: Booking[];
    payments: Payment[];
    stockSales: StockSale[];
    salonServices: SalonService[];
}

function PaginationControls({ onPrev, onNext, canPrev, canNext, currentPage, totalPages }: { onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean; currentPage: number; totalPages: number; }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Prev
      </Button>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
        Next <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}


function StaffPerformanceCard({ staff, dateRange, currency }: { staff: StaffPerformanceData, dateRange?: DateRange, currency: string }) {

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    const dateQuery = dateRange?.from && dateRange.to ? `?from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}` : '';

    return (
        <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center gap-4 pb-4">
                <Avatar className="h-14 w-14 border-2 border-primary">
                    {staff.photoURL ? (
                        <AvatarImage src={staff.photoURL} alt={staff.name} />
                    ) : (
                         staff.name === 'System' ? <Bot className="h-full w-full p-2"/> : <AvatarFallback className="text-xl">{getInitials(staff.name)}</AvatarFallback>
                    )}
                </Avatar>
                <div>
                    <CardTitle className="text-xl">{staff.name}</CardTitle>
                    {staff.email && <p className="text-sm text-muted-foreground">{staff.email}</p>}
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="grid grid-cols-2 gap-4 text-center">
                     <div className="space-y-1 rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground">INCOME (PERIOD)</p>
                        <p className="text-2xl font-bold">{formatCurrency(staff.periodIncome)}</p>
                    </div>
                     <div className="space-y-1 rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground">SALARY (PERIOD)</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(staff.salary)}</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                 <Button asChild variant="outline" className="w-full">
                  <Link href={`/staff-analytics/${staff.id}${dateQuery}`}>
                    View Full Breakdown
                  </Link>
                </Button>
            </CardFooter>
        </Card>
    )
}

function StaffAnalyticsPage() {
    const firestore = useFirestore();
    const { settings } = useSettings();
    const { user: adminUser, userProfile: adminProfile, loading: isAdminProfileLoading } = useUser();
    const [allData, setAllData] = React.useState<AllData | null>(null);
    const [isLoadingData, setIsLoadingData] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [currentPage, setCurrentPage] = React.useState(1);

    const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(React.useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]));

    React.useEffect(() => {
        if (!firestore) return;

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const [bookingsSnap, paymentsSnap, stockSalesSnap, salonServicesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'bookings'))),
                    getDocs(query(collection(firestore, 'payments'))),
                    getDocs(query(collection(firestore, 'stockSales'))),
                    getDocs(query(collection(firestore, 'salonServices'))),
                ]);

                setAllData({
                    bookings: bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)),
                    payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)),
                    stockSales: stockSalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockSale)),
                    salonServices: salonServicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalonService)),
                });
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [firestore]);


    const { staffPerformanceData, totalPayout, payPeriod } = React.useMemo(() => {
        if (!allData || !users) return { staffPerformanceData: [], totalPayout: 0, payPeriod: { start: new Date(), end: new Date() } };

        const allSystemUsers: UserProfile[] = [...users];
        if (adminProfile && !allSystemUsers.some(u => u.id === adminProfile.id)) {
            allSystemUsers.push(adminProfile);
        }

        const performanceMap: Map<string, StaffPerformanceData> = new Map();

        const payday = settings?.salaryPayday || 28;
        const now = new Date();
        const currentDay = now.getDate();

        let periodStart: Date;
        let periodEnd: Date;

        if (currentDay > payday) {
            periodStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), payday + 1));
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, payday);
            periodEnd = endOfDay(nextMonth);
        } else {
            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, payday + 1);
            periodStart = startOfDay(prevMonth);
            periodEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), payday));
        }

        const dateInterval = dateRange?.from ? { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) } : { start: periodStart, end: periodEnd };
        const daysInPeriod = (differenceInDays(dateInterval.end, dateInterval.start) || 0) + 1;


        allSystemUsers.forEach(u => {
            performanceMap.set(u.id, {
                id: u.id, name: u.name, email: u.email, photoURL: u.photoURL,
                perDayRate: u.perDayRate || settings?.staffPerDayRate || 0,
                daysWorked: daysInPeriod,
                salary: (u.perDayRate || settings?.staffPerDayRate || 0) * daysInPeriod,
                totalIncome: 0, periodIncome: 0,
                breakdown: { total: {}, period: {} },
                totalSoldItems: [], periodSoldItems: []
            });
        });

        performanceMap.set('system', {
            id: 'system', name: 'System', email: 'Automated Transactions', photoURL: '',
            perDayRate: 0, daysWorked: 0, salary: 0,
            totalIncome: 0, periodIncome: 0,
            breakdown: { total: {}, period: {} },
            totalSoldItems: [], periodSoldItems: []
        });

        const userLookupById = new Map(allSystemUsers.map(u => [u.id, u]));
        const userLookupByName = new Map(allSystemUsers.map(u => [u.name, u]));

        const addIncome = (userId: string | null | undefined, userName: string | null | undefined, source: string, amount: number, date: Date | null, items: SoldItem[] = []) => {
            let staffId = 'system';

            if (userId && userLookupById.has(userId)) {
                staffId = userId;
            } else if (userName && userLookupByName.has(userName)) {
                const userFromMap = userLookupByName.get(userName);
                if (userFromMap) {
                    staffId = userFromMap.id;
                }
            }

            const staffData = performanceMap.get(staffId);
            if (!staffData || isNaN(amount) || !date) return;

            staffData.totalIncome += amount;
            staffData.breakdown.total[source] = (staffData.breakdown.total[source] || 0) + amount;

            const isInPeriod = isWithinInterval(date, dateInterval);

            if (isInPeriod) {
                staffData.periodIncome += amount;
                staffData.breakdown.period[source] = (staffData.breakdown.period[source] || 0) + amount;
                 items.forEach(item => {
                    const periodItem = staffData.periodSoldItems.find(i => i.name === item.name);
                    if (periodItem) {
                        periodItem.quantity += item.quantity;
                    } else {
                        staffData.periodSoldItems.push({ ...item });
                    }
                });
            }

            items.forEach(item => {
                const totalItem = staffData.totalSoldItems.find(i => i.name === item.name);
                if (totalItem) {
                    totalItem.quantity += item.quantity;
                } else {
                    staffData.totalSoldItems.push({ ...item });
                }
            });
        };

        allData.bookings.filter(b => b.totalAmount && b.paymentMethod).forEach(b => addIncome(b.createdByUid, b.createdByName, 'Bookings', b.totalAmount!, getSafeDate(b.createdAt)));
        allData.payments.forEach(p => addIncome(p.createdByUid, p.createdByName, 'Payments', p.amount, getSafeDate(p.transactionDate)));
        allData.stockSales.filter(s => s.paymentStatus === 'Paid' || (s.paymentMethod === 'Credit' && s.initialPaymentAmount && s.initialPaymentAmount > 0)).forEach(s => addIncome(s.soldByUid, s.soldByName, 'Stock Sales', s.paymentStatus === 'Paid' ? s.totalAmount : (s.initialPaymentAmount || 0), getSafeDate(s.soldAt), s.items.map(i => ({ name: i.itemName, quantity: i.quantity, price: i.sellingPrice }))));
        allData.salonServices.filter(s => s.paymentStatus === 'Paid').forEach(s => addIncome(s.staffId, s.staffName, 'Salon', s.totalPrice, getSafeDate(s.createdAt)));

        const finalData = Array.from(performanceMap.values()).filter(s => s.totalIncome > 0 || s.salary > 0).sort((a, b) => b.periodIncome - a.periodIncome);
        const payout = finalData.reduce((acc, staff) => acc + staff.salary, 0);

        return { staffPerformanceData: finalData, totalPayout: payout, payPeriod: dateInterval };
    }, [users, adminProfile, allData, dateRange, settings]);

    const paginatedStaff = React.useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return staffPerformanceData.slice(startIndex, startIndex + PAGE_SIZE);
    }, [staffPerformanceData, currentPage]);

    const totalPages = Math.ceil(staffPerformanceData.length / PAGE_SIZE);
    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    const isLoading = areUsersLoading || isLoadingData || isAdminProfileLoading;

    if (isLoading) {
        return <StaffAnalyticsLoading />;
    }

    const chartConfig = {
      periodIncome: { label: dateRange ? 'Period Income' : 'Pay Period Income', color: 'hsl(var(--chart-1))' },
      salary: { label: "Period Salary", color: 'hsl(var(--chart-2))' },
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <TopHeader name="Staff Analytics" icon={<TrendingUp className="h-10 w-10 text-primary" />} description="An overview of staff performance and sales contributions." />
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                    title="Current Pay Period"
                    value={`${format(payPeriod.start, 'MMM d')} - ${format(payPeriod.end, 'MMM d, yyyy')}`}
                    icon={TrendingUp}
                    description={`Based on a payday set to the ${settings?.salaryPayday || 28}th of the month.`}
                />
                 <StatCard
                    title="Total Payout for Period"
                    value={formatCurrency(totalPayout)}
                    icon={DollarSign}
                    description={`Calculated salary for ${staffPerformanceData.length} staff members.`}
                    className="border-yellow-500 text-yellow-600"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Staff Performance Comparison</CardTitle>
                    <CardDescription>
                        Visual comparison of staff income vs. calculated salary for the period.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-80 w-full">
                        <BarChart data={staffPerformanceData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis tickFormatter={(value) => formatCurrency(value as number).replace(currency, '')} />
                            <Tooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number)} />}
                            />
                            <Legend />
                            <Bar dataKey="periodIncome" fill="var(--color-periodIncome)" radius={4} />
                            <Bar dataKey="salary" fill="var(--color-salary)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>


            {paginatedStaff.length === 0 ? (
                <EmptyState icon={User} title="No Staff Data" description="No income has been recorded for any staff member in the selected period." />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedStaff.map(staff => (
                            <StaffPerformanceCard key={staff.id} staff={staff} dateRange={dateRange} currency={currency} />
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPrev={() => setCurrentPage(p => p - 1)}
                            onNext={() => setCurrentPage(p => p + 1)}
                            canPrev={currentPage > 1}
                            canNext={currentPage < totalPages}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default withAuth(StaffAnalyticsPage, PagePermission.VIEW_STAFF_ANALYTICS);
