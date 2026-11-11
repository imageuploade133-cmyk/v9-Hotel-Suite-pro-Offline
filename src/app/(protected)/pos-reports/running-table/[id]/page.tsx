'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query } from 'firebase/firestore';
import { ArrowLeft, ClipboardList, Package, UserRound, CalendarClock, StickyNote } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useBranch } from '@/contexts/branch-context';
import { useSettings } from '@/contexts/settings-context';
import type { HeldSale } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { format } from 'date-fns';
import { TopHeader } from '@/components/top-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function RunningTableReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const firestore = useFirestore();
  const { getCollectionPath, isGlobalMode, currentBranch } = useBranch();
  const { settings } = useSettings();
  const tableId = decodeURIComponent(params.id || '');

  const branchQuery = React.useMemo(
    () => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('heldSales'))) : null,
    [firestore, getCollectionPath, isGlobalMode]
  );
  const branchResult = useCollection<HeldSale>(branchQuery);
  const globalResult = useGlobalCollectionData<HeldSale>('heldSales', []);
  const records = isGlobalMode ? globalResult.data : branchResult.data;
  const isLoading = isGlobalMode ? globalResult.isLoading : branchResult.isLoading;
  const table = React.useMemo(() => records.find(record => record.id === tableId) || null, [records, tableId]);

  const currency = settings?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  const heldDate = table ? getSafeDate(table.heldAt) : null;
  const items = table?.cart || [];
  const totalUnits = items.reduce((sum, item) => sum + Number(item.sellQuantity || 0), 0);
  const totalValue = items.reduce((sum, item) => sum + Number(item.price ?? item.sellingPrice ?? 0) * Number(item.sellQuantity || 0), 0);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TopHeader name="Running Table Breakdown" icon={<ClipboardList className="h-8 w-8" />} description={currentBranch?.name ? `Live running-table record · ${currentBranch.name}` : 'Full item, staff and value breakdown for this active POS table.'} />
        <Button variant="outline" onClick={() => router.push('/pos-reports')}><ArrowLeft className="mr-2 h-4 w-4" />Back to POS Reports</Button>
      </div>

      {isLoading ? <Card><CardContent className="py-16 text-center text-muted-foreground">Loading running-table details...</CardContent></Card> :
      !table ? <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><Package className="h-10 w-10 text-muted-foreground" /><h2 className="text-lg font-semibold">Running table not found</h2><p className="max-w-md text-sm text-muted-foreground">This table may have been completed, deleted, or is no longer available in the currently selected branch or POS scope.</p><Button onClick={() => router.push('/pos-reports')}>Return to POS Reports</Button></CardContent></Card> :
      <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-0 bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Table</CardDescription><CardTitle className="text-2xl text-white">{table.name || table.id}</CardTitle></CardHeader><CardContent><Badge className="border-white/30 bg-white/15 text-white hover:bg-white/20">Active running table</Badge></CardContent></Card>
          <Card className="border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Total Items</CardDescription><CardTitle className="text-3xl text-white">{totalUnits.toLocaleString()}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Units currently on this table</CardContent></Card>
          <Card className="border-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Running Table Value</CardDescription><CardTitle className="text-2xl text-white">{money(totalValue)}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Current value, not yet completed income</CardContent></Card>
          <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg"><CardHeader className="pb-2"><CardDescription className="text-white/75">Stock Reservation</CardDescription><CardTitle className="text-2xl text-white">{table.stockReserved || table.stockReservationMode === 'reserved' ? 'Reserved' : 'Legacy / Unknown'}</CardTitle></CardHeader><CardContent className="text-sm text-white/75">Running-table inventory status</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Table Information</CardTitle><CardDescription>Staff and customer details associated with this running table.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Staff</p><p className="font-semibold">{table.heldByName || 'Unknown staff'}</p><p className="text-xs text-muted-foreground">{table.heldByUid || ''}</p></div></div>
            <div className="flex items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold">{table.customer?.name || 'Walk-in customer'}</p><p className="text-xs text-muted-foreground">{table.customer?.phone || ''}</p></div></div>
            <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Created / Held At</p><p className="font-semibold">{heldDate ? format(heldDate, 'PPpp') : 'Date unavailable'}</p></div></div>
            <div className="flex items-start gap-3"><StickyNote className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Notes</p><p className="font-semibold">{table.notes || 'No notes'}</p></div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Item Breakdown</CardTitle><CardDescription>Every item currently held on this table, including quantity and line total.</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b bg-muted/40 text-left"><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Unit Price</th><th className="px-4 py-3 text-right">Subtotal</th></tr></thead>
                <tbody>{items.map((item,index) => {
                  const quantity = Number(item.sellQuantity || 0);
                  const price = Number(item.price ?? item.sellingPrice ?? 0);
                  return <tr key={`${item.id}-${index}`} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{item.name || 'Unnamed item'}</td><td className="px-4 py-3">{item.isService ? <Badge variant="secondary">Service</Badge> : <Badge variant="outline">Stock item</Badge>}</td><td className="px-4 py-3 text-right tabular-nums">{quantity}</td><td className="px-4 py-3 text-right tabular-nums">{money(price)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{money(quantity * price)}</td></tr>;
                })}</tbody>
                <tfoot><tr className="bg-muted/40 font-semibold"><td className="px-4 py-4" colSpan={2}>Total</td><td className="px-4 py-4 text-right">{totalUnits}</td><td className="px-4 py-4 text-right">—</td><td className="px-4 py-4 text-right">{money(totalValue)}</td></tr></tfoot>
              </table>
            </div>
            <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">This is an active running table. Its current value is not counted as completed sales income. Reserved stock remains available in on-hand inventory totals while being protected from another sale.</p>
          </CardContent>
        </Card>
      </>}
    </div>
  );
}

export default withAuth(RunningTableReportDetailPage, PagePermission.VIEW_POS_REPORTS);
