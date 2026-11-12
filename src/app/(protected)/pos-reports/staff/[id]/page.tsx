'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { collection, query } from 'firebase/firestore';
import { ArrowLeft, Banknote, ClipboardList, Package, RotateCcw, Table2 } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useBranch } from '@/contexts/branch-context';
import { useSettings } from '@/contexts/settings-context';
import type { StockSale, StockReturn, HeldSale } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { TopHeader } from '@/components/top-header';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type DetailEvent =
  | { id: string; kind: 'sale'; date: Date | null; reference: string; amount: number; sale: StockSale }
  | { id: string; kind: 'refund'; date: Date | null; reference: string; amount: number; refund: StockReturn }
  | { id: string; kind: 'running'; date: Date | null; reference: string; amount: number; table: HeldSale };

function StaffTransactionBreakdownPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffUid = decodeURIComponent(params.id || '');
  const firestore = useFirestore();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();
  const { settings } = useSettings();

  const initialRange = React.useMemo<DateRange | undefined>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from) return undefined;
    const start = new Date(from + 'T00:00:00');
    const end = new Date((to || from) + 'T00:00:00');
    return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? undefined : { from: start, to: end };
  }, [searchParams]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(initialRange);
  React.useEffect(() => setDateRange(initialRange), [initialRange]);

  const salesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const returnsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockReturns'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const heldQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('heldSales'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const branchSales = useCollection<StockSale>(salesQuery);
  const branchReturns = useCollection<StockReturn>(returnsQuery);
  const branchHeld = useCollection<HeldSale>(heldQuery);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const globalHeld = useGlobalCollectionData<HeldSale>('heldSales', []);
  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const heldTables = isGlobalMode ? globalHeld.data : branchHeld.data;
  const isLoading = isGlobalMode
    ? globalSales.isLoading || globalReturns.isLoading || globalHeld.isLoading
    : branchSales.isLoading || branchReturns.isLoading || branchHeld.isLoading;

  const inRange = React.useCallback((date: Date | null) => {
    if (!date || !dateRange?.from) return true;
    return isWithinInterval(date, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) });
  }, [dateRange]);
  const matchesStaff = React.useCallback((uid: string | undefined, name: string | undefined) => {
    if (staffUid.startsWith('legacy-name:')) return !uid && ('legacy-name:' + (name || 'Unknown staff').trim().toLowerCase()) === staffUid;
    return uid === staffUid;
  }, [staffUid]);
  const staffSales = React.useMemo(() => (sales || []).filter(s => matchesStaff(s.soldByUid, s.soldByName) && inRange(getSafeDate(s.soldAt))), [sales, matchesStaff, inRange]);
  const staffReturns = React.useMemo(() => (returns || []).filter(r => matchesStaff(r.returnedByUid, r.returnedByName) && inRange(getSafeDate(r.returnedAt))), [returns, matchesStaff, inRange]);
  const staffTables = React.useMemo(() => (heldTables || []).filter(t => matchesStaff(t.heldByUid, t.heldByName) && inRange(getSafeDate(t.heldAt))), [heldTables, matchesStaff, inRange]);

  const events = React.useMemo<DetailEvent[]>(() => [
    ...staffSales.map(sale => ({ id: 'sale-' + sale.id, kind: 'sale' as const, date: getSafeDate(sale.soldAt), reference: sale.saleId || sale.id, amount: Number(sale.initialPaymentAmount ?? (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0)), sale })),
    ...staffReturns.map(refund => ({ id: 'refund-' + refund.id, kind: 'refund' as const, date: getSafeDate(refund.returnedAt), reference: refund.refundId || refund.id, amount: Number(refund.totalRefundAmount || 0), refund })),
    ...staffTables.map(table => ({ id: 'running-' + table.id, kind: 'running' as const, date: getSafeDate(table.heldAt), reference: table.name || table.id, amount: (table.cart || []).reduce((sum, item) => sum + Number(item.price ?? item.sellingPrice ?? 0) * Number(item.sellQuantity || 0), 0), table })),
  ].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)), [staffSales, staffReturns, staffTables]);

  const soldUnits = staffSales.reduce((sum, sale) => sum + (sale.items || []).reduce((s, item) => s + Number(item.quantity || 0), 0), 0);
  const income = staffSales.reduce((sum, sale) => sum + Number(sale.initialPaymentAmount ?? (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0)), 0);
  const refunds = staffReturns.reduce((sum, refund) => sum + Number(refund.totalRefundAmount || 0), 0);
  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  const dateQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange?.from) params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
    if (dateRange?.to) params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
    return params.toString();
  }, [dateRange]);
  const backUrl = '/pos-reports' + (dateQuery ? '?' + dateQuery : '');

  const staffName = staffSales[0]?.soldByName || staffReturns[0]?.returnedByName || staffTables[0]?.heldByName || 'Staff member';
  const tableUnits = (table: HeldSale) => (table.cart || []).reduce((sum, item) => sum + Number(item.sellQuantity || 0), 0);

  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <TopHeader name="Staff Transactions Breakdown" icon={<ClipboardList className="h-8 w-8" />} description={isBranchMode ? 'Complete POS activity · ' + (currentBranch?.name || 'Current branch') : 'Detailed sales, refunds and running-table activity for this staff member.'} />
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
        <Button variant="outline" onClick={() => router.push(backUrl)}><ArrowLeft className="mr-2 h-4 w-4" />Back to POS Reports</Button>
      </div>
    </div>

    <Card><CardContent className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Staff member</p><h2 className="text-xl font-bold">{staffName}</h2><p className="text-xs text-muted-foreground">Staff account ID: {staffUid}</p></div>
      <Badge variant="outline">{events.length} activity records</Badge>
    </CardContent></Card>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Income</CardDescription><CardTitle className="text-2xl text-white">{money(income)}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Payments collected from this staff member's sales</CardContent></Card>
      <Card className="border-0 bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Refund</CardDescription><CardTitle className="text-2xl text-white">{money(refunds)}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Refunds processed; shown separately from income</CardContent></Card>
      <Card className="border-0 bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Running Table</CardDescription><CardTitle className="text-3xl text-white">{staffTables.length.toLocaleString()}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Active tables currently held by this staff member</CardContent></Card>
      <Card className="border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Total Sold Item</CardDescription><CardTitle className="text-3xl text-white">{soldUnits.toLocaleString()}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Units in completed sale records</CardContent></Card>
    </div>

    <Card>
      <CardHeader><CardTitle>Transaction History</CardTitle><CardDescription>Every sale, refund and active running table attributed to this staff account in the selected date range.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading staff transactions...</div> : events.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No transactions found for this staff member and date range.</div> :
        <div className="space-y-4">
          {events.map(event => <div key={event.id} className="rounded-xl border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={event.kind === 'sale' ? 'success' : event.kind === 'refund' ? 'destructive' : 'secondary'}>{event.kind === 'sale' ? 'Sale' : event.kind === 'refund' ? 'Refund' : 'Running Table'}</Badge>
                  <span className="font-semibold">{event.reference}</span>
                </div>
                <p className="text-xs text-muted-foreground">{event.date ? format(event.date, 'EEEE, MMMM do, yyyy h:mm a') : 'Date unavailable'}</p>
              </div>
              <p className={'text-lg font-bold tabular-nums ' + (event.kind === 'refund' ? 'text-rose-600' : '')}>{event.kind === 'refund' ? '−' : ''}{money(event.amount)}{event.kind === 'running' ? <span className="block text-xs font-normal text-muted-foreground">Current table value — not completed income</span> : null}</p>
            </div>
            {event.kind === 'sale' && <>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="text-muted-foreground">Customer: </span>{event.sale.customerName || 'Walk-in'}</p>
                <p><span className="text-muted-foreground">Payment: </span>{event.sale.paymentMethod || '—'}</p>
                <p><span className="text-muted-foreground">Status: </span><Badge variant={event.sale.paymentStatus === 'Paid' ? 'success' : 'secondary'}>{event.sale.paymentStatus}</Badge></p>
                <p><span className="text-muted-foreground">Sale total: </span>{money(event.sale.totalAmount)}</p>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-sm"><thead><tr className="bg-muted/40 text-left"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Subtotal</th></tr></thead><tbody>{(event.sale.items || []).map((item, i) => <tr key={item.itemId + '-' + i} className="border-t"><td className="px-3 py-2">{item.itemName}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right">{money(item.sellingPrice)}</td><td className="px-3 py-2 text-right font-medium">{money(item.quantity * item.sellingPrice)}</td></tr>)}</tbody></table></div>
            </>}
            {event.kind === 'refund' && <>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Original sale: </span>{event.refund.originalSaleId}</p><p><span className="text-muted-foreground">Reason: </span>{event.refund.reason || 'Not specified'}</p><p><span className="text-muted-foreground">Refund source: </span>{event.refund.source || 'POS'}</p><p><span className="text-muted-foreground">Customer: </span>{event.refund.customerName || 'Walk-in'}</p></div>
              <div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-sm"><thead><tr className="bg-muted/40 text-left"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Returned qty</th><th className="px-3 py-2 text-right">Refund amount</th></tr></thead><tbody>{(event.refund.items || []).map((item, i) => <tr key={item.itemId + '-' + i} className="border-t"><td className="px-3 py-2">{item.itemName}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right font-medium">{money(item.refundAmount)}</td></tr>)}</tbody></table></div>
              <p className="mt-2 text-xs text-muted-foreground">{event.refund.remainingAmount !== undefined ? 'Remaining sale balance: ' + money(event.refund.remainingAmount) : 'Refund recorded separately; it does not reduce the collected-income figure above.'}</p>
            </>}
            {event.kind === 'running' && <>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p><span className="text-muted-foreground">Customer: </span>{event.table.customer?.name || 'Walk-in'}</p><p><span className="text-muted-foreground">Items: </span>{tableUnits(event.table)}</p><p><span className="text-muted-foreground">Stock reservation: </span>{event.table.stockReserved || event.table.stockReservationMode === 'reserved' ? 'Reserved' : 'Legacy / unknown'}</p></div>
              <div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-sm"><thead><tr className="bg-muted/40 text-left"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Subtotal</th></tr></thead><tbody>{(event.table.cart || []).map((item, i) => { const qty = Number(item.sellQuantity || 0); const price = Number(item.price ?? item.sellingPrice ?? 0); return <tr key={item.id + '-' + i} className="border-t"><td className="px-3 py-2">{item.name}</td><td className="px-3 py-2 text-right">{qty}</td><td className="px-3 py-2 text-right">{money(price)}</td><td className="px-3 py-2 text-right font-medium">{money(qty * price)}</td></tr>; })}</tbody></table></div>
            </>}
          </div>)}
        </div>}
      </CardContent>
    </Card>
  </div>;
}

export default withAuth(StaffTransactionBreakdownPage, PagePermission.VIEW_POS_REPORTS);
