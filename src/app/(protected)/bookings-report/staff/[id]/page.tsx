'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ArrowLeft, CalendarCheck, CalendarClock, FileText, Loader2, Printer, RotateCcw, Wallet } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useUser } from '@/contexts/user-context';
import { useFirestore, useCollection } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import type { Booking, Bill, Payment } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const safeAmount = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
const within = (value: unknown, range?: DateRange) => {
  const date = getSafeDate(value as any);
  if (!date) return !range?.from;
  return !range?.from || isWithinInterval(date, { start: startOfDay(range.from), end: endOfDay(range.to || range.from) });
};
const dateLabel = (value: unknown) => {
  const date = getSafeDate(value as any);
  return date ? format(date, 'dd MMM yyyy, hh:mm a') : '—';
};

function StaffBookingsReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedUid = decodeURIComponent(params.id || '');
  const { user, userProfile, userMap } = useUser();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const isAdmin = userProfile?.isFirebaseOnlyAdmin === true || userProfile?.isSuperAdmin === true
    || userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin';
  const ownUid = user?.uid || userProfile?.uid || '';
  const authorized = isAdmin || (!!ownUid && requestedUid === ownUid);
  const staff = userMap.get(requestedUid);
  const staffName = staff?.name || (requestedUid === ownUid ? userProfile?.name : undefined) || 'Staff member';
  const initialRange = React.useMemo<DateRange | undefined>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from) return undefined;
    const start = new Date(from + 'T00:00:00');
    const end = new Date((to || from) + 'T00:00:00');
    return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? undefined : { from: start, to: end };
  }, [searchParams]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(initialRange);
  const [printFormat, setPrintFormat] = React.useState<'invoice' | 'terminal'>('invoice');
  React.useEffect(() => setDateRange(initialRange), [initialRange]);
  React.useEffect(() => {
    if (!authorized && ownUid) router.replace('/bookings-report');
  }, [authorized, ownUid, router]);

  const allBookingsQuery = React.useMemo(() => firestore && authorized && isAdmin ? query(collection(firestore, 'bookings')) : null, [firestore, authorized, isAdmin]);
  const createdBookingsQuery = React.useMemo(() => firestore && authorized && !isAdmin ? query(collection(firestore, 'bookings'), where('createdByUid', '==', requestedUid)) : null, [firestore, authorized, isAdmin, requestedUid]);
  const checkInBookingsQuery = React.useMemo(() => firestore && authorized && !isAdmin ? query(collection(firestore, 'bookings'), where('checkedInByUid', '==', requestedUid)) : null, [firestore, authorized, isAdmin, requestedUid]);
  const checkOutBookingsQuery = React.useMemo(() => firestore && authorized && !isAdmin ? query(collection(firestore, 'bookings'), where('checkedOutByUid', '==', requestedUid)) : null, [firestore, authorized, isAdmin, requestedUid]);
  const allPaymentsQuery = React.useMemo(() => firestore && authorized && isAdmin ? query(collection(firestore, 'payments')) : null, [firestore, authorized, isAdmin]);
  const myPaymentsQuery = React.useMemo(() => firestore && authorized && !isAdmin ? query(collection(firestore, 'payments'), where('createdByUid', '==', requestedUid)) : null, [firestore, authorized, isAdmin, requestedUid]);
  const allBillsQuery = React.useMemo(() => firestore && authorized && isAdmin ? query(collectionGroup(firestore, 'bills')) : null, [firestore, authorized, isAdmin]);
  const myBillsQuery = React.useMemo(() => firestore && authorized && !isAdmin ? query(collectionGroup(firestore, 'bills'), where('createdBy', '==', requestedUid)) : null, [firestore, authorized, isAdmin, requestedUid]);

  const allBookings = useCollection<Booking>(allBookingsQuery);
  const createdBookings = useCollection<Booking>(createdBookingsQuery);
  const checkInBookings = useCollection<Booking>(checkInBookingsQuery);
  const checkOutBookings = useCollection<Booking>(checkOutBookingsQuery);
  const allPayments = useCollection<Payment>(allPaymentsQuery);
  const myPayments = useCollection<Payment>(myPaymentsQuery);
  const allBills = useCollection<Bill>(allBillsQuery);
  const myBills = useCollection<Bill>(myBillsQuery);

  const bookings = React.useMemo(() => {
    const source = isAdmin ? allBookings.data || [] : [...(createdBookings.data || []), ...(checkInBookings.data || []), ...(checkOutBookings.data || [])];
    return Array.from(new Map(source.map(item => [item.id, item])).values()).filter(booking =>
      booking.createdByUid === requestedUid || booking.checkedInByUid === requestedUid || booking.checkedOutByUid === requestedUid
    );
  }, [isAdmin, allBookings.data, createdBookings.data, checkInBookings.data, checkOutBookings.data, requestedUid]);
  const payments = (isAdmin ? allPayments.data : myPayments.data) || [];
  const bills = (isAdmin ? allBills.data : myBills.data) || [];
  const loading = !authorized || (isAdmin
    ? allBookings.isLoading || allPayments.isLoading || allBills.isLoading
    : createdBookings.isLoading || checkInBookings.isLoading || checkOutBookings.isLoading || myPayments.isLoading || myBills.isLoading);

  const bookingById = React.useMemo(() => new Map(bookings.map(booking => [booking.id, booking])), [bookings]);
  const bookingPayments = payments.filter(payment => payment.type === 'Booking' && payment.status === 'Paid'
    && within(payment.transactionDate, dateRange)
    && (bookingById.get(payment.bookingId || '')?.createdByUid === requestedUid || payment.createdByUid === requestedUid));
  const billPayments = payments.filter(payment => payment.type === 'Additional Charges' && payment.status === 'Paid'
    && payment.createdByUid === requestedUid && within(payment.transactionDate, dateRange));
  const refundPayments = payments.filter(payment => (payment.status === 'Refunded' || payment.type === 'Refund')
    && payment.createdByUid === requestedUid && within(payment.transactionDate, dateRange));
  const bookingIncome = bookingPayments.reduce((sum, payment) => sum + safeAmount(payment.amount), 0);
  const billsIncome = billPayments.reduce((sum, payment) => sum + safeAmount(payment.amount), 0);
  const bookingRefunds = bookings.filter(booking => booking.cancelledByUid === requestedUid && booking.status === 'Refunded'
    && within(booking.cancelledAt || booking.refundedAt, dateRange))
    .reduce((sum, booking) => sum + safeAmount(booking.totalAmount ?? booking.amount), 0);
  const refunds = refundPayments.reduce((sum, payment) => sum + safeAmount(payment.refundDetails?.amount ?? payment.amount), 0) + bookingRefunds;
  const grandTotal = bookingIncome + billsIncome - refunds;
  const reportBookings = bookings.filter(booking =>
    (booking.createdByUid === requestedUid && within(booking.createdAt, dateRange))
    || (booking.checkedInByUid === requestedUid && within(booking.checkInDate, dateRange))
    || (booking.checkedOutByUid === requestedUid && within(booking.actualCheckOutDate, dateRange))
  ).sort((a,b) => (getSafeDate(b.createdAt)?.getTime() || 0) - (getSafeDate(a.createdAt)?.getTime() || 0));
  const reportBills = bills.filter(bill => bill.createdBy === requestedUid && within(bill.createdAt, dateRange))
    .sort((a,b) => (getSafeDate(b.createdAt)?.getTime() || 0) - (getSafeDate(a.createdAt)?.getTime() || 0));
  const paidBills = reportBills.filter(bill => bill.paid);
  const unpaidBills = reportBills.filter(bill => !bill.paid);
  const checkIns = reportBookings.filter(booking => booking.checkedInByUid === requestedUid && within(booking.checkInDate, dateRange));
  const checkOuts = reportBookings.filter(booking => booking.checkedOutByUid === requestedUid && within(booking.actualCheckOutDate, dateRange));
  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  const period = dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') + (dateRange.to ? ' – ' + format(dateRange.to, 'dd MMM yyyy') : '') : 'All dates';
  const printNow = () => window.print();

  if (!authorized) return <div className="p-8 text-center text-muted-foreground">Checking report access…</div>;

  return (
    <div className={`space-y-6 p-2 ${printFormat === 'terminal' ? 'bookings-terminal' : 'bookings-invoice'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3"><Button variant="outline" size="icon" asChild><Link href="/bookings-report"><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-2xl font-bold">Staff Bookings Report</h1><p className="text-sm text-muted-foreground">{staffName} · {period}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><DateRangePicker date={dateRange} onDateChange={setDateRange} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={printFormat} onChange={e => setPrintFormat(e.target.value as 'invoice' | 'terminal')}><option value="invoice">Invoice print</option><option value="terminal">Terminal print</option></select><Button onClick={printNow} disabled={loading}><Printer className="mr-2 h-4 w-4" />Print Report</Button></div>
      </div>
      <div className="hidden print:block"><h1 className="text-2xl font-bold">{settings?.businessName || 'Hotel'} — Bookings Report</h1><p>{staffName} · {period} · Printed {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Booking Income</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(bookingIncome)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Bills Income</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(billsIncome)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Refunds</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{money(refunds)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Grand Total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(grandTotal)}</CardContent></Card>
      </div>
      {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading staff report…</div> : <>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" />Booking and stay activity</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><div><p className="text-xs text-muted-foreground">Bookings created</p><p className="text-2xl font-semibold">{reportBookings.filter(b => b.createdByUid === requestedUid && within(b.createdAt,dateRange)).length}</p></div><div><p className="text-xs text-muted-foreground">Check-ins</p><p className="text-2xl font-semibold">{checkIns.length}</p></div><div><p className="text-xs text-muted-foreground">Check-outs</p><p className="text-2xl font-semibold">{checkOuts.length}</p></div><div><p className="text-xs text-muted-foreground">Reservations</p><p className="text-2xl font-semibold">{reportBookings.filter(b => ['Booked','Reserved'].includes(b.status)).length}</p></div></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Booking transactions</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Guest / Booking</th><th className="p-2">Room</th><th className="p-2">Created</th><th className="p-2">Check-in</th><th className="p-2">Check-out</th><th className="p-2">Status</th><th className="p-2 text-right">Booking value</th></tr></thead><tbody>{reportBookings.map(booking=><tr key={booking.id} className="border-b"><td className="p-2"><div className="font-medium">{booking.guestName}</div><div className="text-xs text-muted-foreground">{booking.bookingId || booking.id}</div></td><td className="p-2">{booking.roomNumber || '—'}</td><td className="p-2">{dateLabel(booking.createdAt)}</td><td className="p-2">{booking.checkedInByUid === requestedUid ? dateLabel(booking.checkInDate) : '—'}</td><td className="p-2">{booking.checkedOutByUid === requestedUid ? dateLabel(booking.actualCheckOutDate) : '—'}</td><td className="p-2"><Badge variant={booking.status === 'Cancelled' || booking.status === 'Refunded' ? 'destructive' : 'secondary'}>{booking.status}</Badge></td><td className="p-2 text-right">{money(safeAmount(booking.totalAmount ?? booking.amount))}</td></tr>)}{reportBookings.length===0&&<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No bookings in this period.</td></tr>}</tbody></table></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Guest additional bills</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[750px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Bill / Booking</th><th className="p-2">Created</th><th className="p-2">Items</th><th className="p-2">Payment status</th><th className="p-2 text-right">Bill total</th></tr></thead><tbody>{reportBills.map(bill=><tr key={bill.id} className="border-b"><td className="p-2"><div className="font-medium">{bill.id}</div><div className="text-xs text-muted-foreground">{bill.bookingId}</div></td><td className="p-2">{dateLabel(bill.createdAt)}</td><td className="p-2">{(bill.items||[]).map(item=>item.name+' × '+item.quantity).join(', ') || '—'}</td><td className="p-2"><Badge variant={bill.paid?'secondary':'destructive'}>{bill.paid?'Paid':'Unpaid'}</Badge></td><td className="p-2 text-right">{money(safeAmount(bill.total))}</td></tr>)}{reportBills.length===0&&<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No additional bills in this period.</td></tr>}</tbody></table></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Payment and refund ledger</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Guest</th><th className="p-2">Method</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{payments.filter(payment=>payment.createdByUid===requestedUid && within(payment.transactionDate,dateRange)).map(payment=><tr key={payment.id} className="border-b"><td className="p-2">{dateLabel(payment.transactionDate)}</td><td className="p-2">{payment.type}</td><td className="p-2">{payment.guestName || '—'}</td><td className="p-2">{payment.paymentMethod || '—'}</td><td className="p-2"><Badge variant={payment.status==='Paid'?'secondary':payment.status==='Refunded'?'destructive':'outline'}>{payment.status}</Badge></td><td className="p-2 text-right">{money(safeAmount(payment.amount))}</td></tr>)}{payments.filter(payment=>payment.createdByUid===requestedUid && within(payment.transactionDate,dateRange)).length===0&&<tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payments in this period.</td></tr>}</tbody></table></div></CardContent></Card>
      </>}
      <style jsx global>{`@media print { @page { size: auto; margin: 12mm; } body { background: white !important; color: black !important; } aside, nav, header, button, select { display: none !important; } .bookings-terminal { font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important; font-size: 10px !important; } .bookings-terminal table { font-size: 9px !important; } .bookings-terminal .rounded-xl, .bookings-terminal .rounded-lg { border-radius: 0 !important; } .bookings-invoice { font-family: Arial, sans-serif !important; } .bookings-invoice .shadow, .bookings-invoice .shadow-sm { box-shadow: none !important; } .bookings-invoice table { page-break-inside: auto; } tr { page-break-inside: avoid; } }`}</style>
    </div>
  );
}

export default withAuth(StaffBookingsReportPage, PagePermission.VIEW_BOOKINGS_REPORT);
