'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import type { StockSale, StockReturn, HeldSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { TopHeader } from '@/components/top-header';
import { StatCard } from '@/components/ui/stat-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSafeDate } from '@/lib/helpers';
import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import { Banknote, ClipboardList, Package, RotateCcw, Search, ShoppingBag, Table2, ChevronLeft, ChevronRight, X } from 'lucide-react';

type ReportEvent =
  | { id: string; kind: 'sale'; date: Date | null; staff: string; items: string; amount: number; reference: string; sale: StockSale }
  | { id: string; kind: 'refund'; date: Date | null; staff: string; items: string; amount: number; reference: string; refund: StockReturn }
  | { id: string; kind: 'running'; date: Date | null; staff: string; items: string; amount: number; reference: string; table: HeldSale };

function POSReportsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedEvent, setSelectedEvent] = React.useState<ReportEvent | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const branchSalesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchReturnsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockReturns'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchHeldQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('heldSales'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchSales = useCollection<StockSale>(branchSalesQuery);
  const branchReturns = useCollection<StockReturn>(branchReturnsQuery);
  const branchHeld = useCollection<HeldSale>(branchHeldQuery);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const globalHeld = useGlobalCollectionData<HeldSale>('heldSales', []);

  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const heldTables = isGlobalMode ? globalHeld.data : branchHeld.data;
  const isLoading = isGlobalMode
    ? globalSales.isLoading || globalReturns.isLoading || globalHeld.isLoading
    : branchSales.isLoading || branchReturns.isLoading || branchHeld.isLoading;

  const currency = settings?.currency || 'USD';
  const money = React.useCallback((amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(amount) ? amount : 0), [currency]);
  const inRange = React.useCallback((date: Date | null) => {
    if (!date || !dateRange?.from) return true;
    return isWithinInterval(date, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) });
  }, [dateRange]);

  const events = React.useMemo<ReportEvent[]>(() => {
    const saleEvents: ReportEvent[] = (sales || []).map(sale => {
      const paid = typeof sale.initialPaymentAmount === 'number'
        ? sale.initialPaymentAmount
        : sale.paymentStatus === 'Paid' ? sale.totalAmount : 0;
      return {
        id: `sale-${sale.id}`, kind: 'sale', date: getSafeDate(sale.soldAt),
        staff: sale.soldByName || 'Unknown staff',
        items: (sale.items || []).map(item => `${item.itemName} × ${item.quantity}`).join(', '),
        amount: paid, reference: sale.saleId || sale.id, sale,
      };
    });
    const refundEvents: ReportEvent[] = (returns || []).map(refund => ({
      id: `refund-${refund.id}`, kind: 'refund', date: getSafeDate(refund.returnedAt),
      staff: refund.returnedByName || 'Unknown staff',
      items: (refund.items || []).map(item => `${item.itemName} × ${item.quantity}`).join(', '),
      amount: Number(refund.totalRefundAmount || 0), reference: refund.refundId || refund.id, refund,
    }));
    const runningEvents: ReportEvent[] = (heldTables || []).map(table => ({
      id: `running-${table.id}`, kind: 'running', date: getSafeDate(table.heldAt),
      staff: table.heldByName || 'Unknown staff',
      items: (table.cart || []).map(item => `${item.name} × ${item.sellQuantity || 0}`).join(', '),
      amount: (table.cart || []).reduce((sum, item) => sum + Number(item.price ?? item.sellingPrice ?? 0) * Number(item.sellQuantity || 0), 0),
      reference: table.name || table.id, table,
    }));
    return [...saleEvents, ...refundEvents, ...runningEvents]
      .filter(event => inRange(event.date))
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [sales, returns, heldTables, inRange]);

  const summary = React.useMemo(() => {
    const filteredSales = (sales || []).filter(sale => inRange(getSafeDate(sale.soldAt)));
    const filteredReturns = (returns || []).filter(refund => inRange(getSafeDate(refund.returnedAt)));
    const filteredTables = (heldTables || []).filter(table => inRange(getSafeDate(table.heldAt)));
    const soldItems = filteredSales.reduce((sum, sale) => sum + (sale.items || []).reduce((s, item) => s + Number(item.quantity || 0), 0), 0);
    const income = filteredSales.reduce((sum, sale) => sum + (typeof sale.initialPaymentAmount === 'number' ? sale.initialPaymentAmount : sale.paymentStatus === 'Paid' ? sale.totalAmount : 0), 0);
    const refundTotal = filteredReturns.reduce((sum, refund) => sum + Number(refund.totalRefundAmount || 0), 0);
    const returnedTables = filteredReturns.filter(refund => refund.source === 'RunningTable').length;
    return {
      soldItems,
      runningCount: filteredTables.length,
      runningItems: filteredTables.reduce((sum, table) => sum + (table.cart || []).reduce((s, item) => s + Number(item.sellQuantity || 0), 0), 0),
      income, refundTotal, returnedTables,
    };
  }, [sales, returns, heldTables, inRange]);

  const visibleEvents = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return events;
    return events.filter(event => [event.staff, event.items, event.reference, event.kind].some(value => value.toLowerCase().includes(term)));
  }, [events, searchTerm]);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, dateRange]);
  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEvents = visibleEvents.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TopHeader name="POS Reports" icon={<ClipboardList className="h-8 w-8" />} description={isBranchMode ? `Sales, refunds and running-table activity — ${currentBranch?.name || 'Current branch'}` : 'A consolidated view of POS sales, collections, refunds and running tables.'} />
        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={ShoppingBag} title="Total Sold Items" value={summary.soldItems.toLocaleString()} description="Units in completed sales for the selected period." className="border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
        <StatCard icon={Table2} title="Total Running Tables" value={summary.runningCount.toLocaleString()} description={`${summary.runningItems.toLocaleString()} item units currently held in these tables.`} className="border-0 bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
        <StatCard icon={Banknote} title="Total Income" value={money(summary.income)} description="Payments collected against completed POS sales." className="border-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
        <StatCard icon={RotateCcw} title="Total Refund" value={money(summary.refundTotal)} description="Refund value recorded in the selected period." className="border-0 bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
        <StatCard icon={Package} title="Total Return Table" value={summary.returnedTables.toLocaleString()} description="Refund records originating from running tables." className="border-0 bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>POS Transactions</CardTitle><CardDescription>Sales, refunds and active running tables. Select any row to inspect its full breakdown.</CardDescription></div>
          <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search staff, item, reference..." className="pl-9" /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading POS report records...</div> :
          visibleEvents.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No POS transactions found for this period.</div> :
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-3 font-medium">Date &amp; Time</th><th className="px-3 py-3 font-medium">Staff</th><th className="px-3 py-3 font-medium">Item</th><th className="px-3 py-3 text-right font-medium">Amount Paid / Value</th><th className="px-3 py-3 font-medium">Running Table</th><th className="px-3 py-3 font-medium">Refunds</th><th className="px-3 py-3 text-right font-medium">Details</th>
              </tr></thead>
              <tbody>
                {paginatedEvents.map(event => <tr key={event.id} onClick={() => event.kind === 'running' ? router.push(`/pos-reports/running-table/${encodeURIComponent(event.table.id)}`) : setSelectedEvent(event)} className="cursor-pointer border-b transition-colors hover:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-3">{event.date ? format(event.date, 'PP p') : '—'}</td>
                  <td className="px-3 py-3 font-medium">{event.staff}</td>
                  <td className="max-w-[260px] truncate px-3 py-3" title={event.items}>{event.items || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{event.kind === 'refund' ? `−${money(event.amount)}` : money(event.amount)}</td>
                  <td className="px-3 py-3">{event.kind === 'running' ? <Badge variant="secondary">{event.reference}</Badge> : event.kind === 'sale' && event.sale.linkedHeldSaleId ? <Badge variant="outline">Completed table</Badge> : '—'}</td>
                  <td className="px-3 py-3">{event.kind === 'refund' ? <Badge variant="destructive">Refund</Badge> : '—'}</td>
                  <td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); if (event.kind === 'running') router.push(`/pos-reports/running-table/${encodeURIComponent(event.table.id)}`); else setSelectedEvent(event); }}>View breakdown</Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {!isLoading && visibleEvents.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, visibleEvents.length)} of {visibleEvents.length} records</p>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
              <span className="min-w-[88px] text-center text-sm font-medium tabular-nums">Page {safePage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>}
        </CardContent>
      </Card>

      {selectedEvent && <TransactionBreakdownDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} money={money} />}
    </div>
  );
}

