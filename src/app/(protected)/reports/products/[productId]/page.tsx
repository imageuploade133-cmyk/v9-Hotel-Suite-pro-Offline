'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { collection, query } from 'firebase/firestore';
import { format, endOfDay, isWithinInterval, startOfDay, subDays } from 'date-fns';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useBranch } from '@/contexts/branch-context';
import { useSettings } from '@/contexts/settings-context';
import type { StockItem, StockSale, StockReturn } from '@/lib/types';
import { toReportDate } from '@/lib/product-report-utils';
import { TopHeader } from '@/components/top-header';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Clock3, Package, Printer, ShoppingBag, RotateCcw } from 'lucide-react';

type ProductEvent = {
  id: string;
  kind: 'sale' | 'return';
  date: Date;
  reference: string;
  channel: string;
  staff: string;
  customer: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  status: string;
  payment: string;
  note?: string;
};

function ProductReportDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = decodeURIComponent(String(params.productId || ''));
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    const fromValue = searchParams.get('from');
    const toValue = searchParams.get('to');
    const from = fromValue ? new Date(fromValue) : subDays(new Date(), 29);
    const to = toValue ? new Date(toValue) : new Date();
    return { from: Number.isNaN(from.getTime()) ? subDays(new Date(), 29) : from, to: Number.isNaN(to.getTime()) ? new Date() : to };
  });

  const stockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const salesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const returnsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockReturns'))) : null, [firestore, getCollectionPath, isGlobalMode]);
  const branchStock = useCollection<StockItem>(stockQuery);
  const branchSales = useCollection<StockSale>(salesQuery);
  const branchReturns = useCollection<StockReturn>(returnsQuery);
  const globalStock = useGlobalCollectionData<StockItem>('stock', []);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const stock = isGlobalMode ? globalStock.data : branchStock.data;
  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const loading = isGlobalMode
    ? globalStock.isLoading || globalSales.isLoading || globalReturns.isLoading
    : branchStock.isLoading || branchSales.isLoading || branchReturns.isLoading;

  const product = React.useMemo(() => (stock || []).find(item => item.id === productId), [stock, productId]);
  const currency = settings?.currency || 'USD';
  const money = React.useCallback((amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(amount) ? amount : 0), [currency]);
  const inRange = React.useCallback((value: unknown) => {
    const date = toReportDate(value);
    if (!date || !dateRange?.from) return false;
    const from = dateRange.to && dateRange.from > dateRange.to ? dateRange.to : dateRange.from;
    const to = dateRange.to && dateRange.from > dateRange.to ? dateRange.from : (dateRange.to || dateRange.from);
    return isWithinInterval(date, { start: startOfDay(from), end: endOfDay(to) });
  }, [dateRange]);

  const events = React.useMemo<ProductEvent[]>(() => {
    const rows: ProductEvent[] = [];
    const safeSales = sales || [];
    const saleById = new Map(safeSales.map(sale => [sale.id, sale]));
    safeSales.forEach(sale => {
      const date = toReportDate(sale.soldAt);
      if (!date || !inRange(date)) return;
      (sale.items || []).filter(item => item.itemId === productId && !item.isService).forEach((item, index) => rows.push({
        id: `sale-${sale.id}-${index}`,
        kind: 'sale',
        date,
        reference: sale.saleId || sale.id,
        channel: sale.context === 'hotel' ? 'Hotel POS' : sale.context === 'pos' ? 'POS' : 'Not recorded',
        staff: sale.soldByName || 'Unknown staff',
        customer: sale.customerName || 'Walk-in customer',
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.sellingPrice) || 0,
        amount: (Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0),
        status: sale.paymentStatus || 'Unknown',
        payment: sale.paymentMethod || '—',
      }));
    });
    (returns || []).forEach(refund => {
      const date = toReportDate(refund.returnedAt);
      if (!date || !inRange(date)) return;
      const originalSale = saleById.get(refund.originalSaleId);
      (refund.items || []).filter(item => item.itemId === productId).forEach((item, index) => rows.push({
        id: `return-${refund.id}-${index}`,
        kind: 'return',
        date,
        reference: refund.refundId || refund.id,
        channel: originalSale?.context === 'hotel' ? 'Hotel POS' : originalSale?.context === 'pos' ? 'POS' : refund.source === 'RunningTable' ? 'Not recorded (running table)' : 'Not recorded',
        staff: refund.returnedByName || 'Unknown staff',
        customer: refund.customerName || '—',
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.sellingPrice || 0),
        amount: Number(item.refundAmount) || 0,
        status: 'Refunded',
        payment: 'Refund',
        note: refund.reason || undefined,
      }));
    });
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sales, returns, productId, inRange]);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const paginatedEvents = React.useMemo(() => events.slice((currentPage - 1) * pageSize, currentPage * pageSize), [events, currentPage, pageSize]);
  React.useEffect(() => { setCurrentPage(1); }, [dateRange, productId]);
  React.useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const totals = React.useMemo(() => events.reduce((acc, event) => {
    if (event.kind === 'sale') {
      acc.transactions += 1;
      acc.sold += event.quantity;
      acc.gross += event.amount;
    } else {
      acc.returned += event.quantity;
      acc.refunds += event.amount;
    }
    return acc;
  }, { transactions: 0, sold: 0, returned: 0, gross: 0, refunds: 0 }), [events]);

  const productName = product?.name || events.find(event => event.kind === 'sale')?.reference || 'Product report';
  const dateLabel = dateRange?.from ? `${format(dateRange.from, 'dd MMM yyyy')} – ${format(dateRange.to || dateRange.from, 'dd MMM yyyy')}` : 'All dates';
  const printUrl = `/reports/print?productId=${encodeURIComponent(productId)}${dateRange?.from ? `&from=${encodeURIComponent(format(dateRange.from, 'yyyy-MM-dd'))}&to=${encodeURIComponent(format(dateRange.to || dateRange.from, 'yyyy-MM-dd'))}` : ''}`;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/reports')} aria-label="Back to Reports"><ArrowLeft className="h-4 w-4" /></Button>
          <TopHeader name={productName} icon={<Package className="h-7 w-7" />} description={isBranchMode ? `Product sales history · ${currentBranch?.name || 'Current branch'}` : 'Complete product sales and return history, including the originating sales channel.'} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
          <Button onClick={() => router.push(printUrl)}><Printer className="mr-2 h-4 w-4" />Print Product Report</Button>
        </div>
      </div>

      {loading ? <Card><CardContent className="py-16 text-center text-muted-foreground">Loading product history…</CardContent></Card> : !product && events.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Product not found</p><p className="mt-1 text-sm text-muted-foreground">This product may have been removed or is not available in the selected branch.</p></CardContent></Card>
      ) : <>
        <Card>
          <CardHeader><CardTitle>Product information</CardTitle><CardDescription>{product?.category || 'Category not available'} · {dateLabel}</CardDescription></CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex items-start justify-center lg:justify-start">
              <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border bg-muted shadow-sm">
                {(product?.imageUrl || product?.images?.[0]) ? <img src={product.imageUrl || product.images?.[0]} alt={product.name || 'Product image'} loading="lazy" className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-muted-foreground"><Package className="h-12 w-12" /><span className="text-xs">No product image</span></div>}
              </div>
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Product name</p><p className="font-semibold">{product?.name || productName}</p></div>
              <div><p className="text-xs text-muted-foreground">Category</p><p className="font-medium">{product?.category || 'Category not available'}</p></div>
            <div><p className="text-xs text-muted-foreground">SKU / Barcode</p><p className="font-medium">{product?.sku || product?.barcode || 'Not provided'}</p></div>
            <div><p className="text-xs text-muted-foreground">Current on-hand stock</p><p className="font-semibold">{Number(product?.quantity || 0).toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Reserved on running tables</p><p className="font-semibold">{Number(product?.reservedQuantity || 0).toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Currently available to sell</p><p className="font-semibold">{(Number(product?.quantity || 0) - Number(product?.reservedQuantity || 0)).toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sales transactions</p><p className="mt-1 text-2xl font-bold">{totals.transactions.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Units sold</p><p className="mt-1 text-2xl font-bold">{totals.sold.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Units returned</p><p className="mt-1 text-2xl font-bold">{totals.returned.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Gross sales</p><p className="mt-1 text-2xl font-bold">{money(totals.gross)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Refund value</p><p className="mt-1 text-2xl font-bold text-rose-600">{money(totals.refunds)}</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Product transaction timeline</CardTitle><CardDescription>Each sale and return is listed using its recorded transaction timestamp. Channel is taken from the original sale context.</CardDescription></CardHeader>
          <CardContent>
            {events.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No sales or returns for this product in {dateLabel}.</div> :
              <div className="w-full overflow-x-auto"><table className="w-full min-w-[1120px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-3">Date & time</th><th className="px-3 py-3">Type / Reference</th><th className="px-3 py-3">Channel</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Processed by</th><th className="px-3 py-3 text-right">Quantity</th><th className="px-3 py-3 text-right">Unit price</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Payment / Status</th></tr></thead>
                <tbody>{paginatedEvents.map(event => <tr key={event.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-3"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-muted-foreground" />{format(event.date, 'dd MMM yyyy, h:mm:ss a')}</span></td>
                  <td className="px-3 py-3"><div className="font-medium">{event.kind === 'sale' ? 'Sale' : 'Return'}</div><div className="text-xs text-muted-foreground">{event.reference}</div></td>
                  <td className="px-3 py-3"><Badge variant={event.channel === 'POS' ? 'default' : event.channel === 'Hotel POS' ? 'secondary' : 'outline'}>{event.channel}</Badge></td>
                  <td className="px-3 py-3">{event.customer}</td><td className="px-3 py-3">{event.staff}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{event.kind === 'return' ? '-' : ''}{event.quantity.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">{money(event.unitPrice)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${event.kind === 'return' ? 'text-rose-600' : ''}`}>{event.kind === 'return' ? '-' : ''}{money(event.amount)}</td>
                  <td className="px-3 py-3"><Badge variant={event.kind === 'return' ? 'destructive' : event.status === 'Paid' ? 'success' : 'outline'}>{event.kind === 'return' ? 'Refunded' : event.status}</Badge><div className="text-xs text-muted-foreground">{event.payment}</div></td>
                </tr>)}</tbody>
              </table></div>}
            {events.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>Showing <strong className="text-foreground">{((currentPage - 1) * pageSize + 1).toLocaleString()}–{Math.min(currentPage * pageSize, events.length).toLocaleString()}</strong> of <strong className="text-foreground">{events.length.toLocaleString()}</strong> transactions</span>
                <label className="flex items-center gap-2">Rows
                  <select aria-label="Product history rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage <= 1}>Previous</Button>
                <span className="min-w-24 text-center text-sm font-medium tabular-nums">Page {currentPage} of {totalPages}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>Next</Button>
              </div>
            </div>}
          </CardContent>
        </Card>
      </>}
    </div>
  );
}

export default withAuth(ProductReportDetailPage, PagePermission.VIEW_SALES_REPORTS);
