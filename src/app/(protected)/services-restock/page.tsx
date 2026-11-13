'use client';

import * as React from 'react';
import { collection, doc, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { PackagePlus, Search, RotateCcw, History, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useFirestore, useCollection } from '@/firebase';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useBranch } from '@/contexts/branch-context';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { commitLocalFirstMutations } from '@/lib/lan-sync/sync-helper';
import { getSafeDate } from '@/lib/helpers';
import { PagePermission } from '@/lib/permissions';
import withAuth from '@/components/auth/withAuth';
import { TopHeader } from '@/components/top-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { ServiceItem } from '@/lib/types';

type RestockHistoryEntry = {
  id: string;
  itemId: string;
  itemName: string;
  quantityAdded: number;
  previousQuantity: number;
  resultingQuantity: number;
  costPerUnit: number;
  totalCost: number;
  previousCostPrice?: number;
  resultingCostPrice?: number;
  restockedBy: string;
  restockedByUid: string;
  restockedAt: any;
  notes?: string;
  branchId?: string;
};

function ServicesRestockPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();
  const { hasPermission } = usePermissions();
  const canRestock = hasPermission(PagePermission.RESTOCK_SERVICES);
  const [search, setSearch] = React.useState('');
  const [selectedItemId, setSelectedItemId] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [unitCost, setUnitCost] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const currency = settings?.currency || 'USD';

  const servicesQuery = React.useMemo(() => !isGlobalMode && firestore
    ? query(collection(firestore, getCollectionPath('services')), orderBy('name'))
    : null, [firestore, isGlobalMode, getCollectionPath, reloadCounter]);
  const branchServices = useCollection<ServiceItem>(servicesQuery);
  const globalServices = useGlobalCollectionData<ServiceItem>('services', [orderBy('name')]);
  const { data: services, isLoading: servicesLoading } = isGlobalMode ? globalServices : branchServices;

  const historyQuery = React.useMemo(() => !isGlobalMode && firestore
    ? query(collection(firestore, getCollectionPath('serviceRestockHistory')), orderBy('restockedAt', 'desc'))
    : null, [firestore, isGlobalMode, getCollectionPath, reloadCounter]);
  const branchHistory = useCollection<RestockHistoryEntry>(historyQuery);
  const globalHistory = useGlobalCollectionData<RestockHistoryEntry>('serviceRestockHistory', [orderBy('restockedAt', 'desc')]);
  const { data: history, isLoading: historyLoading } = isGlobalMode ? globalHistory : branchHistory;

  const trackedServices = React.useMemo(() => (services || []).filter(item => Number.isFinite(item.quantity)), [services]);
  const selectedItem = trackedServices.find(item => item.id === selectedItemId) || null;
  const visibleHistory = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return (history || []).filter(entry => !term || [entry.itemName, entry.restockedBy, entry.notes].some(value => String(value || '').toLowerCase().includes(term)));
  }, [history, search]);
  const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  const formatDateTime = (value: any) => {
    const date = getSafeDate(value);
    return date ? format(date, 'dd MMM yyyy, hh:mm:ss a') : '—';
  };

  React.useEffect(() => {
    if (selectedItem) setUnitCost(String(selectedItem.costPrice || 0));
  }, [selectedItemId, selectedItem?.costPrice]);

  const handleRestock = async () => {
    if (!canRestock) {
      toast({ variant: 'destructive', title: 'Permission required', description: 'You do not have permission to restock Services & Foods.' });
      return;
    }
    if (!firestore || !userProfile || !selectedItem) return;
    const added = Number(quantity);
    const purchaseCost = Number(unitCost);
    if (!Number.isFinite(added) || added <= 0 || !Number.isFinite(purchaseCost) || purchaseCost < 0) {
      toast({ variant: 'destructive', title: 'Invalid restock details', description: 'Enter a quantity greater than zero and a valid non-negative unit cost.' });
      return;
    }
    setIsSaving(true);
    try {
      const servicePath = selectedItem.branchId ? `branches/${selectedItem.branchId}/services` : getCollectionPath('services');
      const historyPath = selectedItem.branchId ? `branches/${selectedItem.branchId}/serviceRestockHistory` : getCollectionPath('serviceRestockHistory');
      const serviceRef = doc(firestore, servicePath, selectedItem.id);
      const historyRef = doc(collection(firestore, historyPath));
      const beforeQty = Math.max(0, Number(selectedItem.quantity || 0));
      const afterQty = beforeQty + added;
      const beforeCost = Math.max(0, Number(selectedItem.costPrice || 0));
      const afterCost = afterQty > 0 ? ((beforeQty * beforeCost) + (added * purchaseCost)) / afterQty : purchaseCost;
      const entry: RestockHistoryEntry = {
        id: historyRef.id,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantityAdded: added,
        previousQuantity: beforeQty,
        resultingQuantity: afterQty,
        costPerUnit: purchaseCost,
        totalCost: added * purchaseCost,
        previousCostPrice: beforeCost,
        resultingCostPrice: afterCost,
        restockedBy: userProfile.name || userProfile.email || 'Unknown user',
        restockedByUid: userProfile.uid || userProfile.id || '',
        restockedAt: new Date().toISOString(),
        ...(selectedItem.branchId ? { branchId: selectedItem.branchId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await commitLocalFirstMutations([
        { collectionName: servicePath, docId: selectedItem.id, action: 'update', data: { quantity: afterQty, costPrice: afterCost, updatedAt: new Date().toISOString() } },
        { collectionName: historyPath, docId: historyRef.id, action: 'set', data: entry as any },
      ], `service-restock:${historyRef.id}`, async () => {
        const batch = writeBatch(firestore);
        batch.update(serviceRef, { quantity: afterQty, costPrice: afterCost, updatedAt: serverTimestamp() });
        batch.set(historyRef, { ...entry, restockedAt: serverTimestamp() });
        await batch.commit();
      });
      toast({ variant: 'success', title: 'Restock saved', description: `${added} units added to ${selectedItem.name}.` });
      setQuantity('');
      setNotes('');
      setSelectedItemId('');
      setReloadCounter(value => value + 1);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Restock failed', description: error?.message || 'Unable to save this restock.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TopHeader name="Services & Foods Restock" icon={<PackagePlus />} description={isBranchMode ? `Branch: ${currentBranch?.name || 'Current branch'}` : 'Record stock additions and review the complete restock audit history.'} />
        <Button asChild variant="outline"><Link href="/services"><ArrowLeft className="mr-2 h-4 w-4" />Back to Services & Foods</Link></Button>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" />Record a Restock</CardTitle>
          <CardDescription>Only quantity-tracked Services & Foods items are available. Existing stock cost is recalculated using weighted average cost.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="service-restock-item">Service or food item</Label>
            <select id="service-restock-item" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)} disabled={servicesLoading || isSaving}>
              <option value="">Select an item</option>
              {trackedServices.map(item => <option key={item.id} value={item.id}>{item.name} — On hand: {Number(item.quantity || 0)}</option>)}
            </select>
            {selectedItem && <p className="text-xs text-muted-foreground">Current quantity: {selectedItem.quantity} · Current unit cost: {formatMoney(selectedItem.costPrice || 0)}</p>}
          </div>
          <div className="space-y-2"><Label htmlFor="service-restock-quantity">Quantity to add</Label><Input id="service-restock-quantity" type="number" min="0.01" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={!selectedItem || isSaving} placeholder="Enter quantity" /></div>
          <div className="space-y-2"><Label htmlFor="service-restock-unit-cost">Purchase unit cost</Label><Input id="service-restock-unit-cost" type="number" min="0" step="0.01" value={unitCost} onChange={event => setUnitCost(event.target.value)} disabled={!selectedItem || isSaving} placeholder="Enter unit cost" /></div>
          <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label htmlFor="service-restock-notes">Notes / supplier / invoice reference (optional)</Label><Textarea id="service-restock-notes" value={notes} onChange={event => setNotes(event.target.value)} disabled={isSaving} placeholder="Add supporting details for this restock" /></div>
          <div className="flex flex-col justify-end gap-2">
            <p className="text-sm text-muted-foreground">Restock value: <strong className="text-foreground">{formatMoney((Number(quantity) || 0) * (Number(unitCost) || 0))}</strong></p>
            <Button onClick={handleRestock} disabled={!selectedItem || !quantity || isSaving || !canRestock}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}{isSaving ? 'Saving restock…' : 'Save Restock'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Restock History & Audit Trail</CardTitle><CardDescription>Before-and-after stock levels, purchase costs, operator identity and exact restock timestamp.</CardDescription></div>
          <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search item, staff or notes…" /></div>
        </CardHeader>
        <CardContent>
          {historyLoading ? <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading restock history…</div> : visibleHistory.length === 0 ? <EmptyState icon={History} title="No restock history found" description="Restock entries will appear here after a Services & Foods item is restocked." /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-muted/60"><tr className="text-left">
                  <th className="p-3">Date & time</th><th className="p-3">Item</th><th className="p-3 text-right">Before</th><th className="p-3 text-right">Added</th><th className="p-3 text-right">After</th><th className="p-3 text-right">Cost before</th><th className="p-3 text-right">Purchase unit cost</th><th className="p-3 text-right">Cost after</th><th className="p-3 text-right">Restock value</th><th className="p-3">Restocked by</th><th className="p-3">Notes</th>
                </tr></thead>
                <tbody>{visibleHistory.map(entry => <tr key={entry.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-3">{formatDateTime(entry.restockedAt)}</td>
                  <td className="p-3 font-medium">{entry.itemName}</td>
                  <td className="p-3 text-right tabular-nums">{Number(entry.previousQuantity ?? 0).toLocaleString()}</td>
                  <td className="p-3 text-right"><Badge variant="secondary">+{Number(entry.quantityAdded || 0).toLocaleString()}</Badge></td>
                  <td className="p-3 text-right font-semibold tabular-nums">{Number(entry.resultingQuantity ?? (Number(entry.previousQuantity || 0) + Number(entry.quantityAdded || 0))).toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(entry.previousCostPrice ?? 0)}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(entry.costPerUnit || 0)}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(entry.resultingCostPrice ?? entry.costPerUnit ?? 0)}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{formatMoney(entry.totalCost || 0)}</td>
                  <td className="p-3">{entry.restockedBy || 'Unknown'}<div className="text-xs text-muted-foreground">{entry.restockedByUid || ''}</div></td>
                  <td className="max-w-[220px] whitespace-pre-wrap p-3 text-muted-foreground">{entry.notes || '—'}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(ServicesRestockPage, PagePermission.RESTOCK_SERVICES);
