'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query } from 'firebase/firestore';
import { format, endOfDay, isWithinInterval, startOfDay, subDays } from 'date-fns';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useBranch } from '@/contexts/branch-context';
import { useSettings } from '@/contexts/settings-context';
import type { StockItem, StockSale, StockReturn, HeldSale } from '@/lib/types';
import { getProductMovementSummary, toReportDate, type ProductRestockMovement } from '@/lib/product-report-utils';
import { getProductImageUrl } from '@/lib/product-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Printer } from 'lucide-react';

type PrintFormat = 'terminal' | 'invoice';
type PrintMode = 'category' | 'product';

function ProductReportPrintPage() {
  const router = useRouter();
  const search = useSearchParams();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode } = useBranch();
  const productId = search.get('productId') || '';
  const categoryFilter = search.get('category') || '';
  const initialFrom = search.get('from') ? new Date(search.get('from') + 'T00:00:00') : subDays(new Date(), 29);
  const initialTo = search.get('to') ? new Date(search.get('to') + 'T00:00:00') : new Date();
  const [dateRange, setDateRange] = React.useState({ from: Number.isNaN(initialFrom.getTime()) ? subDays(new Date(), 29) : initialFrom, to: Number.isNaN(initialTo.getTime()) ? new Date() : initialTo });
  const [printFormat, setPrintFormat] = React.useState<PrintFormat>((search.get('format') as PrintFormat) === 'terminal' ? 'terminal' : 'invoice');
  const [printMode, setPrintMode] = React.useState<PrintMode>((search.get('arrangement') as PrintMode) === 'product' ? 'product' : 'category');
  const [showOriginal, setShowOriginal] = React.useState(true);
  const [showAvailable, setShowAvailable] = React.useState(true);
  const [showSold, setShowSold] = React.useState(true);
  const [showReturned, setShowReturned] = React.useState(false);
  const [showRevenue, setShowRevenue] = React.useState(true);

  const stockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const salesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const returnsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockReturns'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const heldQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('heldSales'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const restockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('restockHistory'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const branchStock = useCollection<StockItem>(stockQuery);
  const branchSales = useCollection<StockSale>(salesQuery);
  const branchReturns = useCollection<StockReturn>(returnsQuery);
  const branchHeld = useCollection<HeldSale>(heldQuery);
  const branchRestocks = useCollection<ProductRestockMovement>(restockQuery);
  const globalStock = useGlobalCollectionData<StockItem>('stock', []);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const globalHeld = useGlobalCollectionData<HeldSale>('heldSales', []);
  const globalRestocks = useGlobalCollectionData<ProductRestockMovement>('restockHistory', []);
  const stock = isGlobalMode ? globalStock.data : branchStock.data;
  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const heldTables = isGlobalMode ? globalHeld.data : branchHeld.data;
  const restocks = isGlobalMode ? globalRestocks.data : branchRestocks.data;
  const loading = isGlobalMode
    ? globalStock.isLoading || globalSales.isLoading || globalReturns.isLoading || globalRestocks.isLoading
    : branchStock.isLoading || branchSales.isLoading || branchReturns.isLoading || branchRestocks.isLoading;

  const rangeFrom = dateRange.from <= dateRange.to ? dateRange.from : dateRange.to;
  const rangeTo = dateRange.from <= dateRange.to ? dateRange.to : dateRange.from;
  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  const products = React.useMemo(() => (stock || []).filter(item => {
    if (productId && item.id !== productId) return false;
    if (categoryFilter && item.category !== categoryFilter) return false;
    return true;
  }).map(item => {
    const summary = getProductMovementSummary(item, sales || [], returns || [], restocks || [], rangeFrom, rangeTo);
    const grossRevenue = (sales || []).filter(sale => {
      const date = toReportDate(sale.soldAt);
      return !!date && isWithinInterval(date, { start: startOfDay(rangeFrom), end: endOfDay(rangeTo) });
    }).reduce((sum, sale) => sum + (sale.items || []).filter(line => line.itemId === item.id && !line.isService).reduce((lineSum, line) => lineSum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.sellingPrice) || 0), 0), 0);
    return { ...item, ...summary, grossRevenue, imageUrl: getProductImageUrl(item, settings) };
  }).sort((a, b) => (a.category || 'Uncategorized').localeCompare(b.category || 'Uncategorized') || a.name.localeCompare(b.name)), [stock, sales, returns, restocks, productId, categoryFilter, dateRange, settings]);

  const groups = React.useMemo(() => {
    if (printMode === 'product') return [{ name: '', products }];
    const map = new Map<string, typeof products>();
    products.forEach(item => {
      const key = item.category || 'Uncategorized';
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, rows]) => ({ name, products: rows }));
  }, [products, printMode]);

  const totals = React.useMemo(() => products.reduce((sum, item) => ({
    opening: sum.opening + item.openingStock,
    available: sum.available + item.availableAtEnd,
    sold: sum.sold + item.soldInRange,
    returned: sum.returned + item.returnedInRange,
    revenue: sum.revenue + item.grossRevenue,
  }), { opening: 0, available: 0, sold: 0, returned: 0, revenue: 0 }), [products]);

  const title = productId ? (products[0]?.name || 'Product Stock & Sales Report') : categoryFilter ? `${categoryFilter} — Product Report` : 'Product Stock & Sales Report';
  const dateLabel = `${format(rangeFrom, 'dd MMM yyyy')} – ${format(rangeTo, 'dd MMM yyyy')}`;
  const columnCount = 1 + Number(showOriginal) + Number(showAvailable) + Number(showSold) + Number(showReturned) + Number(showRevenue);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2"><Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><div><h1 className="text-xl font-bold">Product Report Printout</h1><p className="text-xs text-muted-foreground">Configure the layout and stock columns before printing.</p></div></div>
        <Button onClick={() => window.print()} disabled={loading || products.length === 0}><Printer className="mr-2 h-4 w-4" />Print Report</Button>
      </div>

      <Card className="print:hidden"><CardContent className="grid gap-4 p-4 lg:grid-cols-4">
        <div className="space-y-2"><p className="text-sm font-semibold">Print format</p><div className="flex gap-2"><Button type="button" size="sm" variant={printFormat === 'terminal' ? 'default' : 'outline'} onClick={() => setPrintFormat('terminal')}>Terminal</Button><Button type="button" size="sm" variant={printFormat === 'invoice' ? 'default' : 'outline'} onClick={() => setPrintFormat('invoice')}>Invoice (A4)</Button></div></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Product arrangement</p><div className="flex gap-2"><Button type="button" size="sm" variant={printMode === 'category' ? 'default' : 'outline'} onClick={() => setPrintMode('category')}>By Category</Button><Button type="button" size="sm" variant={printMode === 'product' ? 'default' : 'outline'} onClick={() => setPrintMode('product')}>Products Only</Button></div></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Date range</p><div className="flex gap-2"><input aria-label="Start date" type="date" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" value={format(rangeFrom, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!Number.isNaN(d.getTime())) setDateRange(r => ({ ...r, from: d })); }} /><input aria-label="End date" type="date" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" value={format(rangeTo, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!Number.isNaN(d.getTime())) setDateRange(r => ({ ...r, to: d })); }} /></div></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Show columns</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showOriginal} onChange={e => setShowOriginal(e.target.checked)} />Opening stock (original)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showAvailable} onChange={e => setShowAvailable(e.target.checked)} />Available stock</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showSold} onChange={e => setShowSold(e.target.checked)} />Sold</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showReturned} onChange={e => setShowReturned(e.target.checked)} />Returned</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showRevenue} onChange={e => setShowRevenue(e.target.checked)} />Revenue</label>
        </div></div>
      </CardContent></Card>

      {loading ? <div className="py-16 text-center text-muted-foreground print:hidden">Loading report data…</div> : products.length === 0 ? <div className="py-16 text-center text-muted-foreground print:hidden">No products found for this report selection.</div> : (
        <main className={`report-sheet mx-auto w-full bg-white text-black ${printFormat === 'terminal' ? 'max-w-[80mm] p-3' : 'max-w-[210mm] p-6 sm:p-10'}`}>
          <header className="mb-5 text-center">
            {settings?.businessLogoUrl && <img src={settings.businessLogoUrl} alt="Business logo" className={`mx-auto mb-2 object-contain ${printFormat === 'terminal' ? 'max-h-14 max-w-24' : 'max-h-20 max-w-40'}`} />}
            <h2 className={`font-bold ${printFormat === 'terminal' ? 'text-base' : 'text-2xl'}`}>{settings?.businessName || 'Business Report'}</h2>
            {settings?.businessAddress && <p className="mt-1 text-xs">{settings.businessAddress}</p>}
            {settings?.businessPhone && <p className="text-xs">{settings.businessPhone}</p>}
            <div className="my-3 border-y border-dashed border-black py-2"><h1 className={`font-bold uppercase ${printFormat === 'terminal' ? 'text-sm' : 'text-xl'}`}>{title}</h1><p className="mt-1 text-xs">Period: {dateLabel}</p><p className="text-xs">Generated: {format(new Date(), 'dd MMM yyyy, h:mm a')}</p></div>
          </header>
          <section className={`mb-4 grid gap-2 text-center ${printFormat === 'terminal' ? 'grid-cols-2 text-xs' : 'grid-cols-4 text-sm'}`}>
            <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Opening stock</p><b>{totals.opening.toLocaleString()}</b></div>
            <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Available at end</p><b>{totals.available.toLocaleString()}</b></div>
            <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Units sold</p><b>{totals.sold.toLocaleString()}</b></div>
            <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Revenue</p><b>{money(totals.revenue)}</b></div>
          </section>
          {groups.map(group => <section key={group.name || 'all-products'} className="mb-4">
            {group.name && <h3 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">{group.name}</h3>}
            <table className={`w-full border-collapse ${printFormat === 'terminal' ? 'text-[9px]' : 'text-xs'}`}>
              <thead><tr className="border-b border-black text-left"><th className="py-2 pr-1">Product</th>{showOriginal && <th className="px-1 py-2 text-right">Original</th>}{showAvailable && <th className="px-1 py-2 text-right">Available</th>}{showSold && <th className="px-1 py-2 text-right">Sold</th>}{showReturned && <th className="px-1 py-2 text-right">Returned</th>}{showRevenue && <th className="pl-1 py-2 text-right">Revenue</th>}</tr></thead>
              <tbody>{group.products.map(item => <tr key={item.id} className="border-b border-black/20 align-top"><td className="py-2 pr-1"><div className="flex items-center gap-2">{item.imageUrl && <img src={item.imageUrl} alt="" loading="eager" className="h-8 w-8 shrink-0 rounded border border-black/20 object-cover" />}<div><b>{item.name}</b><div className="text-[9px]">{item.sku || item.barcode || ''}</div></div></div></td>{showOriginal && <td className="px-1 py-2 text-right tabular-nums">{item.openingStock.toLocaleString()}</td>}{showAvailable && <td className="px-1 py-2 text-right tabular-nums">{item.availableAtEnd.toLocaleString()}</td>}{showSold && <td className="px-1 py-2 text-right tabular-nums">{item.soldInRange.toLocaleString()}</td>}{showReturned && <td className="px-1 py-2 text-right tabular-nums">{item.returnedInRange.toLocaleString()}</td>}{showRevenue && <td className="pl-1 py-2 text-right tabular-nums">{money(item.grossRevenue)}</td>}</tr>)}</tbody>
              {group.name && <tfoot><tr className="border-t border-black font-bold"><td colSpan={columnCount} className="py-1 text-right">{group.products.length} product(s)</td></tr></tfoot>}
            </table>
          </section>)}
          <footer className="mt-6 border-t border-dashed border-black pt-3 text-center text-[10px]"><p>End of report</p><p className="mt-1">Stock figures are reconstructed from recorded stock, sales, returns and restock movements. For today, available stock excludes current running-table reservations.</p><p>Unrecorded manual adjustments/transfers may affect historical balances.</p></footer>
        </main>
      )}
      <style jsx global>{`
        @media print {
          @page { size: ${printFormat === 'terminal' ? '80mm auto' : 'A4 portrait'}; margin: ${printFormat === 'terminal' ? '3mm' : '10mm'}; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .report-sheet, .report-sheet * { visibility: visible !important; }
          .report-sheet { position: absolute !important; inset: 0 auto auto 0 !important; width: ${printFormat === 'terminal' ? '74mm' : '190mm'} !important; max-width: none !important; margin: 0 !important; padding: ${printFormat === 'terminal' ? '0' : '0'} !important; box-shadow: none !important; }
          .report-sheet table { page-break-inside: auto; }
          .report-sheet tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}



function SalesReportPrintPage() {
  const router = useRouter();
  const search = useSearchParams();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode } = useBranch();
  const transactionId = search.get('transactionId') || '';
  const initialFrom = search.get('from') ? new Date(search.get('from') + 'T00:00:00') : subDays(new Date(), 29);
  const initialTo = search.get('to') ? new Date(search.get('to') + 'T00:00:00') : new Date();
  const [dateRange, setDateRange] = React.useState({ from: Number.isNaN(initialFrom.getTime()) ? subDays(new Date(), 29) : initialFrom, to: Number.isNaN(initialTo.getTime()) ? new Date() : initialTo });
  const [printFormat, setPrintFormat] = React.useState<'terminal' | 'invoice'>((search.get('format') as 'terminal' | 'invoice') === 'terminal' ? 'terminal' : 'invoice');
  const [arrangement, setArrangement] = React.useState<'date' | 'transaction'>((search.get('arrangement') as 'date' | 'transaction') === 'transaction' ? 'transaction' : 'date');
  const [showStaff, setShowStaff] = React.useState(true);
  const [showCustomer, setShowCustomer] = React.useState(true);
  const [showItems, setShowItems] = React.useState(true);
  const [showPayment, setShowPayment] = React.useState(true);
  const [showStatus, setShowStatus] = React.useState(true);

  const salesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const returnsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockReturns'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const branchSales = useCollection<StockSale>(salesQuery);
  const branchReturns = useCollection<StockReturn>(returnsQuery);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const loading = isGlobalMode ? globalSales.isLoading || globalReturns.isLoading || globalHeld.isLoading : branchSales.isLoading || branchReturns.isLoading || branchHeld.isLoading;

  const from = dateRange.from <= dateRange.to ? dateRange.from : dateRange.to;
  const to = dateRange.from <= dateRange.to ? dateRange.to : dateRange.from;
  const staffRows = React.useMemo(() => {
    const rows = new Map<string, { id: string; name: string; income: number; sold: number; refunds: number; tables: number }>();
    const ensure = (uid?: string, name?: string) => {
      const id = uid || 'legacy-name:' + (name || 'Unknown staff').trim().toLowerCase();
      let row = rows.get(id);
      if (!row) {
        row = { id, name: name?.trim() || 'Unknown staff', income: 0, sold: 0, refunds: 0, tables: 0 };
        rows.set(id, row);
      }
      return row;
    };
    const within = (value: unknown) => {
      const date = toReportDate(value);
      return !!date && isWithinInterval(date, { start: startOfDay(from), end: endOfDay(to) });
    };
    (sales || []).filter(item => within(item.soldAt)).forEach(item => {
      const row = ensure(item.soldByUid, item.soldByName);
      row.income += Math.max(0, Number(item.initialPaymentAmount ?? (item.paymentStatus === 'Paid' ? item.totalAmount : 0)) || 0);
      row.sold += (item.items || []).reduce((sum, line) => sum + (line.isService ? 0 : Math.max(0, Number(line.quantity) || 0)), 0);
    });
    (returns || []).filter(item => within(item.returnedAt)).forEach(item => {
      ensure(item.returnedByUid, item.returnedByName).refunds += Math.max(0, Number(item.totalRefundAmount) || 0);
    });
    (heldTables || []).filter(item => within(item.heldAt)).forEach(item => {
      ensure(item.heldByUid, item.heldByName).tables += 1;
    });
    return Array.from(rows.values()).sort((a, b) => b.income - a.income || a.name.localeCompare(b.name));
  }, [sales, returns, heldTables, from, to]);

  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  const totals = React.useMemo(() => staffRows.reduce((sum, row) => ({
    income: sum.income + row.income,
    sold: sum.sold + row.sold,
    refunds: sum.refunds + row.refunds,
    tables: sum.tables + row.tables,
  }), { income: 0, sold: 0, refunds: 0, tables: 0 }), [staffRows]);
  const dateLabel = `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`;
  const title = 'Staff Sales & Refund Summary';

  return <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-3 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-2"><Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><div><h1 className="text-xl font-bold">Sales Report Printout</h1><p className="text-xs text-muted-foreground">Configure the sales report layout before printing.</p></div></div>
      <Button onClick={() => window.print()} disabled={loading || staffRows.length === 0}><Printer className="mr-2 h-4 w-4" />Print Report</Button>
    </div>
    <Card className="print:hidden"><CardContent className="grid gap-4 p-4 lg:grid-cols-4">
      <div className="space-y-2"><p className="text-sm font-semibold">Print format</p><div className="flex gap-2"><Button type="button" size="sm" variant={printFormat === 'terminal' ? 'default' : 'outline'} onClick={() => setPrintFormat('terminal')}>Terminal</Button><Button type="button" size="sm" variant={printFormat === 'invoice' ? 'default' : 'outline'} onClick={() => setPrintFormat('invoice')}>Invoice (A4)</Button></div></div>
      <div className="space-y-2"><p className="text-sm font-semibold">Arrange transactions</p><div className="flex gap-2"><Button type="button" size="sm" variant={arrangement === 'date' ? 'default' : 'outline'} onClick={() => setArrangement('date')}>By Date</Button><Button type="button" size="sm" variant={arrangement === 'transaction' ? 'default' : 'outline'} onClick={() => setArrangement('transaction')}>All Transactions</Button></div></div>
      <div className="space-y-2"><p className="text-sm font-semibold">Date range</p><div className="flex gap-2"><input aria-label="Start date" type="date" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" value={format(from, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!Number.isNaN(d.getTime())) setDateRange(r => ({ ...r, from: d })); }} /><input aria-label="End date" type="date" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" value={format(to, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!Number.isNaN(d.getTime())) setDateRange(r => ({ ...r, to: d })); }} /></div></div>
      <div className="space-y-2"><p className="text-sm font-semibold">Show details</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showStaff} onChange={e => setShowStaff(e.target.checked)} />Staff</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showCustomer} onChange={e => setShowCustomer(e.target.checked)} />Customer</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showItems} onChange={e => setShowItems(e.target.checked)} />Items</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showPayment} onChange={e => setShowPayment(e.target.checked)} />Payment</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showStatus} onChange={e => setShowStatus(e.target.checked)} />Status</label>
      </div></div>
    </CardContent></Card>

    {loading ? <div className="py-16 text-center text-muted-foreground print:hidden">Loading staff report…</div> : staffRows.length === 0 ? <div className="py-16 text-center text-muted-foreground print:hidden">No staff activity found for this selection.</div> : <main className={`sales-report-sheet mx-auto w-full bg-white text-black ${printFormat === 'terminal' ? 'max-w-[80mm] p-3' : 'max-w-[210mm] p-6 sm:p-10'}`}>
      <header className="mb-5 text-center">
        {settings?.businessLogoUrl && <img src={settings.businessLogoUrl} alt="Business logo" className={`mx-auto mb-2 object-contain ${printFormat === 'terminal' ? 'max-h-14 max-w-24' : 'max-h-20 max-w-40'}`} />}
        <h2 className={`font-bold ${printFormat === 'terminal' ? 'text-base' : 'text-2xl'}`}>{settings?.businessName || 'Business Report'}</h2>
        {settings?.businessAddress && <p className="mt-1 text-xs">{settings.businessAddress}</p>}
        {settings?.businessPhone && <p className="text-xs">{settings.businessPhone}</p>}
        <div className="my-3 border-y border-dashed border-black py-2"><h1 className={`font-bold uppercase ${printFormat === 'terminal' ? 'text-sm' : 'text-xl'}`}>{title}</h1><p className="mt-1 text-xs">Period: {dateLabel}</p><p className="text-xs">Generated: {format(new Date(), 'dd MMM yyyy, h:mm a')}</p></div>
      </header>
      <section className={`mb-4 grid gap-2 text-center ${printFormat === 'terminal' ? 'grid-cols-2 text-xs' : 'grid-cols-4 text-sm'}`}>
        <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Total income</p><b>{money(totals.income)}</b></div>
        <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Sold items</p><b>{totals.sold.toLocaleString()}</b></div>
        <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Refunds</p><b>{money(totals.refunds)}</b></div>
        <div className="border border-black/30 p-2"><p className="text-[10px] uppercase">Running tables</p><b>{totals.tables.toLocaleString()}</b></div>
      </section>
      <section className="mb-4">
        <div className="overflow-x-auto"><table className={`w-full border-collapse ${printFormat === 'terminal' ? 'text-[9px]' : 'text-xs'}`}>
          <thead><tr className="border-b border-black text-left"><th className="py-2 pr-1">Staff name</th><th className="px-1 py-2 text-right">Total income</th><th className="px-1 py-2 text-right">Sold items</th><th className="px-1 py-2 text-right">Refund</th><th className="pl-1 py-2 text-right">Running tables</th></tr></thead>
          <tbody>{staffRows.map(row => <tr key={row.id} className="border-b border-black/20 align-top"><td className="py-2 pr-1">{row.name}</td><td className="px-1 py-2 text-right">{money(row.income)}</td><td className="px-1 py-2 text-right">{row.sold.toLocaleString()}</td><td className="px-1 py-2 text-right">{money(row.refunds)}</td><td className="pl-1 py-2 text-right">{row.tables.toLocaleString()}</td></tr>)}</tbody>
        </table></div>
      </section>
      <footer className="mt-6 border-t border-dashed border-black pt-3 text-center text-[10px]"><p>End of report</p><p className="mt-1">Staff income reflects recorded collected payments. Refunds and active running tables are shown separately; running tables are not completed sales income.</p></footer>
    </main>}
    <style jsx global>{`
      @media print {
        @page { size: ${printFormat === 'terminal' ? '80mm auto' : 'A4 portrait'}; margin: ${printFormat === 'terminal' ? '3mm' : '10mm'}; }
        html, body { background: #fff !important; }
        body * { visibility: hidden !important; }
        .sales-report-sheet, .sales-report-sheet * { visibility: visible !important; }
        .sales-report-sheet { position: absolute !important; inset: 0 auto auto 0 !important; width: ${printFormat === 'terminal' ? '74mm' : '190mm'} !important; max-width: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
        .sales-report-sheet table { page-break-inside: auto; }
        .sales-report-sheet tr { page-break-inside: avoid; }
      }
    `}</style>
  </div>;
}

function ReportsPrintPage() {
  const search = useSearchParams();
  return search.get('report') === 'sales' ? <SalesReportPrintPage /> : <ProductReportPrintPage />;
}

export default withAuth(ReportsPrintPage, PagePermission.VIEW_SALES_REPORTS);

