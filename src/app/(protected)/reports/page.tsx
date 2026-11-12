'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import type { StockItem, StockSale, StockReturn, HeldSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { TopHeader } from '@/components/top-header';
import { StatCard } from '@/components/ui/stat-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSafeDate } from '@/lib/helpers';
import { endOfDay, format, isWithinInterval, startOfDay, subDays } from 'date-fns';
import { Banknote, BarChart3, Package, RotateCcw, Search, ShoppingBag, TrendingUp, Table2, Printer } from 'lucide-react';

type ProductRow = {
  id: string;
  name: string;
  imageUrl?: string;
  category: string;
  stock: number;
  unitsSold: number;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  cost: number;
  netProfit: number;
};

type SaleRow = {
  id: string;
  reference: string;
  date: Date | null;
  staff: string;
  customer: string;
  payment: string;
  status: string;
  items: string;
  amount: number;
};

function ReportsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }));
  const [productSearch, setProductSearch] = React.useState('');
  const [salesSearch, setSalesSearch] = React.useState('');
  const [productPage, setProductPage] = React.useState(1);
  const [salesPage, setSalesPage] = React.useState(1);
  const [productPageSize, setProductPageSize] = React.useState(10);
  const [salesPageSize, setSalesPageSize] = React.useState(10);

  const stockQuery = React.useMemo(() => !isGlobalMode && firestore
    ? query(collection(firestore, getCollectionPath('stock'))) : null,
  [firestore, getCollectionPath, isGlobalMode]);
  const salesQuery = React.useMemo(() => !isGlobalMode && firestore
    ? query(collection(firestore, getCollectionPath('stockSales'))) : null,
  [firestore, getCollectionPath, isGlobalMode]);
  const returnsQuery = React.useMemo(() => !isGlobalMode && firestore
    ? query(collection(firestore, getCollectionPath('stockReturns'))) : null,
  [firestore, getCollectionPath, isGlobalMode]);
  const heldQuery = React.useMemo(() => !isGlobalMode && firestore
    ? query(collection(firestore, getCollectionPath('heldSales'))) : null,
  [firestore, getCollectionPath, isGlobalMode]);

  const branchStock = useCollection<StockItem>(stockQuery);
  const branchSales = useCollection<StockSale>(salesQuery);
  const branchReturns = useCollection<StockReturn>(returnsQuery);
  const branchHeld = useCollection<HeldSale>(heldQuery);
  const globalStock = useGlobalCollectionData<StockItem>('stock', []);
  const globalSales = useGlobalCollectionData<StockSale>('stockSales', []);
  const globalReturns = useGlobalCollectionData<StockReturn>('stockReturns', []);
  const globalHeld = useGlobalCollectionData<HeldSale>('heldSales', []);

  const stock = isGlobalMode ? globalStock.data : branchStock.data;
  const sales = isGlobalMode ? globalSales.data : branchSales.data;
  const returns = isGlobalMode ? globalReturns.data : branchReturns.data;
  const heldTables = isGlobalMode ? globalHeld.data : branchHeld.data;
  const loading = isGlobalMode
    ? globalStock.isLoading || globalSales.isLoading || globalReturns.isLoading || globalHeld.isLoading
    : branchStock.isLoading || branchSales.isLoading || branchReturns.isLoading || branchHeld.isLoading;

  const currency = settings?.currency || 'USD';
  const money = React.useCallback((value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
  }).format(Number.isFinite(value) ? value : 0), [currency]);

  const inRange = React.useCallback((value: unknown) => {
    const date = getSafeDate(value as any);
    if (!date || !dateRange?.from) return false;
    return isWithinInterval(date, {
      start: startOfDay(dateRange.from),
      end: endOfDay(dateRange.to || dateRange.from),
    });
  }, [dateRange]);

  const filteredSales = React.useMemo(
    () => (sales || []).filter(sale => inRange(sale.soldAt)),
    [sales, inRange],
  );
  const filteredReturns = React.useMemo(
    () => (returns || []).filter(refund => inRange(refund.returnedAt)),
    [returns, inRange],
  );
  const filteredHeldTables = React.useMemo(
    () => (heldTables || []).filter(table => inRange(table.heldAt)),
    [heldTables, inRange],
  );

  const productRows = React.useMemo<ProductRow[]>(() => {
    const rows = new Map<string, ProductRow>();
    (stock || []).forEach(item => rows.set(item.id, {
      id: item.id,
      name: item.name || 'Unnamed product',
      imageUrl: item.imageUrl || item.images?.[0] || undefined,
      category: item.category || 'Uncategorized',
      stock: Number(item.quantity || 0),
      unitsSold: 0,
      grossRevenue: 0,
      refunds: 0,
      netRevenue: 0,
      cost: 0,
      netProfit: 0,
    }));

    filteredSales.forEach(sale => (sale.items || []).forEach(item => {
      const row = rows.get(item.itemId);
      if (!row) return;
      const quantity = Math.max(0, Number(item.quantity || 0));
      const price = Math.max(0, Number(item.sellingPrice || 0));
      const cost = Math.max(0, Number(item.costPrice ?? (stock || []).find(p => p.id === item.itemId)?.costPrice ?? 0));
      row.unitsSold += quantity;
      row.grossRevenue += quantity * price;
      row.cost += quantity * cost;
    }));

    filteredReturns.forEach(refund => (refund.items || []).forEach(item => {
      const row = rows.get(item.itemId);
      if (!row) return;
      const quantity = Math.max(0, Number(item.quantity || 0));
      const refundAmount = Math.max(0, Number(item.refundAmount || 0));
      const unitCost = Math.max(0, Number((stock || []).find(p => p.id === item.itemId)?.costPrice || 0));
      row.unitsSold = Math.max(0, row.unitsSold - quantity);
      row.refunds += refundAmount;
      row.cost = Math.max(0, row.cost - quantity * unitCost);
    }));

    return Array.from(rows.values()).map(row => ({
      ...row,
      netRevenue: Math.max(0, row.grossRevenue - row.refunds),
      netProfit: row.grossRevenue - row.refunds - row.cost,
    })).sort((a, b) => b.netRevenue - a.netRevenue);
  }, [stock, filteredSales, filteredReturns]);

  const saleRows = React.useMemo<SaleRow[]>(() => {
    const rows: SaleRow[] = filteredSales.map(sale => ({
      id: sale.id,
      reference: sale.saleId || sale.id,
      date: getSafeDate(sale.soldAt),
      staff: sale.soldByName || 'Unknown staff',
      customer: sale.customerName || 'Walk-in customer',
      payment: sale.paymentMethod || '—',
      status: sale.paymentStatus || 'Unknown',
      items: (sale.items || []).map(item => `${item.itemName} × ${item.quantity}`).join(', ') || 'No items',
      amount: Number(sale.initialPaymentAmount ?? (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0)),
    }));
    filteredReturns.forEach(refund => rows.push({
      id: `refund-${refund.id}`,
      reference: refund.refundId || refund.id,
      date: getSafeDate(refund.returnedAt),
      staff: refund.returnedByName || 'Unknown staff',
      customer: refund.customerName || '—',
      payment: 'Refund',
      status: 'Refunded',
      items: (refund.items || []).map(item => `${item.itemName} × ${item.quantity}`).join(', ') || 'Returned items',
      amount: -Math.abs(Number(refund.totalRefundAmount || 0)),
    }));
    return rows.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [filteredSales, filteredReturns]);

  const productTotals = React.useMemo(() => productRows.reduce((total, row) => ({
    units: total.units + row.unitsSold,
    revenue: total.revenue + row.grossRevenue,
    refunds: total.refunds + row.refunds,
    profit: total.profit + row.netProfit,
  }), { units: 0, revenue: 0, refunds: 0, profit: 0 }), [productRows]);

  const salesTotals = React.useMemo(() => ({
    gross: filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0),
    collected: filteredSales.reduce((sum, sale) => sum + Number(sale.initialPaymentAmount ?? (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0)), 0),
    refunds: filteredReturns.reduce((sum, refund) => sum + Number(refund.totalRefundAmount || 0), 0),
    running: filteredHeldTables.length,
    transactions: filteredSales.length,
  }), [filteredSales, filteredReturns, filteredHeldTables]);

  const filteredProducts = React.useMemo(() => productRows.filter(row =>
    [row.name, row.category].some(value => value.toLowerCase().includes(productSearch.trim().toLowerCase()))), [productRows, productSearch]);
  const filteredSalesRows = React.useMemo(() => saleRows.filter(row =>
    [row.reference, row.staff, row.customer, row.payment, row.status, row.items]
      .some(value => value.toLowerCase().includes(salesSearch.trim().toLowerCase()))), [saleRows, salesSearch]);
  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));
  const salesTotalPages = Math.max(1, Math.ceil(filteredSalesRows.length / salesPageSize));
  const visibleProducts = React.useMemo(() => filteredProducts.slice((productPage - 1) * productPageSize, productPage * productPageSize), [filteredProducts, productPage, productPageSize]);
  const visibleSales = React.useMemo(() => filteredSalesRows.slice((salesPage - 1) * salesPageSize, salesPage * salesPageSize), [filteredSalesRows, salesPage, salesPageSize]);
  React.useEffect(() => { setProductPage(1); }, [productSearch, dateRange]);
  React.useEffect(() => { setSalesPage(1); }, [salesSearch, dateRange]);
  React.useEffect(() => { if (productPage > productTotalPages) setProductPage(productTotalPages); }, [productPage, productTotalPages]);
  React.useEffect(() => { if (salesPage > salesTotalPages) setSalesPage(salesTotalPages); }, [salesPage, salesTotalPages]);

  const dateLabel = dateRange?.from
    ? `${format(dateRange.from, 'dd MMM yyyy')} – ${format(dateRange.to || dateRange.from, 'dd MMM yyyy')}`
    : 'All dates';

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TopHeader name="Reports" icon={<BarChart3 className="h-8 w-8" />} description={isBranchMode ? `Product and sales performance — ${currentBranch?.name || 'Current branch'}` : 'Product performance, sales collections, refunds and running-table activity.'} />
        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
      </div>

      <Tabs defaultValue="products" className="w-full space-y-4">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2">
          <TabsTrigger value="products" className="gap-2 py-2.5"><Package className="h-4 w-4" />Product Report</TabsTrigger>
          <TabsTrigger value="sales" className="gap-2 py-2.5"><ShoppingBag className="h-4 w-4" />Sales Report</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Banknote} title="Gross Revenue" value={money(productTotals.revenue)} description={dateLabel} className="border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={TrendingUp} title="Net Profit" value={money(productTotals.profit)} description="After estimated product cost and recorded refunds." className="border-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={Package} title="Net Units Sold" value={productTotals.units.toLocaleString()} description="Units sold less returned quantities." className="border-0 bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={RotateCcw} title="Refunds" value={money(productTotals.refunds)} description="Recorded product return value." className="border-0 bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
          </div>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>Product Performance</CardTitle><CardDescription>Sales, returns, current stock and estimated profit for {dateLabel}.</CardDescription></div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="outline" onClick={() => router.push(`/reports/print?from=${dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}&to=${dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}`)}><Printer className="mr-2 h-4 w-4" />Print Product Report</Button>
                <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search products or categories..." className="pl-9" /></div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading product report…</div> :
                visibleProducts.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No product performance found for this period.</div> :
                <div className="w-full overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-3">Product</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">Current Stock</th><th className="px-3 py-3 text-right">Net Units Sold</th><th className="px-3 py-3 text-right">Gross Revenue</th><th className="px-3 py-3 text-right">Refunds</th><th className="px-3 py-3 text-right">Net Profit</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
                  <tbody>{visibleProducts.map(row => <tr key={row.id} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-3"><div className="flex min-w-[190px] items-center gap-3"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-muted">{row.imageUrl ? <img src={row.imageUrl} alt={row.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>}</div><span className="font-medium">{row.name}</span></div></td><td className="px-3 py-3 text-muted-foreground">{row.category}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.stock.toLocaleString()}</td><td className="px-3 py-3 text-right tabular-nums">{row.unitsSold.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-medium">{money(row.grossRevenue)}</td><td className="px-3 py-3 text-right text-rose-600">{money(row.refunds)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${row.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{money(row.netProfit)}</td>
                    <td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => router.push(`/reports/products/${encodeURIComponent(row.id)}?from=${dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}&to=${dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}`)}>View Report</Button></td>
                  </tr>)}</tbody>
                </table></div>}
              {!loading && filteredProducts.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Showing <strong className="text-foreground">{((productPage - 1) * productPageSize + 1).toLocaleString()}–{Math.min(productPage * productPageSize, filteredProducts.length).toLocaleString()}</strong> of <strong className="text-foreground">{filteredProducts.length.toLocaleString()}</strong> products</span>
                  <label className="flex items-center gap-2">Rows
                    <select aria-label="Products per page" value={productPageSize} onChange={event => { setProductPageSize(Number(event.target.value)); setProductPage(1); }} className="h-9 rounded-md border bg-background px-2 text-sm">
                      <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setProductPage(page => Math.max(1, page - 1))} disabled={productPage <= 1}>Previous</Button>
                  <span className="min-w-24 text-center text-sm font-medium tabular-nums">Page {productPage} of {productTotalPages}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setProductPage(page => Math.min(productTotalPages, page + 1))} disabled={productPage >= productTotalPages}>Next</Button>
                </div>
              </div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={ShoppingBag} title="Completed Sales" value={salesTotals.transactions.toLocaleString()} description="Sales recorded in the selected period." className="border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={Banknote} title="Gross Sales" value={money(salesTotals.gross)} description="Total value before refunds." className="border-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={TrendingUp} title="Collected" value={money(salesTotals.collected)} description="Payments collected against sales." className="border-0 bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={RotateCcw} title="Refunds" value={money(salesTotals.refunds)} description="Refunds issued in this period." className="border-0 bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
            <StatCard icon={Table2} title="Running Tables" value={salesTotals.running.toLocaleString()} description="Tables currently held in the selected period." className="border-0 bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg [&_p]:text-white/80 [&_svg]:text-white [&_h3]:text-white" />
          </div>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>Sales Performance</CardTitle><CardDescription>Completed sales and recorded refunds, with transaction-level details for {dateLabel}.</CardDescription></div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="outline" onClick={() => router.push(`/reports/print?report=sales&from=${dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}&to=${dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}`)}><Printer className="mr-2 h-4 w-4" />Print Sales Report</Button>
                <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={salesSearch} onChange={event => setSalesSearch(event.target.value)} placeholder="Search reference, staff or customer..." className="pl-9" /></div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading sales report…</div> :
                visibleSales.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No sales or refunds found for this period.</div> :
                <div className="w-full overflow-x-auto"><table className="w-full min-w-[1160px] text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Staff</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Items</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
                  <tbody>{visibleSales.map(row => <tr key={row.id} className="border-b hover:bg-muted/40">
                    <td className="whitespace-nowrap px-3 py-3">{row.date ? format(row.date, 'dd MMM yyyy, h:mm a') : '—'}</td><td className="px-3 py-3 font-medium">{row.reference}</td><td className="px-3 py-3">{row.staff}</td><td className="px-3 py-3">{row.customer}</td>
                    <td className="max-w-[260px] truncate px-3 py-3" title={row.items}>{row.items}</td><td className="px-3 py-3">{row.payment}</td>
                    <td className="px-3 py-3"><Badge variant={row.status === 'Paid' ? 'default' : row.status === 'Refunded' ? 'destructive' : 'outline'}>{row.status}</Badge></td>
                    <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${row.amount < 0 ? 'text-rose-600' : ''}`}>{money(row.amount)}</td>
                    <td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => router.push(`/reports/sales/${encodeURIComponent(row.id)}?from=${dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}&to=${dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}`)}>View Report</Button></td>
                  </tr>)}</tbody>
                </table></div>}
              {!loading && filteredSalesRows.length > 0 && <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Showing <strong className="text-foreground">{((salesPage - 1) * salesPageSize + 1).toLocaleString()}–{Math.min(salesPage * salesPageSize, filteredSalesRows.length).toLocaleString()}</strong> of <strong className="text-foreground">{filteredSalesRows.length.toLocaleString()}</strong> transactions</span>
                  <label className="flex items-center gap-2">Rows
                    <select aria-label="Sales rows per page" value={salesPageSize} onChange={event => { setSalesPageSize(Number(event.target.value)); setSalesPage(1); }} className="h-9 rounded-md border bg-background px-2 text-sm">
                      <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSalesPage(page => Math.max(1, page - 1))} disabled={salesPage <= 1}>Previous</Button>
                  <span className="min-w-24 text-center text-sm font-medium tabular-nums">Page {salesPage} of {salesTotalPages}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSalesPage(page => Math.min(salesTotalPages, page + 1))} disabled={salesPage >= salesTotalPages}>Next</Button>
                </div>
              </div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ReportsPage, PagePermission.VIEW_SALES_REPORTS);
