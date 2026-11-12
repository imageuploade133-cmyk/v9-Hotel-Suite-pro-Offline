'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { collection, query } from 'firebase/firestore';
import { ArrowLeft, ClipboardList, Printer } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
  const { settings, getEffectivePosSettings } = useSettings();
  const posSettings = React.useMemo(() => getEffectivePosSettings('pos'), [getEffectivePosSettings]);
  const receiptLogoUrl = posSettings.posUseBusinessLogo !== false
    ? (currentBranch?.logoUrl || settings?.businessLogoUrl || '')
    : (posSettings.posReceiptLogoUrl || currentBranch?.logoUrl || settings?.businessLogoUrl || '');
  const showBusinessName = posSettings.posShowBusinessName ?? true;
  const showAddress = posSettings.posShowAddress ?? true;
  const showPhone = posSettings.posShowPhone ?? true;
  const showEmail = posSettings.posShowEmail ?? false;

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
    ...staffTables.map(table => ({ id: 'running-' + table.id, kind: 'running' as const, date: getSafeDate(table.heldAt), reference: table.name || table.id, amount: (table.cart || []).reduce((sum, item) => sum + Number(item.price || item.sellingPrice || 0) * Math.max(0, Number(item.sellQuantity || 0)), 0), table })),
  ].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)), [staffSales, staffReturns, staffTables]);


  const [printFormat, setPrintFormat] = React.useState<'invoice' | 'terminal'>('invoice');
  const [includeTransactionList, setIncludeTransactionList] = React.useState(true);
  const [includeItemDetails, setIncludeItemDetails] = React.useState(true);
  const runningTableTotal = staffTables.reduce((sum, table) => sum + (table.cart || []).reduce((sub, item) => sub + Math.max(0, Number(item.sellQuantity || 0)) * Math.max(0, Number(item.price ?? item.sellingPrice ?? 0)), 0), 0);
  const printPeriod = dateRange?.from
    ? format(dateRange.from, 'dd MMM yyyy') + (dateRange.to ? ' – ' + format(dateRange.to, 'dd MMM yyyy') : '')
    : 'All available dates';
  const printDate = format(new Date(), 'dd MMM yyyy, hh:mm a');
  const printEventType = (event: DetailEvent) => event.kind === 'sale' ? 'SALE' : event.kind === 'refund' ? 'REFUND' : 'RUNNING TABLE';
  const printEventItems = (event: DetailEvent) => event.kind === 'sale'
    ? (event.sale.items || []).map(item => ({ name: item.itemName, qty: Number(item.quantity || 0), unit: Number(item.sellingPrice || 0) }))
    : event.kind === 'refund'
      ? (event.refund.items || []).map(item => ({ name: item.itemName, qty: Number(item.quantity || 0), unit: Number(item.refundAmount || 0) / Math.max(1, Number(item.quantity || 0)) }))
      : (event.table.cart || []).map(item => ({ name: item.name, qty: Number(item.sellQuantity || 0), unit: Number(item.price ?? item.sellingPrice ?? 0) }));
  const printReport = () => {
    if (isLoading) return;
    window.print();
  };

  const [searchTerm, setSearchTerm] = React.useState(searchParams.get('search') || '');
  const filteredEvents = React.useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (!term) return events;
    return events.filter(event => {
      const values: string[] = [event.kind, event.reference, event.date ? format(event.date, 'PPpp') : ''];
      if (event.kind === 'sale') {
        values.push(event.sale.customerName || '', event.sale.paymentMethod || '', event.sale.paymentStatus || '', event.sale.saleId || '');
        (event.sale.items || []).forEach(item => values.push(item.itemName || '', String(item.quantity || ''), String(item.sellingPrice || '')));
      } else if (event.kind === 'refund') {
        values.push(event.refund.customerName || '', event.refund.reason || '', event.refund.refundId || '', event.refund.source || '');
        (event.refund.items || []).forEach(item => values.push(item.itemName || '', String(item.quantity || '')));
      } else {
        values.push(event.table.customer?.name || '', event.table.name || '', event.table.notes || '', 'not settled', 'not completed', 'running table');
        (event.table.cart || []).forEach(item => values.push(item.name || '', String(item.sellQuantity || '')));
      }
      return values.join(' ').toLocaleLowerCase().includes(term);
    });
  }, [events, searchTerm]);
  const filteredIncome = filteredEvents.filter(event => event.kind === 'sale').reduce((sum, event) => sum + event.amount, 0);
  const filteredRefunds = filteredEvents.filter(event => event.kind === 'refund').reduce((sum, event) => sum + event.amount, 0);
  const filteredRunningTableTotal = filteredEvents.filter(event => event.kind === 'running').reduce((sum, event) => sum + event.amount, 0);

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


  return <div className="mx-auto flex min-h-screen w-full min-w-0 flex-col gap-5 p-3 sm:p-5 lg:p-6">
    <style jsx global>{`
      #staff-print-sheet.staff-print-invoice { width: 100%; max-width: 190mm; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
      #staff-print-sheet.staff-print-terminal { width: 72mm; max-width: 72mm; font-family: "Courier New", monospace; font-size: 10px; color: #111; background: #fff; }
      @page { size: ${printFormat === 'terminal' ? '80mm auto' : 'A4 portrait'}; margin: ${printFormat === 'terminal' ? '3mm' : '12mm'}; }
      @media print {
        html, body { background: #fff !important; }
        body * { visibility: hidden !important; }
        #staff-print-sheet, #staff-print-sheet * { visibility: visible !important; }
        #staff-print-sheet { position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; width: ${printFormat === 'terminal' ? '72mm' : '100%'} !important; max-width: none !important; padding: 0 !important; box-shadow: none !important; }
        #staff-print-sheet.staff-print-terminal { font-size: 9px !important; }
        #staff-print-sheet .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Button type="button" variant="outline" size="icon" aria-label="Back to staff transactions" onClick={() => router.push('/pos-reports/staff/' + encodeURIComponent(staffUid) + (dateQuery ? '?' + dateQuery : ''))}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0"><h1 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-6 w-6" />Print Staff Transactions</h1><p className="text-sm text-muted-foreground">Dedicated print workspace · {staffName}</p></div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
        <Button type="button" onClick={printReport} disabled={isLoading || filteredEvents.length === 0}><Printer className="mr-2 h-4 w-4" />Print {printFormat === 'invoice' ? 'Invoice' : 'Terminal'}</Button>
      </div>
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <Card className="h-fit print:hidden">
        <CardHeader><CardTitle>Report settings</CardTitle><CardDescription>Choose the print layout and report contents.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2"><p className="text-sm font-semibold">Print format</p><div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={printFormat === 'invoice' ? 'default' : 'outline'} className="h-auto flex-col gap-1 py-3" onClick={() => setPrintFormat('invoice')}><ClipboardList className="h-5 w-5" />Invoice<span className="text-[11px] font-normal opacity-75">A4 / Letter</span></Button>
            <Button type="button" variant={printFormat === 'terminal' ? 'default' : 'outline'} className="h-auto flex-col gap-1 py-3" onClick={() => setPrintFormat('terminal')}><Printer className="h-5 w-5" />Terminal<span className="text-[11px] font-normal opacity-75">80mm receipt</span></Button>
          </div></div>
          <div className="space-y-3 border-t pt-4"><p className="text-sm font-semibold">Include in report</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={includeTransactionList} onChange={event => setIncludeTransactionList(event.target.checked)} /><span><span className="font-medium">Transaction list</span><span className="block text-xs text-muted-foreground">Include sales, refunds and active running tables.</span></span></label>
            <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={includeItemDetails} onChange={event => setIncludeItemDetails(event.target.checked)} disabled={!includeTransactionList} /><span><span className="font-medium">Item details</span><span className="block text-xs text-muted-foreground">Include item names, quantities and values.</span></span></label>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">The report includes every matching record in the selected date range, not just the current table page. Running-table value is kept separate from completed income.</div>
          <div className="space-y-1 border-t pt-4"><p className="text-sm font-semibold">Report search</p><Input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Reference, customer, item..." aria-label="Filter report transactions" /><p className="text-xs text-muted-foreground">Search filters the transactions included in the preview and totals.</p></div>
          <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Records</p><p className="text-lg font-bold tabular-nums">{filteredEvents.length.toLocaleString()}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Sold units</p><p className="text-lg font-bold tabular-nums">{soldUnits.toLocaleString()}</p></div></div>
        </CardContent>
      </Card>
      <section className="min-w-0 overflow-hidden rounded-xl border bg-muted/30 p-2 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden"><div><h2 className="font-semibold">Live print preview</h2><p className="text-xs text-muted-foreground">Preview updates as you change the report settings.</p></div><Badge variant="outline">{printFormat === 'invoice' ? 'A4 invoice' : '80mm terminal'}</Badge></div>
        <div className="mx-auto min-h-[60vh] max-w-full overflow-x-auto rounded-lg bg-white p-3 text-black shadow-sm sm:p-6">
          <div id="staff-print-sheet" className={printFormat === 'terminal' ? 'staff-print-terminal mx-auto' : 'staff-print-invoice mx-auto'}>
            <div className="border-b-2 border-black pb-3 text-center">
              {receiptLogoUrl && <img src={receiptLogoUrl} alt="POS business logo" className="mx-auto mb-2 object-contain" style={{ width: Math.min(200, Math.max(32, Number(posSettings.posReceiptLogoSize) || 96)), height: Math.min(200, Math.max(32, Number(posSettings.posReceiptLogoSize) || 96)) }} />}
              {showBusinessName && <h1 className="text-xl font-extrabold tracking-wide">{posSettings.businessName || settings?.businessName || currentBranch?.name || 'POS TRANSACTION REPORT'}</h1>}
              {showAddress && (posSettings.businessAddress || settings?.businessAddress) && <p className="mt-1 whitespace-pre-line text-xs">{posSettings.businessAddress || settings?.businessAddress}</p>}
              <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">{showPhone && (posSettings.businessPhone || settings?.businessPhone) && <span>{posSettings.businessPhone || settings?.businessPhone}</span>}{showEmail && (posSettings.businessEmail || settings?.businessEmail) && <span>{posSettings.businessEmail || settings?.businessEmail}</span>}</div>
              {posSettings.posReceiptHeader && <p className="mt-2 text-sm font-bold">{posSettings.posReceiptHeader}</p>}
              <p className="mt-1 text-sm font-bold">{posSettings.posReceiptTitle || (printFormat === 'invoice' ? 'STAFF TRANSACTION STATEMENT' : 'STAFF POS REPORT')}</p>
              {posSettings.posShowDate !== false && <p className="mt-1 text-xs">Generated: {printDate}</p>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-black py-3 text-xs">
              <p><strong>Staff:</strong> {staffName}</p><p><strong>Period:</strong> {printPeriod}</p>
              <p><strong>Transactions:</strong> {filteredEvents.length}</p><p><strong>Currency:</strong> {currency}</p>
              {posSettings.posShowCashierName !== false && <p><strong>Cashier:</strong> {staffName}</p>}
            </div>
            {includeTransactionList && <div className="py-3"><h2 className="mb-2 text-sm font-extrabold">TRANSACTION DETAILS</h2>{filteredEvents.length === 0 ? <p className="py-4 text-center text-xs">No transactions match the current report filters.</p> : <div className="space-y-3">{filteredEvents.map(event => <div key={'print-' + event.id} className="break-inside-avoid border-b border-dashed border-gray-400 pb-2 text-xs"><div className="flex justify-between gap-2 font-bold"><span>{printEventType(event)} · {event.reference}</span><span className="whitespace-nowrap">{money(event.amount)}</span></div><div className="mt-1 flex justify-between gap-2 text-[10px]"><span>{event.date ? format(event.date, 'dd MMM yyyy, hh:mm a') : 'Date unavailable'}</span><span>{event.kind === 'running' ? 'NOT SETTLED / NOT COMPLETED' : event.kind === 'refund' ? 'REFUND' : event.sale.paymentStatus || 'SALE'}</span></div>{includeItemDetails && <div className="mt-1 space-y-0.5 pl-2">{printEventItems(event).map((item,index) => <div key={event.id + '-item-' + index} className="flex justify-between gap-2"><span>{item.name} × {item.qty}</span><span>{money(item.qty * item.unit)}</span></div>)}</div>}</div>)}</div>}</div>}
            <div className="mt-2 border-t-2 border-black pt-3"><h2 className="mb-2 text-sm font-extrabold">FINANCIAL SUMMARY</h2><div className="space-y-1 text-xs"><div className="flex justify-between gap-3"><span>Total Income</span><strong>{money(filteredIncome)}</strong></div><div className="flex justify-between gap-3"><span>Total Refund</span><strong>{money(filteredRefunds)}</strong></div><div className="flex justify-between gap-3"><span>Total Running Table Value (Unsettled)</span><strong>{money(filteredRunningTableTotal)}</strong></div></div><p className="mt-2 border-t border-dashed border-black pt-2 text-[10px]">Running-table value is not settled income and is excluded from completed sales income.</p></div>
            <div className="mt-6 border-t border-black pt-2 text-center text-[10px]">{posSettings.posReceiptFooter || posSettings.posThankYouMessage || "Thank you."}<p className="mt-1">End of report · {staffName}</p></div>
          </div>
        </div>
        {isLoading && <p className="mt-3 text-center text-sm text-muted-foreground print:hidden">Refreshing report data…</p>}
      </section>
    </div>
  </div>;
}

export default withAuth(StaffTransactionBreakdownPage, PagePermission.VIEW_POS_STAFF_TRANSACTIONS);
