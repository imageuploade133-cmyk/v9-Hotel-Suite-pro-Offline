
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Payment, Booking, StockSale, SalonService, UserProfile, StockReturn } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { TrendingUp, User, DollarSign, Bot, ArrowLeft, Printer, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { isSameDay, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { getSafeDate, getInitials } from '@/lib/helpers';
import StaffAnalyticsDetailsLoading from './loading';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { SalonReceiptDialog } from '@/components/salon/salon-receipt-dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { useUser } from '@/contexts/user-context';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const HISTORY_PAGE_SIZE = 10;

type Transaction = (StockSale | Payment | SalonService) & { transactionType: 'Sale' | 'Payment' | 'Salon' };

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
  totalIncome: number;
  periodIncome: number;
  breakdown: {
    total: Record<string, number>;
    period: Record<string, number>;
  };
  totalSoldItems: SoldItem[];
  periodSoldItems: SoldItem[];
  transactions: Transaction[];
}

interface AllData {
    bookings: Booking[];
    payments: Payment[];
    stockSales: StockSale[];
    salonServices: SalonService[];
    users: UserProfile[];
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

function StaffAnalyticsDetailsPage({ staffId, initialAllData, initialStaffData }) {
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();

    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
        fromParam && toParam ? { from: new Date(fromParam), to: new Date(toParam) } : undefined
    );

    const { settings } = useSettings();

    const [allData, setAllData] = React.useState<AllData | null>(initialAllData);
    const [staffData, setStaffData] = React.useState<UserProfile | null>(initialStaffData);
    const [isLoading, setIsLoading] = React.useState(true);

    const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
    const [bookingPaymentToPrint, setBookingPaymentToPrint] = React.useState<Payment | null>(null);
    const [salonOrderToPrint, setSalonOrderToPrint] = React.useState<SalonService | null>(null);
    const [historyPage, setHistoryPage] = React.useState(1);

    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    React.useEffect(() => {
        if (!firestore || !staffId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const staffDocRef = doc(firestore, 'users', staffId);
                const staffDocSnap = await getDoc(staffDocRef);

                if (!staffDocSnap.exists()) {
                    setStaffData(null); // Or handle error
                    return;
                }
                const fetchedStaffData = { id: staffDocSnap.id, ...staffDocSnap.data() } as UserProfile;
                setStaffData(fetchedStaffData);

                const [bookingsSnap, paymentsSnap, stockSalesSnap, salonServicesSnap, usersSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'bookings'))),
                    getDocs(query(collection(firestore, 'payments'))),
                    getDocs(query(collection(firestore, 'stockSales'))),
                    getDocs(query(collection(firestore, 'salonServices'))),
                    getDocs(query(collection(firestore, 'users'))),
                ]);

                setAllData({
                    bookings: bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)),
                    payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)),
                    stockSales: stockSalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockSale)),
                    salonServices: salonServicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalonService)),
                    users: usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)),
                });

            } catch (error) {
                console.error("Failed to fetch performance data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [firestore, staffId]);

    const staffPerformanceData = React.useMemo((): StaffPerformanceData | null => {
        if (!allData || !staffData) return null;

        const performanceData: StaffPerformanceData = {
            id: staffData.uid, name: staffData.name, email: staffData.email, photoURL: (staffData as any).photoURL,
            totalIncome: 0, periodIncome: 0,
            breakdown: { total: {}, period: {} },
            totalSoldItems: [], periodSoldItems: [],
            transactions: [],
        };

        const addIncome = (userId: string | null | undefined, userName: string | null | undefined, source: string, amount: number, date: Date | null, transactionRecord: Transaction, items: SoldItem[] = []) => {
            let isMatch = false;
            if (staffData.uid === 'system' && !userId && (!userName || userName === 'System')) {
                isMatch = true;
            } else if (userId && userId === staffData.uid) {
                isMatch = true;
            } else if (userName && userName === staffData.name) {
                isMatch = true;
            }

            if (!isMatch || isNaN(amount) || !date) return;

            performanceData.totalIncome += amount;
            performanceData.breakdown.total[source] = (performanceData.breakdown.total[source] || 0) + amount;

            const interval = dateRange?.from ? { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) } : null;
            const isInPeriod = interval ? isWithinInterval(date, interval) : isSameDay(date, new Date());

            if (!interval || isInPeriod) {
                 performanceData.transactions.push(transactionRecord);
            }


            if (isInPeriod) {
                performanceData.periodIncome += amount;
                performanceData.breakdown.period[source] = (performanceData.breakdown.period[source] || 0) + amount;
                 items.forEach(item => {
                    const periodItem = performanceData.periodSoldItems.find(i => i.name === item.name);
                    if (periodItem) {
                        periodItem.quantity += item.quantity;
                    } else {
                        performanceData.periodSoldItems.push({ ...item });
                    }
                });
            }

            items.forEach(item => {
                const totalItem = performanceData.totalSoldItems.find(i => i.name === item.name);
                if (totalItem) {
                    totalItem.quantity += item.quantity;
                } else {
                    performanceData.totalSoldItems.push({ ...item });
                }
            });
        };

        allData.bookings.filter(b => b.totalAmount && b.paymentMethod).forEach(b => addIncome(b.createdByUid, b.createdByName, 'Bookings', b.totalAmount!, getSafeDate(b.createdAt), { ...b, transactionType: 'Payment' }));
        allData.payments.forEach(p => addIncome(p.createdByUid, p.createdByName, 'Payments', p.amount, getSafeDate(p.transactionDate), { ...p, transactionType: 'Payment' }));
        allData.stockSales.filter(s => s.paymentStatus === 'Paid' || (s.paymentMethod === 'Credit' && s.initialPaymentAmount && s.initialPaymentAmount > 0)).forEach(s => addIncome(s.soldByUid, s.soldByName, 'Stock Sales', s.paymentStatus === 'Paid' ? s.totalAmount : (s.initialPaymentAmount || 0), getSafeDate(s.soldAt), { ...s, transactionType: 'Sale' }, s.items.map(i => ({ name: i.itemName, quantity: i.quantity, price: i.sellingPrice }))));
        allData.salonServices.filter(s => s.paymentStatus === 'Paid').forEach(s => addIncome(s.staffId, s.staffName, 'Salon', s.totalPrice, getSafeDate(s.createdAt), { ...s, transactionType: 'Salon' }));

        performanceData.transactions.sort((a,b) => {
            const dateA = getSafeDate((a as any).soldAt || (a as any).transactionDate || (a as any).createdAt)!;
            const dateB = getSafeDate((b as any).soldAt || (b as any).transactionDate || (b as any).createdAt)!;
            return dateB.getTime() - dateA.getTime();
        });


        return performanceData;
    }, [staffData, allData, dateRange]);

    React.useEffect(() => {
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        if (from && to) {
            setDateRange({ from: new Date(from), to: new Date(to) });
        }
    }, [searchParams]);

    const paginatedTransactions = React.useMemo(() => {
        if (!staffPerformanceData) return [];
        const startIndex = (historyPage - 1) * HISTORY_PAGE_SIZE;
        return staffPerformanceData.transactions.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
    }, [staffPerformanceData, historyPage]);

    const historyTotalPages = staffPerformanceData ? Math.ceil(staffPerformanceData.transactions.length / HISTORY_PAGE_SIZE) : 0;

    if (isLoading) {
        return <StaffAnalyticsDetailsLoading />;
    }

    if (!staffPerformanceData) {
        return <div className="text-center py-10">Staff member not found.</div>
    }

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => router.back()} className="-ml-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Staff Analytics
                    </Button>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                </div>
                <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 border-4 border-primary">
                        {staffPerformanceData.photoURL ? (
                            <AvatarImage src={staffPerformanceData.photoURL} alt={staffPerformanceData.name} />
                        ) : (
                            staffPerformanceData.name === 'System' ? <Bot className="h-full w-full p-2"/> : <AvatarFallback className="text-3xl">{getInitials(staffPerformanceData.name)}</AvatarFallback>
                        )}
                    </Avatar>
                    <div>
                        <h1 className="text-4xl font-bold">{staffPerformanceData.name}</h1>
                        {staffPerformanceData.email && <p className="text-lg text-muted-foreground">{staffPerformanceData.email}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle>Total Income (All-Time)</CardTitle></CardHeader>
                        <CardContent><p className="text-4xl font-bold text-primary">{formatCurrency(staffPerformanceData.totalIncome)}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>{dateRange ? 'Period Income' : "Today's Income"}</CardTitle></CardHeader>
                        <CardContent><p className="text-4xl font-bold">{formatCurrency(staffPerformanceData.periodIncome)}</p></CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="p-4">
                        <Tabs defaultValue="breakdown">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="breakdown">Income Breakdown</TabsTrigger>
                                <TabsTrigger value="items">Sold Items</TabsTrigger>
                                <TabsTrigger value="history">Transaction History</TabsTrigger>
                            </TabsList>
                            <TabsContent value="breakdown" className="mt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-2 text-center">All-Time Breakdown</h4>
                                        <div className="space-y-2 rounded-md border p-4">
                                            {Object.keys(staffPerformanceData.breakdown.total).length > 0 ? Object.entries(staffPerformanceData.breakdown.total).map(([source, amount]) => (
                                                <div key={source} className="flex justify-between">
                                                    <span className="text-muted-foreground">{source}:</span>
                                                    <span className="font-semibold">{formatCurrency(amount)}</span>
                                                </div>
                                            )) : <p className="text-center text-xs text-muted-foreground py-4">No income recorded.</p>}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2 text-center">{dateRange ? 'Period Breakdown' : "Today's Breakdown"}</h4>
                                        <div className="space-y-2 rounded-md border p-4">
                                            {Object.keys(staffPerformanceData.breakdown.period).length > 0 ? Object.entries(staffPerformanceData.breakdown.period).map(([source, amount]) => (
                                                <div key={source} className="flex justify-between">
                                                    <span className="text-muted-foreground">{source}:</span>
                                                    <span className="font-semibold">{formatCurrency(amount)}</span>
                                                </div>
                                            )) : <p className="text-center text-xs text-muted-foreground py-4">No income recorded in this period.</p>}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="items" className="mt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-2">{dateRange ? "Period's Sold Items" : "Today's Sold Items"} ({staffPerformanceData.periodSoldItems.reduce((sum, i) => sum + i.quantity, 0)} total)</h4>
                                        {staffPerformanceData.periodSoldItems.length > 0 ? (
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {staffPerformanceData.periodSoldItems.map((item, index) => (
                                                        <TableRow key={index}><TableCell>{item.name}</TableCell><TableCell className="text-center">{item.quantity}</TableCell><TableCell className="text-right">{formatCurrency(item.price)}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : <p className="text-xs text-muted-foreground text-center py-4">No items sold in this period.</p>}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">All-Time Sold Items ({staffPerformanceData.totalSoldItems.reduce((sum, i) => sum + i.quantity, 0)} total)</h4>
                                        {staffPerformanceData.totalSoldItems.length > 0 ? (
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {staffPerformanceData.totalSoldItems.map((item, index) => (
                                                        <TableRow key={index}><TableCell>{item.name}</TableCell><TableCell className="text-center">{item.quantity}</TableCell><TableCell className="text-right">{formatCurrency(item.price)}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : <p className="text-xs text-muted-foreground text-center py-4">No items sold overall.</p>}
                                    </div>
                                </div>
                            </TabsContent>
                             <TabsContent value="history" className="mt-4">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedTransactions.map((t) => {
                                    const date = getSafeDate((t as any).soldAt || (t as any).transactionDate || (t as any).createdAt)!;
                                    let details: string, amount: number;

                                    switch(t.transactionType) {
                                        case 'Sale':
                                            const sale = t as StockSale;
                                            details = `${sale.customerName} - ${sale.items.length} item(s)`;
                                            amount = sale.totalAmount;
                                            break;
                                        case 'Payment':
                                            const payment = t as Payment;
                                            details = `${payment.guestName} - ${payment.type}`;
                                            amount = payment.amount;
                                            break;
                                        case 'Salon':
                                            const salon = t as SalonService;
                                            details = `${salon.customerName} - ${(salon as any).items.length} service(s)`;
                                            amount = salon.totalPrice;
                                            break;
                                        default:
                                            details = "Unknown";
                                            amount = 0;
                                    }
                                    return (
                                        <TableRow key={t.id}>
                                        <TableCell>{format(date, 'PPp')}</TableCell>
                                        <TableCell>{t.transactionType}</TableCell>
                                        <TableCell>{details}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(amount)}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        if (t.transactionType === 'Sale') setSaleToPrint(t as StockSale);
                                                        if (t.transactionType === 'Payment') setBookingPaymentToPrint(t as Payment);
                                                        if (t.transactionType === 'Salon') setSalonOrderToPrint(t as SalonService);
                                                    }}
                                                >
                                                <Printer className="mr-2 h-4 w-4" /> Reprint Receipt
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        </TableRow>
                                    );
                                    })}
                                </TableBody>
                                </Table>
                                {historyTotalPages > 1 && (
                                    <PaginationControls
                                        currentPage={historyPage}
                                        totalPages={historyTotalPages}
                                        onPrev={() => setHistoryPage(p => p - 1)}
                                        onNext={() => setHistoryPage(p => p + 1)}
                                        canPrev={historyPage > 1}
                                        canNext={historyPage < historyTotalPages}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            <StockSaleReceiptDialog isOpen={!!saleToPrint} onClose={() => setSaleToPrint(null)} sale={saleToPrint} allUsers={allData?.users || []} />
            <ReprintReceiptDialog isOpen={!!bookingPaymentToPrint} onClose={() => setBookingPaymentToPrint(null)} payment={bookingPaymentToPrint} allUsers={allData?.users || []} />
            <SalonReceiptDialog isOpen={!!salonOrderToPrint} onClose={() => setSalonOrderToPrint(null)} order={salonOrderToPrint} allUsers={allData?.users || []} />
        </>
    );
}

export default withAuth(StaffAnalyticsDetailsPage, PagePermission.VIEW_STAFF_ANALYTICS);