function TransactionBreakdownDialog({event: selectedEvent, onClose, money}: {event: Exclude<ReportEvent, {kind:'running'}>; onClose: () => void; money: (amount:number)=>string}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>

    <DialogContent className="!inset-0 !h-[100dvh] !max-h-none !w-screen !max-w-none !translate-x-0 !translate-y-0 rounded-none p-0 sm:!inset-0 sm:!h-[100dvh] sm:!max-h-none sm:!w-screen sm:!max-w-none sm:!translate-x-0 sm:!translate-y-0 sm:rounded-none">
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="shrink-0 border-b px-5 py-5 pr-16 text-left sm:px-8">
              <DialogTitle className="px-0 text-left text-xl">{selectedEvent.kind === 'sale' ? 'Sale breakdown' : selectedEvent.kind === 'refund' ? 'Refund breakdown' : 'Running table breakdown'}</DialogTitle>
              <DialogDescription>{selectedEvent.reference} · {selectedEvent.staff}{selectedEvent.date ? ` · ${format(selectedEvent.date, 'PPpp')}` : ''}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto w-full max-w-5xl space-y-6 p-5 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Staff</p><p className="mt-1 font-semibold">{selectedEvent.staff}</p></div>
                  <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Reference / Table</p><p className="mt-1 font-semibold">{selectedEvent.reference}</p></div>
                  <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">{selectedEvent.kind === 'refund' ? 'Refund amount' : selectedEvent.kind === 'running' ? 'Running table value' : 'Amount paid'}</p><p className="mt-1 text-xl font-bold">{money(selectedEvent.amount)}</p></div>
                </div>
                {selectedEvent.kind === 'sale' && <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{selectedEvent.sale.customerName || 'Walk-in'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Payment method</p><p className="font-medium">{selectedEvent.sale.paymentMethod}</p></div>
                    <div><p className="text-xs text-muted-foreground">Payment status</p><Badge variant={selectedEvent.sale.paymentStatus === 'Paid' ? 'success' : 'secondary'}>{selectedEvent.sale.paymentStatus}</Badge></div>
                  </div>
                  <ItemsTable items={selectedEvent.sale.items.map(item => ({name:item.itemName,quantity:item.quantity,price:item.sellingPrice}))} money={money} />
                  <div className="flex justify-end border-t pt-4"><div className="w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Sale total</span><b>{money(selectedEvent.sale.totalAmount)}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Amount collected</span><b>{money(selectedEvent.amount)}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><b>{money(Math.max(0, selectedEvent.sale.totalAmount - selectedEvent.amount))}</b></div></div></div>
                </>}
                {selectedEvent.kind === 'refund' && <>
                  <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Original sale</p><p className="font-medium">{selectedEvent.refund.originalSaleId}</p></div><div><p className="text-xs text-muted-foreground">Reason</p><p className="font-medium">{selectedEvent.refund.reason || 'Not specified'}</p></div></div>
                  <ItemsTable items={selectedEvent.refund.items.map(item => ({name:item.itemName,quantity:item.quantity,price:item.refundAmount / Math.max(1,item.quantity)}))} money={money} />
                </>}
              </div>
            </ScrollArea>
            <DialogFooter className="shrink-0 border-t px-5 py-3 sm:px-8"><Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" />Close</Button></DialogFooter>
          </div>
    </DialogContent>
  </Dialog>;
}

function ItemsTable({items, money}: {items: {name: string; quantity: number; price: number}[]; money: (value: number) => string}) {
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b bg-muted/40 text-left"><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Unit price / refund</th><th className="px-4 py-3 text-right">Subtotal</th></tr></thead><tbody>{items.map((item,index)=><tr key={index} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-right">{item.quantity}</td><td className="px-4 py-3 text-right">{money(item.price)}</td><td className="px-4 py-3 text-right font-semibold">{money(item.price * item.quantity)}</td></tr>)}</tbody></table></div>;
}

export default withAuth(POSReportsPage, PagePermission.VIEW_POS_REPORTS);
