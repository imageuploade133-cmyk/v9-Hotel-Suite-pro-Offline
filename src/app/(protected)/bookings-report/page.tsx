'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { ArrowRight, CalendarCheck, FileText, Loader2, Printer, Search, Wallet, RotateCcw } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useUser } from '@/contexts/user-context';
import { useFirestore, useCollection } from '@/firebase';
import { useSettings } from '@/contexts/settings-context';
import type { Booking, Bill, Payment, UserProfile } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StaffTotals = {
  uid: string;
  name: string;
  email: string;
  bookingIncome: number;
  billsIncome: number;
  refunds: number;
  grandTotal: number;
  bookings: number;
  checkIns: number;
  checkOuts: number;
  paidBills: number;
  unpaidBills: number;
};

const dateMatches = (value: unknown, range?: DateRange) => {
  const date = getSafeDate(value as any);
  if (!date) return !range?.from;
  if (!range?.from) return true;
  return isWithinInterval(date, { start: startOfDay(range.from), end: endOfDay(range.to || range.from) });
};
const amountOf = (value: unknown) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

function BookingsReportPage() {
  const firestore = useFirestore();
  const { user, userProfile, userMap, permissions } = useUser();
  const { settings } = useSettings();
  const isAdmin = userProfile?.isFirebaseOnlyAdmin === true || userProfile?.isSuperAdmin === true
    || userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin';
  const uid = user?.uid || userProfile?.uid || '';
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [search, setSearch] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [openingStaffUid, setOpeningStaffUid] = React.useState<string | null>(null);
  const pageSize = 10;

  const allBookingsQuery = React.useMemo(() => firestore && isAdmin ? query(collection(firestore, 'bookings')) : null, [firestore, isAdmin]);
  const myCreatedBookingsQuery = React.useMemo(() => firestore && !isAdmin && uid ? query(collection(firestore, 'bookings'), where('createdByUid', '==', uid)) : null, [firestore, isAdmin, uid]);
  const myCheckInBookingsQuery = React.useMemo(() => firestore && !isAdmin && uid ? query(collection(firestore, 'bookings'), where('checkedInByUid', '==', uid)) : null, [firestore, isAdmin, uid]);
  const myCheckOutBookingsQuery = React.useMemo(() => firestore && !isAdmin && uid ? query(collection(firestore, 'bookings'), where('checkedOutByUid', '==', uid)) : null, [firestore, isAdmin, uid]);
  const allPaymentsQuery = React.useMemo(() => firestore && isAdmin ? query(collection(firestore, 'payments')) : null, [firestore, isAdmin]);
  const myPaymentsQuery = React.useMemo(() => firestore && !isAdmin && uid ? query(collection(firestore, 'payments'), where('createdByUid', '==', uid)) : null, [firestore, isAdmin, uid]);
  const allBillsQuery = React.useMemo(() => firestore && isAdmin ? query(collectionGroup(firestore, 'bills')) : null, [firestore, isAdmin]);
  const myBillsQuery = React.useMemo(() => firestore && !isAdmin && uid ? query(collectionGroup(firestore, 'bills'), where('createdBy', '==', uid)) : null, [firestore, isAdmin, uid]);

  const allBookings = useCollection<Booking>(allBookingsQuery);
  const createdBookings = useCollection<Booking>(myCreatedBookingsQuery);
  const checkedInBookings = useCollection<Booking>(myCheckInBookingsQuery);
  const checkedOutBookings = useCollection<Booking>(myCheckOutBookingsQuery);
  const allPayments = useCollection<Payment>(allPaymentsQuery);
  const myPayments = useCollection<Payment>(myPaymentsQuery);
  const allBills = useCollection<Bill>(allBillsQuery);
  const myBills = useCollection<Bill>(myBillsQuery);

  const bookings = React.useMemo(() => {
    const source = isAdmin ? allBookings.data || [] : [...(createdBookings.data || []), ...(checkedInBookings.data || []), ...(checkedOutBookings.data || [])];
    return Array.from(new Map(source.map(item => [item.id, item])).values());
  }, [isAdmin, allBookings.data, createdBookings.data, checkedInBookings.data, checkedOutBookings.data]);
  const payments = isAdmin ? allPayments.data || [] : myPayments.data || [];
  const bills = isAdmin ? allBills.data || [] : myBills.data || [];
  const isLoading = isAdmin
    ? allBookings.isLoading || allPayments.isLoading || allBills.isLoading
    : createdBookings.isLoading || checkedInBookings.isLoading || checkedOutBookings.isLoading || myPayments.isLoading || myBills.isLoading;

  const staffRows = React.useMemo(() => {
    const staff = new Map<string, StaffTotals>();
    const ensure = (staffUid?: string, name?: string) => {
      if (!staffUid) return null;
      if (!staff.has(staffUid)) {
        const profile = userMap.get(staffUid) as UserProfile | undefined;
        staff.set(staffUid, {
          uid: staffUid, name: name || profile?.name || 'Staff member', email: profile?.email || '',
          bookingIncome: 0, billsIncome: 0, refunds: 0, grandTotal: 0,
          bookings: 0, checkIns: 0, checkOuts: 0, paidBills: 0, unpaidBills: 0,
        });
      }
      return staff.get(staffUid)!;
    };
    if (isAdmin) {
      userMap.forEach(profile => {
        if (profile.uid && profile.role && !['Admin', 'Super Admin'].includes(profile.role)) ensure(profile.uid, profile.name);
      });
    } else if (uid) ensure(uid, userProfile?.name);
    const bookingById = new Map(bookings.map(booking => [booking.id, booking]));

    bookings.forEach(booking => {
      if (!dateMatches(booking.createdAt, dateRange) && !dateMatches(booking.cancelledAt, dateRange)
        && !dateMatches(booking.checkInDate, dateRange) && !dateMatches(booking.actualCheckOutDate, dateRange)) return;
      const creator = ensure(booking.createdByUid, booking.createdByName);
      if (creator && booking.createdByUid === creator.uid && dateMatches(booking.createdAt, dateRange)) creator.bookings += 1;
      const checkIn = ensure(booking.checkedInByUid, booking.checkedInByName);
      if (checkIn && dateMatches(booking.checkInDate, dateRange)) checkIn.checkIns += 1;
      const checkOut = ensure(booking.checkedOutByUid, booking.checkedOutByName);
      if (checkOut && dateMatches(booking.actualCheckOutDate, dateRange)) checkOut.checkOuts += 1;
      if (booking.status === 'Refunded' && dateMatches(booking.cancelledAt || booking.refundedAt, dateRange)
        && !(payments || []).some(payment => payment.bookingId === booking.id && payment.status === 'Refunded')) {
        const refundStaff = ensure(booking.cancelledByUid, booking.cancelledByName);
        if (refundStaff) refundStaff.refunds += amountOf(booking.totalAmount ?? booking.amount);
      }
    });

    payments.forEach(payment => {
      if (!dateMatches(payment.transactionDate, dateRange)) return;
      const relatedBooking = payment.bookingId ? bookingById.get(payment.bookingId) : undefined;
      const bookingPayment = payment.type === 'Booking';
      const row = ensure(bookingPayment ? (relatedBooking?.createdByUid || payment.createdByUid) : payment.createdByUid,
        bookingPayment ? (relatedBooking?.createdByName || payment.createdByName) : payment.createdByName);
      if (!row) return;
      if (bookingPayment && payment.status === 'Paid') row.bookingIncome += amountOf(payment.amount);
      if (payment.type === 'Additional Charges' && payment.status === 'Paid') row.billsIncome += amountOf(payment.amount);
      if (payment.status === 'Refunded') {
        row.refunds += amountOf(payment.refundDetails?.amount ?? payment.amount);
      }
    });

    bills.forEach(bill => {
      const billDate = bill.paid ? (bill.paidAt || bill.createdAt) : bill.createdAt;
      if (!dateMatches(billDate, dateRange)) return;
      const row = ensure(bill.createdBy, bill.createdByName);
      if (!row) return;
      if (bill.paid) row.paidBills += 1;
      else row.unpaidBills += 1;
      // Paid revenue comes from the payment ledger above; this bill record only
      // contributes paid/unpaid counts, avoiding double-counting partial payments.
    });

    return Array.from(staff.values()).map(row => ({ ...row, grandTotal: row.bookingIncome + row.billsIncome - row.refunds }))
      .filter(row => isAdmin || row.uid === uid)
      .sort((a, b) => b.grandTotal - a.grandTotal || a.name.localeCompare(b.name));
  }, [isAdmin, userMap, uid, userProfile?.name, bookings, payments, bills, dateRange]);

  const totals = React.useMemo(() => staffRows.reduce((sum, row) => ({
    bookingIncome: sum.bookingIncome + row.bookingIncome,
    billsIncome: sum.billsIncome + row.billsIncome,
    refunds: sum.refunds + row.refunds,
    grandTotal: sum.grandTotal + row.grandTotal,
  }), { bookingIncome: 0, billsIncome: 0, refunds: 0, grandTotal: 0 }), [staffRows]);
  const visibleRows = staffRows.filter(row => (row.name + ' ' + row.email).toLowerCase().includes(search.trim().toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pagedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  React.useEffect(() => setCurrentPage(1), [search, dateRange]);
  React.useEffect(() => setCurrentPage(page => Math.min(page, pageCount)), [pageCount]);
  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  const period = dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') + (dateRange.to ? ' – ' + format(dateRange.to, 'dd MMM yyyy') : '') : 'All dates';

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold tracking-tight">Bookings Report</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? 'All staff booking, check-in, check-out and guest-bill performance.' : 'Your personal booking and guest-bill performance.'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          <Button type="button" variant="outline" onClick={() => { setIsPrinting(true); window.print(); window.setTimeout(() => setIsPrinting(false), 800); }} disabled={isLoading || isPrinting}>{isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}{isPrinting ? "Preparing..." : "Print Summary"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-sky-500/80 via-indigo-500/70 to-cyan-400/80 p-[1.5px] shadow-sm">
          <Card className="h-full border-0 bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Booking Income</CardTitle><CalendarCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold tabular-nums">{money(totals.bookingIncome)}</div><p className="text-xs text-muted-foreground">Paid booking payments</p></CardContent>
          </Card>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500/80 via-fuchsia-500/70 to-indigo-400/80 p-[1.5px] shadow-sm">
          <Card className="h-full border-0 bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Bills Income</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold tabular-nums">{money(totals.billsIncome)}</div><p className="text-xs text-muted-foreground">Paid additional guest bills</p></CardContent>
          </Card>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-rose-500/80 via-orange-500/70 to-amber-400/80 p-[1.5px] shadow-sm">
          <Card className="h-full border-0 bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Refunds</CardTitle><RotateCcw className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold tabular-nums text-destructive">{money(totals.refunds)}</div><p className="text-xs text-muted-foreground">Refunded bookings and bills</p></CardContent>
          </Card>
        </div>
        <div className="rounded-xl">
          <Card className="h-full border-0 bg-primary/10 text-primary shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Grand Total</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent><div className="text-2xl font-bold tabular-nums">{money(totals.grandTotal)}</div><p className="text-xs text-primary/75">Booking + bills − refunds</p></CardContent>
          </Card>
        </div>
      </div>

      <div className="rounded-xl">
      <Card className="border shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>{isAdmin ? 'Staff Booking Performance' : 'My Booking Performance'}</CardTitle><p className="text-sm text-muted-foreground">Report period: {period}</p></div>
          <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search staff..." className="pl-9" /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex items-center justify-center py-14 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading bookings report...</div> :
          visibleRows.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No booking report records found for this period.</div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-3">Staff</th><th className="px-3 py-3 text-right">Booking Income</th><th className="px-3 py-3 text-right">Bills Income</th><th className="px-3 py-3 text-right">Refunds</th><th className="px-3 py-3 text-right">Grand Total</th><th className="px-3 py-3 text-center">Bookings</th><th className="px-3 py-3 text-center">Check-ins</th><th className="px-3 py-3 text-center">Check-outs</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody>{pagedRows.map(row => <tr key={row.uid} className="border-b last:border-0 hover:bg-muted/40">
              <td className="px-3 py-3"><div className="font-semibold">{row.name}</div><div className="text-xs text-muted-foreground">{row.email}</div><div className="mt-1 flex gap-1"><Badge variant="secondary">{row.paidBills} paid bills</Badge><Badge variant="outline">{row.unpaidBills} unpaid</Badge></div></td>
              <td className="px-3 py-3 text-right tabular-nums">{money(row.bookingIncome)}</td><td className="px-3 py-3 text-right tabular-nums">{money(row.billsIncome)}</td><td className="px-3 py-3 text-right tabular-nums text-destructive">{money(row.refunds)}</td><td className="px-3 py-3 text-right font-bold tabular-nums">{money(row.grandTotal)}</td>
              <td className="px-3 py-3 text-center">{row.bookings}</td><td className="px-3 py-3 text-center">{row.checkIns}</td><td className="px-3 py-3 text-center">{row.checkOuts}</td>
              <td className="px-3 py-3 text-right"><Button asChild size="sm" disabled={openingStaffUid === row.uid}><Link href={`/bookings-report/staff/${encodeURIComponent(row.uid)}`} onClick={() => setOpeningStaffUid(row.uid)}>{openingStaffUid === row.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{openingStaffUid === row.uid ? "Opening..." : "View Report"} <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></td>
            </tr>)}</tbody>
          </table></div>}
          {!isLoading && visibleRows.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleRows.length)} of {visibleRows.length} staff records</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>Previous</Button>
              <span className="min-w-20 text-center text-sm tabular-nums">Page {currentPage} of {pageCount}</span>
              <Button type="button" variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}>Next</Button>
            </div>
          </div>}
        </CardContent>
      </Card>
      </div>
      <style jsx global>{`@media print { aside, header, nav, button, input { display: none !important; } main { margin: 0 !important; padding: 0 !important; } body { background: white !important; } }`}</style>
    </div>
  );
}

export default withAuth(BookingsReportPage, PagePermission.VIEW_BOOKINGS_REPORT);
