
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, X, Phone, Mail, Info, Search, List } from 'lucide-react';
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
import { collection, query, orderBy } from 'firebase/firestore';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface CustomerPanelProps {
  selectedCustomer: (Partial<Customer> & { outstandingBalance?: number }) | null;
  onSelectCustomer: (customer: (Partial<Customer> & { outstandingBalance?: number }) | null) => void;
  isSaleRestored: boolean;
  onCustomerAdded?: () => void;
  onRestoreHeldSale?: (sale: HeldSale) => void;
}

export function CustomerPanel({
  selectedCustomer,
  onSelectCustomer,
  isSaleRestored,
  onCustomerAdded,
  onRestoreHeldSale,
}: CustomerPanelProps) {
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();
  const { userProfile } = useUser();
  const currency = settings?.currency || 'USD';

  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);
  const [activeSearchTab, setActiveSearchTab] = React.useState<'customer' | 'tables'>('customer');
  const [tableSearchTerm, setTableSearchTerm] = React.useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const isRegisteredCustomer = selectedCustomer && selectedCustomer.id;

  // Load active running tables for running table search
  const heldSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('heldSales')), orderBy('heldAt', 'desc'));
  }, [firestore, getCollectionPath]);

  const { data: allHeldSales } = useCollection<HeldSale>(heldSalesQuery);

  // Filter running tables: user's own tables (or branch tables) matching search
  const myHeldSales = React.useMemo(() => {
    if (!allHeldSales) return [];
    const currentUid = userProfile?.uid;
    // Prioritize user's own tables or show all accessible tables in current branch
    return allHeldSales.filter((sale) => {
      const isOwner = !currentUid || sale.heldByUid === currentUid || userProfile?.role === 'Admin';
      if (!isOwner) return false;
      if (!tableSearchTerm.trim()) return true;
      const term = tableSearchTerm.toLowerCase();
      const tableName = (sale.name || '').toLowerCase();
      const customerName = (sale.customer?.name || '').toLowerCase();
      return tableName.includes(term) || customerName.includes(term);
    });
  }, [allHeldSales, userProfile, tableSearchTerm]);

  const handleWalkInNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    onSelectCustomer(newName ? { name: newName } : null);
  };

  const handleClearSelection = () => {
    onSelectCustomer(null);
  };

  const handleSuccess = () => {
    if (onCustomerAdded) onCustomerAdded();
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
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Customer cannot be changed on a restored sale.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset disabled={isSaleRestored} className="space-y-4 group">
            {isRegisteredCustomer ? (
              <div className="flex items-start justify-between rounded-lg border p-4 bg-muted/50 group-disabled:opacity-70">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedCustomer?.photoURL || ''} alt={selectedCustomer?.name} />
                    <AvatarFallback>{getInitials(selectedCustomer?.name || 'C')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold">{selectedCustomer.name}</p>
                    {selectedCustomer.phoneNumber && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {selectedCustomer.phoneNumber}
                      </p>
                    )}
                    {selectedCustomer.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />
                        {selectedCustomer.email}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="walk-in-name">Walk-in Customer Name</Label>
                  <Input
                    id="walk-in-name"
                    value={selectedCustomer?.name === 'Walk-in Customer' ? '' : selectedCustomer?.name || ''}
                    onChange={handleWalkInNameChange}
                    placeholder="Enter name (e.g., Table 5) or leave empty"
                  />
                </div>

                {/* Tabs to switch between searching existing customers or running tables */}
                <Tabs value={activeSearchTab} onValueChange={(val) => setActiveSearchTab(val as 'customer' | 'tables')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted/70">
                    <TabsTrigger value="customer" className="text-xs flex items-center justify-center gap-1.5 py-1">
                      <Search className="h-3.5 w-3.5" />
                      Or Search Existing
                    </TabsTrigger>
                    <TabsTrigger value="tables" className="text-xs flex items-center justify-center gap-1.5 py-1">
                      <List className="h-3.5 w-3.5" />
                      Running Tables
                      {myHeldSales.length > 0 && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                          {myHeldSales.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="customer" className="mt-3">
                    <CustomerSearch onSelectCustomer={onSelectCustomer} collectionName="posCustomers" />
                  </TabsContent>

                  <TabsContent value="tables" className="mt-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search running tables..."
                        value={tableSearchTerm}
                        onChange={(e) => setTableSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                      {tableSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setTableSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <ScrollArea className="h-44 rounded-md border p-1 bg-background">
                      {myHeldSales.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          {tableSearchTerm ? 'No matching running tables found.' : 'No active running tables.'}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {myHeldSales.map((sale) => {
                            const totalAmount = (sale.cart || []).reduce(
                              (sum, item) => sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)),
                              0
                            );
                            const itemsCount = (sale.cart || []).reduce((sum, item) => sum + Number(item.sellQuantity || 0), 0);

                            return (
                              <div
                                key={sale.id}
                                onClick={() => {
                                  if (onRestoreHeldSale) {
                                    onRestoreHeldSale(sale);
                                  }
                                }}
                                className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer transition-colors text-left"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="font-semibold text-sm truncate">{sale.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {sale.customer?.name || 'Walk-in'} • {itemsCount} items
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-bold text-primary">{formatCurrency(totalAmount)}</p>
                                  <Badge variant="outline" className="text-[10px] h-4 py-0">
                                    Load Table
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </fieldset>

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
      <AddCustomerForm
        open={isAddCustomerOpen}
        onOpenChange={setIsAddCustomerOpen}
        onSuccess={handleSuccess}
        collectionName="posCustomers"
      />
    </>
  );
}
