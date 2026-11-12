'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { collection, query } from 'firebase/firestore';
import { endOfDay, format, isWithinInterval, startOfDay, subDays } from 'date-fns';
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
import { ArrowLeft, Banknote, Clock3, Printer, RotateCcw, ShoppingBag } from 'lucide-react';

function SalesReportDetailPage() {
  const params = useParams<{ transactionId: string }>();
  const transactionId = decodeURIComponent(String(params.transactionId || ''));
  const router = useRouter();
  const search = useSearchParams();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    const from = search.get('from') ? new Date(search.get('from')!) : subDays(new Date(), 29);
    const to = search.get('to') ? new Date(search.get('to')!) : new Date();
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
  const stockById = React.useMemo(() => new Map((stock || []).map(item => [item.id, item])), [stock]);
  const isRefund = transactionId.startsWith('refund-');
  const rawId = isRefund ? transactionId.slice('refund-'.length) : transactionId;
  const sale = React.useMemo(() => (sales || []).find(item => item.id === rawId), [sales, rawId]);
  const refund = React.useMemo(() => (returns || []).find(item => item.id === rawId), [returns, rawId]);
  const originalSale = React.useMemo(() => refund ? (sales || []).find(item => item.id === refund.originalSaleId || item.saleId === refund.originalSaleId) : undefined, [refund, sales]);

  const currency = settings?.currency || 'USD';
  const money = React.useCallback((value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0), [currency]);
  const eventDate = sale ? toReportDate(sale.soldAt) : refund ? toReportDate(refund.returnedAt) : null;
  const dateLabel = dateRange?.from ? `${format(dateRange.from, 'dd MMM yyyy')} – ${format(dateRange.to || dateRange.from, 'dd MMM yyyy')}` : 'All dates';
  const inRange = !!eventDate && !!dateRange?.from && isWithinInterval(eventDate, {
    start: startOfDay(dateRange.to && dateRange.from > dateRange.to ? dateRange.to : dateRange.from),
    end: endOfDay(dateRange.to && dateRange.from > dateRange.to ? dateRange.from : dateRange.to || dateRange.from),
  });
  const isFound = isRefund ? !!refund : !!sale;
  const lines = isRefund ? (refund?.items || []).map(item => ({
    id: item.itemId, name: item.itemName, quantity: Number(item.quantity || 0),
    unitPrice: Number(item.sellingPrice ?? (Number(item.refundAmount || 0) / Math.max(1, Number(item.quantity || 0)))),
    amount: Number(item.refundAmount || 0),
  })) : (sale?.items || []).map(item => ({
    id: item.itemId, name: item.itemName, quantity: Number(item.quantity || 0),
    unitPrice: Number(item.sellingPrice || 0), amount: Number(item.quantity || 0) * Number(item.sellingPrice || 0),
  }));
  const grossTotal = sale ? Number(sale.totalAmount || 0) : Number(refund?.originalTotal || originalSale?.totalAmount || 0);
  const collected = sale ? Number(sale.initialPaymentAmount ?? (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0)) : 0;
  const outstanding = sale ? Math.max(0, grossTotal - collected) : 0;
  const refundTotal = refund ? Number(refund.totalRefundAmount || 0) : 0;
  const printUrl = `/reports/print?report=sales&transactionId=${encodeURIComponent(transactionId)}${dateRange?.from ? `&from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to || dateRange.from, 'yyyy-MM-dd')}` : ''}`;

  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push('/reports')} aria-label="Back to Reports"><ArrowLeft className="h-4 w-4" /></Button>
        <TopHeader name={isRefund ? (refund?.refundId || 'Refund information') : (sale?.saleId || 'Sales information')} icon={isRefund ? <RotateCcw className="h-7 w-7" /> : <ShoppingBag className="h-7 w-7" />} description={isBranchMode ? `Sales transaction details · ${currentBranch?.name || 'Current branch'}` : 'Complete transaction information, items, payment and staff details.'} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
        <Button onClick={() => router.push(printUrl)}><Printer className="mr-2 h-4 w-4" />Print Sales Report</Button>
      </div>
    </div>

    {loading ? <Card><CardContent className="py-16 text-center text-muted-foreground">Loading sales transaction…</CardContent></Card> : !isFound ? (
      <Card><CardContent className="py-16 text-center"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Transaction not found</p><p className="mt-1 text-sm text-muted-foreground">This transaction may have been removed or is unavailable in the selected branch.</p></CardContent></Card>
    ) : !inRange ? (
      <Card><CardContent className="py-10 text-center"><p className="font-semibold">Transaction is outside the selected date range</p><p className="mt-1 text-sm text-muted-foreground">Change the date filter to include {eventDate ? format(eventDate, 'dd MMM yyyy') : 'this transaction'}.</p></CardContent></Card>
    ) : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transaction type</p><p className="mt-1 text-xl font-bold">{isRefund ? 'Refund' : 'Sale'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{isRefund ? 'Refund amount' : 'Sale total'}</p><p className="mt-1 text-xl font-bold">{money(isRefund ? refundTotal : grossTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{isRefund ? 'Returned item units' : 'Amount collected'}</p><p className="mt-1 text-xl font-bold">{isRefund ? lines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString() : money(collected)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{isRefund ? 'Original sale reference' : 'Outstanding balance'}</p><p className="mt-1 text-xl font-bold">{isRefund ? (refund?.originalSaleId || '—') : money(outstanding)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Transaction information</CardTitle><CardDescription>{dateLabel}</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Reference</p><p className="font-semibold">{isRefund ? refund?.refundId || refund?.id : sale?.saleId || sale?.id}</p></div>
          <div><p className="text-xs text-muted-foreground">Date & time</p><p className="font-medium">{eventDate ? format(eventDate, 'dd MMM yyyy, h:mm:ss a') : '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Processed by</p><p className="font-medium">{isRefund ? refund?.returnedByName || 'Unknown staff' : sale?.soldByName || 'Unknown staff'}</p></div>
          <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{isRefund ? refund?.customerName || originalSale?.customerName || '—' : sale?.customerName || 'Walk-in customer'}</p></div>
          <div><p className="text-xs text-muted-foreground">Sales channel</p><Badge variant="outline">{(isRefund ? originalSale?.context : sale?.context) === 'hotel' ? 'Hotel POS' : (isRefund ? originalSale?.context : sale?.context) === 'pos' ? 'POS' : 'Not recorded'}</Badge></div>
          <div><p className="text-xs text-muted-foreground">Payment method</p><p className="font-medium">{isRefund ? 'Refund' : sale?.paymentMethod || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Payment status</p><Badge variant={isRefund ? 'destructive' : sale?.paymentStatus === 'Paid' ? 'success' : 'outline'}>{isRefund ? 'Refunded' : sale?.paymentStatus || 'Unknown'}</Badge></div>
          {isRefund && <div><p className="text-xs text-muted-foreground">Refund reason</p><p className="font-medium">{refund?.reason || 'Not specified'}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transaction items</CardTitle><CardDescription>Product image, quantity, unit price and line amount for every recorded item.</CardDescription></CardHeader>
        <CardContent><div className="w-full overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-right">Quantity</th><th className="px-3 py-3 text-right">Unit price</th><th className="px-3 py-3 text-right">Amount</th></tr></thead>
          <tbody>{lines.map((line, index) => { const product = stockById.get(line.id); const image = product?.imageUrl || product?.images?.[0]; return <tr key={line.id + '-' + index} className="border-b last:border-0">
            <td className="px-3 py-3"><div className="flex items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">{image ? <img src={image} alt={line.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ShoppingBag className="h-5 w-5" /></div>}</div><span className="font-medium">{line.name}</span></div></td>
            <td className="px-3 py-3 text-right tabular-nums">{line.quantity.toLocaleString()}</td><td className="px-3 py-3 text-right">{money(line.unitPrice)}</td><td className={`px-3 py-3 text-right font-semibold ${isRefund ? 'text-rose-600' : ''}`}>{money(line.amount)}</td>
          </tr>; })}</tbody>
        </table></div>
        <div className="ml-auto mt-5 w-full max-w-sm space-y-2 border-t pt-4 text-sm">
          {!isRefund && <><div className="flex justify-between"><span className="text-muted-foreground">Sale total</span><b>{money(grossTotal)}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Amount collected</span><b>{money(collected)}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><b>{money(outstanding)}</b></div></>}
          {isRefund && <div className="flex justify-between text-base"><span className="text-muted-foreground">Total refunded</span><b className="text-rose-600">{money(refundTotal)}</b></div>}
        </div></CardContent>
      </Card>
    </>}
  </div>;
}

export default withAuth(SalesReportDetailPage, PagePermission.VIEW_SALES_REPORTS);
