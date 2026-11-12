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
import type { StockItem, StockSale, StockReturn } from '@/lib/types';
import { getProductMovementSummary, toReportDate, type ProductRestockMovement } from '@/lib/product-report-utils';
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
  const restockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('restockHistory'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const branchStock = useCollection<StockItem>(stockQuery);
  const branchSales = useCollection<StockSale>(salesQuery);
  const branchReturns = useCollection<StockReturn>(returnsQuery);
  const branchRestocks = useCollection<ProductRestockMovement>(restockQuery);
  const globalStock = useGlobalCollectionData<StockItem>('stock', []);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const globalRestocks = useGlobalCollectionData<ProductRestockMovement>('restockHistory', []);
  const stock = isGlobalMode ? globalStock.data : branchStock.data;
  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const restocks = isGlobalMode ? globalRestocks.data : branchRestocks.data;
  const loading = isGlobalMode
    ? globalStock.isLoading || globalSales.isLoading || globalReturns.isLoading || globalRestocks.isLoading
    : branchStock.isLoading || branchSales.isLoading || branchReturns.isLoading || branchRestocks.isLoading;

  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  const products = React.useMemo(() => (stock || []).filter(item => {
    if (productId && item.id !== productId) return false;
    if (categoryFilter && item.category !== categoryFilter) return false;
    return true;
  }).map(item => {
    const summary = getProductMovementSummary(item, sales || [], returns || [], restocks || [], dateRange.from, dateRange.to);
    const grossRevenue = (sales || []).filter(sale => {
      const date = toReportDate(sale.soldAt);
      return !!date && isWithinInterval(date, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
    }).reduce((sum, sale) => sum + sale.items.filter(line => line.itemId === item.id && !line.isService).reduce((lineSum, line) => lineSum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.sellingPrice) || 0), 0), 0);
    return { ...item, ...summary, grossRevenue };
  }).sort((a, b) => (a.category || 'Uncategorized').localeCompare(b.category || 'Uncategorized') || a.name.localeCompare(b.name)), [stock, sales, returns, restocks, productId, categoryFilter, dateRange]);

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
  const dateLabel = `${format(dateRange.from, 'dd MMM yyyy')} – ${format(dateRange.to, 'dd MMM yyyy')}`;
  const columnCount = 2 + Number(showOriginal) + Number(showAvailable) + Number(showSold) + Number(showReturned) + Number(showRevenue);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2"><Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><div><h1 className="text-xl font-bold">Product Report Printout</h1><p className="text-xs text-muted-foreground">Configure the layout and stock columns before printing.</p></div></div>
        <Button onClick={() => window.print()} disabled={loading || products.length === 0}><Printer className="mr-2 h-4 w-4" />Print Report</Button>
      </div>

      <Card className="print:hidden"><CardContent className="grid gap-4 p-4 lg:grid-cols-4">
        <div className="space-y-2"><p className="text-sm font-semibold">Print format</p><div className="flex gap-2"><Button type="button" size="sm" variant={printFormat === 'terminal' ? 'default' : 'outline'} onClick={() => setPrintFormat('terminal')}>Terminal</Button><Button type="button" size="sm" variant={printFormat === 'invoice' ? 'default' : 'outline'} onClick={() => setPrintFormat('invoice')}>Invoice (A4)</Button></div></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Product arrangement</p><div className="flex gap-2"><Button type="button" size="sm" variant={printMode === 'category' ? 'default' : 'outline'} onClick={() => setPrintMode('category')}>By Category</Button><Button type="button" size="sm" variant={printMode === 'product' ? 'default' : 'outline'} onClick={() => setPrintMode('product')}>Products Only</Button></div></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Date range</p><div className="flex gap-2"><input aria-label="Start date" type="date" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" value={format(dateRange.from, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!Number.isNaN(d.getTime())) setDateRange(r => ({ ...r, from: d })); }} /><input aria-label="End date" type="date" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" value={format(dateRange.to, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (!Number.isNaN(d.getTime())) setDateRange(r => ({ ...r, to: d })); }} /></div></div>
        <div className="space-y-2"><p className="text-sm font-semibold">Show columns</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showOriginal} onChange={e => setShowOriginal(e.target.checked)} />Original stock</label>
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
              <tbody>{group.products.map(item => <tr key={item.id} className="border-b border-black/20 align-top"><td className="py-2 pr-1"><b>{item.name}</b><div className="text-[9px]">{item.sku || item.barcode || ''}</div></td>{showOriginal && <td className="px-1 py-2 text-right tabular-nums">{item.openingStock.toLocaleString()}</td>}{showAvailable && <td className="px-1 py-2 text-right tabular-nums">{item.availableAtEnd.toLocaleString()}</td>}{showSold && <td className="px-1 py-2 text-right tabular-nums">{item.soldInRange.toLocaleString()}</td>}{showReturned && <td className="px-1 py-2 text-right tabular-nums">{item.returnedInRange.toLocaleString()}</td>}{showRevenue && <td className="pl-1 py-2 text-right tabular-nums">{money(item.grossRevenue)}</td>}</tr>)}</tbody>
              {group.name && <tfoot><tr className="border-t border-black font-bold"><td colSpan={columnCount} className="py-1 text-right">{group.products.length} product(s)</td></tr></tfoot>}
            </table>
          </section>)}
          <footer className="mt-6 border-t border-dashed border-black pt-3 text-center text-[10px]"><p>End of report</p><p className="mt-1">Stock figures are reconstructed from recorded stock, sales, returns and restock movements.</p><p>Unrecorded manual adjustments/transfers may affect historical balances.</p></footer>
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

export default withAuth(ProductReportPrintPage, PagePermission.VIEW_SALES_REPORTS);
