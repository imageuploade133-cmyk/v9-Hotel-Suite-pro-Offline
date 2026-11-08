'use client';

import * as React from 'react';
import { collection, query } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, X, Phone, Mail, Info, Search, Table2, AlertTriangle } from 'lucide-react';
import type { Customer, HeldSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { CustomerSearch } from '../customers/customer-search';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { AddCustomerForm } from '../customers/add-customer-form';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { useBranch } from '@/contexts/branch-context';
import { useUser } from '@/contexts/user-context';
import { fetchLocalLanCollection } from '@/lib/lan-sync/sync-helper';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface CustomerPanelProps {
  selectedCustomer: (Partial<Customer> & { outstandingBalance?: number }) | null;
  onSelectCustomer: (customer: (Partial<Customer> & { outstandingBalance?: number }) | null) => void;
  isSaleRestored: boolean;
  onCustomerAdded?: () => void;
  onSelectRunningTable?: (sale: HeldSale) => void;
  onCancelRunningTable?: () => void;
}

export function CustomerPanel({ selectedCustomer, onSelectCustomer, isSaleRestored, onCustomerAdded, onSelectRunningTable, onCancelRunningTable }: CustomerPanelProps) {
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();
  const isAdminIdentity = userProfile?.isFirebaseOnlyAdmin === true
    || userProfile?.isSuperAdmin === true
    || userProfile?.role === 'Admin'
    || userProfile?.role === 'Super Admin';
  const currency = settings?.currency || 'USD';
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);
  const [searchTab, setSearchTab] = React.useState<'customers' | 'tables'>('customers');
  const [tableSearch, setTableSearch] = React.useState('');
  const [selectedRunningTable, setSelectedRunningTable] = React.useState<HeldSale | null>(null);
  const [pendingClear, setPendingClear] = React.useState<'customer' | 'table' | null>(null);
  const heldSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('heldSales')));
  }, [firestore, getCollectionPath]);
  const { data: heldSales, isLoading: isLoadingCloudTables } = useCollection<HeldSale>(heldSalesQuery);
  const [localHeldSales, setLocalHeldSales] = React.useState<HeldSale[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    if (!isLocalMasterHost()) {
      setLocalHeldSales(null);
      return;
    }
    fetchLocalLanCollection<HeldSale>(getCollectionPath('heldSales'))
      .then(records => { if (!cancelled) setLocalHeldSales(records); })
      .catch(error => {
        console.warn('[POS] Could not load Local Master running tables:', error);
        if (!cancelled) setLocalHeldSales([]);
      });
    return () => { cancelled = true; };
  }, [getCollectionPath]);
  const allRunningTables = React.useMemo(() => {
    const merged = new Map<string, HeldSale>();
    (heldSales || []).forEach(sale => merged.set(sale.id, sale));
    (localHeldSales || []).forEach(sale => merged.set(sale.id, { ...merged.get(sale.id), ...sale }));
    return [...merged.values()];
  }, [heldSales, localHeldSales]);
  const isLoadingTables = isLoadingCloudTables || (isLocalMasterHost() && localHeldSales === null);

  const myRunningTables = React.useMemo(() => {
    if (!userProfile?.uid) return [];
    const term = tableSearch.trim().toLowerCase();
    return allRunningTables
      .filter(sale => isAdminIdentity || sale.heldByUid === userProfile.uid)
      .filter(sale => !term || [
        sale.name, sale.customer?.name, sale.id, sale.heldByName,
        ...(sale.cart || []).map(item => item.name),
      ].some(value => String(value || '').toLowerCase().includes(term)))
      .sort((a, b) => {
        const toMillis = (value: any) => value instanceof Date ? value.getTime()
          : value?.toDate ? value.toDate().getTime()
          : typeof value === 'string' ? new Date(value).getTime() : 0;
        return toMillis(b.heldAt) - toMillis(a.heldAt);
      });
  }, [allRunningTables, userProfile?.uid, isAdminIdentity, tableSearch]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  const isRegisteredCustomer = selectedCustomer && selectedCustomer.id;

  const handleWalkInNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectCustomer(e.target.value ? { name: e.target.value } : null);
  };
  const handleClearSelection = () => setPendingClear('customer');
  const handleSelectTable = (sale: HeldSale) => {
    setSelectedRunningTable(sale);
    setTableSearch('');
    setSearchTab('customers');
    onSelectRunningTable?.(sale);
  };
  const confirmClearSelection = () => {
    if (pendingClear === 'customer') onSelectCustomer(null);
    if (pendingClear === 'table') {
      setSelectedRunningTable(null);
      onCancelRunningTable?.();
    }
    setPendingClear(null);
  };
  const handleSuccess = () => {
    onCustomerAdded?.();
    setIsAddCustomerOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Customer
            <Button variant="outline" size="sm" onClick={() => setIsAddCustomerOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> New
            </Button>
            {isSaleRestored && (
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent><p>Customer cannot be changed on a restored sale.</p></TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedRunningTable ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-muted/50 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Table2 className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{selectedRunningTable.name || 'Running Table'}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedRunningTable.customer?.name || 'Walk-in Customer'} · Running table loaded</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Cancel selected running table" onClick={() => setPendingClear('table')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : isRegisteredCustomer ? (
            <div className="flex items-start justify-between rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedCustomer?.photoURL || ''} alt={selectedCustomer?.name} />
                  <AvatarFallback>{getInitials(selectedCustomer?.name || 'C')}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">{selectedCustomer.name}</p>
                  {selectedCustomer.phoneNumber && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{selectedCustomer.phoneNumber}</p>}
                  {selectedCustomer.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{selectedCustomer.email}</p>}
                </div>
              </div>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Cancel selected customer" onClick={handleClearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <fieldset disabled={isSaleRestored} className="space-y-4 group">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="walk-in-name">Walk-in Customer Name</Label>
                  <Input id="walk-in-name" value={selectedCustomer?.name === 'Walk-in Customer' ? '' : selectedCustomer?.name || ''} onChange={handleWalkInNameChange} placeholder="Enter name (e.g., Table 5) or leave empty" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium"><Search className="h-4 w-4" /> Or search existing</div>
                  <Tabs value={searchTab} onValueChange={(value) => setSearchTab(value as 'customers' | 'tables')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="customers">Customers</TabsTrigger>
                      <TabsTrigger value="tables"><Table2 className="mr-2 h-4 w-4" /> {isAdminIdentity ? 'All Running Tables' : 'My Running Tables'}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="customers" className="mt-3">
                      <CustomerSearch onSelectCustomer={onSelectCustomer} collectionName="posCustomers" />
                    </TabsContent>
                    <TabsContent value="tables" className="mt-3 space-y-2">
                      <Input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder={isAdminIdentity ? "Search all running tables..." : "Search your running tables..."} />
                      <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-1">
                        {isLoadingTables ? (
                          <p className="p-3 text-center text-sm text-muted-foreground">{isAdminIdentity ? 'Loading all running tables...' : 'Loading your running tables...'}</p>
                        ) : myRunningTables.length ? myRunningTables.map(sale => (
                          <button key={sale.id} type="button" onClick={() => handleSelectTable(sale)} className="flex w-full items-center justify-between gap-3 rounded-md p-3 text-left hover:bg-accent">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{sale.name || 'Running Table'}</span>
                              <span className="block truncate text-xs text-muted-foreground">{sale.customer?.name || 'Walk-in Customer'} · {(sale.cart || []).length} item(s)</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatCurrency((sale.cart || []).reduce((sum, item) => sum + (Number(item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0))}</span>
                          </button>
                        )) : (
                          <p className="p-3 text-center text-sm text-muted-foreground">{tableSearch ? 'No matching running table found.' : 'You have no running tables yet.'}</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </fieldset>
          )}
          {selectedCustomer?.outstandingBalance !== undefined && selectedCustomer.outstandingBalance > 0 && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Outstanding Balance:</span>
                <span className="font-bold text-lg">{formatCurrency(selectedCustomer.outstandingBalance)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={pendingClear !== null} onOpenChange={(open) => { if (!open) setPendingClear(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> {pendingClear === 'table' ? 'Cancel selected running table?' : 'Remove selected customer?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingClear === 'table'
                ? 'This will clear the loaded running table and its current POS cart. The saved running table will not be deleted.'
                : 'This will remove the selected customer from this sale. No customer record will be deleted.'}
              {' '}Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Selection</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); confirmClearSelection(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Cancel Selection</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AddCustomerForm open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen} onSuccess={handleSuccess} collectionName="posCustomers" />
    </>
  );
}
