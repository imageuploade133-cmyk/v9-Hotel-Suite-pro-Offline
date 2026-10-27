
'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  serverTimestamp,
  orderBy,
  runTransaction,
  updateDoc,
  increment,
  where,
  Timestamp,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { Package, Plus, DollarSign, TrendingUp, Search, ChevronDown, Save, History, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockItem, StockSupplier, StockCategory } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { useSettings } from '@/contexts/settings-context';
import { StatCard } from '@/components/ui/stat-card';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getSafeDate } from '@/lib/helpers';
import { isToday, format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { AlertTriangle, XCircle } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBranch } from '@/contexts/branch-context';

interface RestockEntry {
  id: string;
  itemId: string;
  itemName: string;
  quantityAdded: number;
  costPerUnit: number;
  totalCost: number;
  notes?: string;
  restockedBy: string;
  restockedByUid: string;
  restockedAt: Date | Timestamp;
  supplier?: string;
  invoiceNumber?: string;
}

function RestockInventoryPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [restockQuantities, setRestockQuantities] = React.useState<Record<string, string>>({});
  const [restockCosts, setRestockCosts] = React.useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = React.useState<Record<string, boolean>>({});
  const [isRestockDialogOpen, setIsRestockDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [bulkRestockNotes, setBulkRestockNotes] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('restock');

  const { hasPermission } = usePermissions();
  const canManageItems = hasPermission(PagePermission.RESTOCK_INVENTORY);

  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { getCollectionPath, currentBranchId, isBranchMode, isGlobalMode, currentBranch } = useBranch();

  const constraints = React.useMemo(() => {
    const c: any[] = [orderBy('name')];
    if (selectedCategory !== 'all') {
      c.push(where('category', '==', selectedCategory));
    }
    return c;
  }, [selectedCategory]);

  const historyConstraints = React.useMemo(() => [orderBy('restockedAt', 'desc')], []);

  // Branch mode: use standard useCollection
  const branchStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock')), ...constraints) : null, [firestore, isGlobalMode, getCollectionPath, constraints]);
  const branchCategoriesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockCategories'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchHistoryQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('restockHistory')), ...historyConstraints) : null, [firestore, isGlobalMode, getCollectionPath, historyConstraints]);
  const branchSuppliersQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('suppliers'))) : null, [firestore, isGlobalMode, getCollectionPath]);

  const branchStockResult = useCollection<StockItem>(branchStockQuery);
  const branchCategoriesResult = useCollection<StockCategory>(branchCategoriesQuery);
  const branchHistoryResult = useCollection<RestockEntry>(branchHistoryQuery);
  const branchSuppliersResult = useCollection<StockSupplier>(branchSuppliersQuery);

  // Global mode: use global collection hook
  const globalStockResult = useGlobalCollectionData<StockItem>('stock', constraints);
  const globalCategoriesResult = useGlobalCollectionData<StockCategory>('stockCategories', []);
  const globalHistoryResult = useGlobalCollectionData<RestockEntry>('restockHistory', historyConstraints);
  const globalSuppliersResult = useGlobalCollectionData<StockSupplier>('suppliers', []);

  // Use appropriate result based on mode
  const { data: stockItems, isLoading: areStockItemsLoading } = isGlobalMode ? globalStockResult : branchStockResult;
  const { data: categories, isLoading: areCategoriesLoading } = isGlobalMode ? globalCategoriesResult : branchCategoriesResult;
  const { data: restockHistory, isLoading: isHistoryLoading } = isGlobalMode ? globalHistoryResult : branchHistoryResult;
  const { data: suppliers } = isGlobalMode ? globalSuppliersResult : branchSuppliersResult;

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const handleSuccess = () => setReloadCounter(c => c + 1);

  const stats = React.useMemo(() => {
    const safeStockItems = stockItems || [];
    const safeRestockHistory = restockHistory || [];

    const totalProducts = safeStockItems.length;
    const totalStock = safeStockItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalInventoryValue = safeStockItems.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);

    const lowStockItems = safeStockItems.filter(item => item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 0));
    const outOfStockItems = safeStockItems.filter(item => item.quantity <= 0);

    const todaysRestocks = safeRestockHistory.filter(entry => {
      const date = getSafeDate(entry.restockedAt);
      return date && isToday(date);
    });
    const todaysItemsRestocked = todaysRestocks.reduce((sum, entry) => sum + entry.quantityAdded, 0);
    const todaysRestockCost = todaysRestocks.reduce((sum, entry) => sum + entry.totalCost, 0);

    const totalItemsRestocked = safeRestockHistory.reduce((sum, entry) => sum + entry.quantityAdded, 0);
    const totalRestockCost = safeRestockHistory.reduce((sum, entry) => sum + entry.totalCost, 0);

    return {
      totalProducts,
      totalStock,
      totalInventoryValue: formatCurrency(totalInventoryValue),
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      todaysItemsRestocked,
      todaysRestockCost: formatCurrency(todaysRestockCost),
      totalItemsRestocked,
      totalRestockCost: formatCurrency(totalRestockCost),
    };
  }, [stockItems, restockHistory, currency]);

  const filteredItems = React.useMemo(() => {
    if (!stockItems) return [];
    return stockItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [stockItems, searchTerm]);

  const handleQuantityChange = (itemId: string, value: string) => {
    setRestockQuantities(prev => ({ ...prev, [itemId]: value }));
  };

  const handleCostChange = (itemId: string, value: string) => {
    setRestockCosts(prev => ({ ...prev, [itemId]: value }));
  };

  const handleRestock = async (item: StockItem) => {
    const qtyStr = restockQuantities[item.id];
    const costStr = restockCosts[item.id];

    if (!qtyStr || isNaN(Number(qtyStr)) || Number(qtyStr) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Quantity',
        description: 'Please enter a valid quantity greater than 0.',
      });
      return;
    }

    const quantity = Number(qtyStr);
    const costPerUnit = costStr && !isNaN(Number(costStr)) ? Number(costStr) : (item.costPrice || 0);
    const totalCost = quantity * costPerUnit;

    setSavingStates(prev => ({ ...prev, [item.id]: true }));

    try {
      if (!firestore || !userProfile) throw new Error('Not authenticated');

      // Update stock quantity and cost price if changed
      const stockPath = isBranchMode && currentBranchId ? `branches/${currentBranchId}/stock` : 'stock';
      const stockRef = doc(firestore, stockPath, item.id);
      await updateDoc(stockRef, {
        quantity: increment(quantity),
        costPrice: costPerUnit,
        updatedAt: serverTimestamp(),
      });

      // Create restock history entry
      const restockEntryData: Record<string, any> = {
        itemId: item.id,
        itemName: item.name,
        quantityAdded: quantity,
        costPerUnit,
        totalCost,
        restockedBy: userProfile.name || 'Unknown',
        restockedByUid: userProfile.id || '',
        restockedAt: serverTimestamp(),
      };

      // Add branch ID for branch-isolated collections
      if (isBranchMode && currentBranchId) {
        restockEntryData.branchId = currentBranchId;
      }

      // Only add notes if it has a value
      if (bulkRestockNotes && bulkRestockNotes.trim()) {
        restockEntryData.notes = bulkRestockNotes.trim();
      }

      const historyPath = getCollectionPath('restockHistory');
      await setDoc(doc(collection(firestore, historyPath)), restockEntryData);

      toast({
        variant: 'success',
        title: 'Restocked Successfully',
        description: `Added ${quantity} units to ${item.name}.`,
      });

      setRestockQuantities(prev => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });
      setRestockCosts(prev => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });

      handleSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Restock Failed',
        description: error.message || 'Failed to restock item.',
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleQuickRestock = (item: StockItem) => {
    setSelectedItem(item);
    setRestockQuantities({ [item.id]: '' });
    setRestockCosts({ [item.id]: String(item.costPrice || '') });
    setIsRestockDialogOpen(true);
  };

  const handleDialogRestock = async () => {
    if (!selectedItem) return;
    await handleRestock(selectedItem);
    setIsRestockDialogOpen(false);
    setSelectedItem(null);
    setBulkRestockNotes('');
  };

  const isLoading = areStockItemsLoading || areCategoriesLoading || isHistoryLoading;

  const columns = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Item',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        const isLowStock = item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 0);
        const isOutOfStock = item.quantity <= 0;

        return (
          <div className="flex items-center gap-3">
            {settings?.useGlobalStockImage && settings.globalStockImageUrl ? (
              <Image
                src={settings.globalStockImageUrl}
                alt={item.name}
                width={40}
                height={40}
                className="rounded-md object-cover"
              />
            ) : item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.name}
                width={40}
                height={40}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.category || 'Uncategorized'}</p>
            </div>
            {isOutOfStock && (
              <Badge variant="destructive" className="ml-2">Out of Stock</Badge>
            )}
            {!isOutOfStock && isLowStock && (
              <Badge variant="warning" className="ml-2">Low Stock</Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Current Qty',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        const isLowStock = item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 0);
        const isOutOfStock = item.quantity <= 0;

        return (
          <span className={cn(
            'font-semibold',
            isOutOfStock && 'text-destructive',
            isLowStock && 'text-yellow-600'
          )}>
            {item.quantity}
          </span>
        );
      },
    },
    {
      accessorKey: 'lowStockThreshold',
      header: 'Threshold',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        return <span className="text-muted-foreground">{item.lowStockThreshold || 0}</span>;
      },
    },
    {
      accessorKey: 'costPrice',
      header: 'Cost/Unit',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        return formatCurrency(item.costPrice || 0);
      },
    },
    {
      id: 'restockQuantity',
      header: 'Restock Qty',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        return (
          <Input
            type="number"
            placeholder="Qty"
            value={restockQuantities[item.id] || ''}
            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
            className="w-24"
            disabled={!canManageItems}
          />
        );
      },
    },
    {
      id: 'restockCost',
      header: 'New Cost/Unit',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        return (
          <Input
            type="number"
            step="0.01"
            placeholder="Cost"
            value={restockCosts[item.id] || item.costPrice || ''}
            onChange={(e) => handleCostChange(item.id, e.target.value)}
            className="w-28"
            disabled={!canManageItems}
          />
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const item = row.original as StockItem;
        const isSaving = savingStates[item.id];
        const qty = Number(restockQuantities[item.id] || 0);

        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleRestock(item)}
              disabled={!canManageItems || isSaving || qty <= 0}
            >
              {isSaving ? (
                <span className="animate-spin">...</span>
              ) : (
                <>
                  <Save className="mr-1 h-3 w-3" />
                  Save
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickRestock(item)}
              disabled={!canManageItems}
            >
              <Plus className="mr-1 h-3 w-3" />
              Quick
            </Button>
          </div>
        );
      },
    },
  ], [restockQuantities, restockCosts, savingStates, canManageItems, settings, currency]);

  const historyColumns = React.useMemo(() => [
    {
      accessorKey: 'restockedAt',
      header: 'Date',
      cell: ({ row }: any) => {
        const entry = row.original as RestockEntry;
        const date = getSafeDate(entry.restockedAt);
        return date ? format(date, 'PPp') : 'N/A';
      },
    },
    {
      accessorKey: 'itemName',
      header: 'Item',
    },
    {
      accessorKey: 'quantityAdded',
      header: 'Qty Added',
      cell: ({ row }: any) => {
        const entry = row.original as RestockEntry;
        return <span className="font-semibold text-green-600">+{entry.quantityAdded}</span>;
      },
    },
    {
      accessorKey: 'costPerUnit',
      header: 'Cost/Unit',
      cell: ({ row }: any) => {
        const entry = row.original as RestockEntry;
        return formatCurrency(entry.costPerUnit);
      },
    },
    {
      accessorKey: 'totalCost',
      header: 'Total Cost',
      cell: ({ row }: any) => {
        const entry = row.original as RestockEntry;
        return <span className="font-semibold">{formatCurrency(entry.totalCost)}</span>;
      },
    },
    {
      accessorKey: 'restockedBy',
      header: 'Restocked By',
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }: any) => {
        const entry = row.original as RestockEntry;
        return entry.notes ? (
          <span className="text-muted-foreground text-sm truncate max-w-[150px] block">{entry.notes}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      },
    },
  ], [currency]);

  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <TopHeader
            icon={<Package className="h-10 w-10" />}
            name="Restock Inventory"
            description={isBranchMode ? `Branch: ${currentBranch?.name}` : "Quickly add stock to your inventory items."}
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/stock-alerts">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Stock Alerts
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/stock-keeper">
                <History className="mr-2 h-4 w-4" />
                Stock Keeper
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today's Items Restocked"
            value={stats.todaysItemsRestocked.toLocaleString()}
            icon={Package}
            description="Total units added to inventory today."
            isLoading={isLoading}
          />
          <StatCard
            title="Today's Restock Cost"
            value={stats.todaysRestockCost}
            icon={DollarSign}
            description="Total cost of items restocked today."
            isLoading={isLoading}
          />
          <StatCard
            title="Low Stock Items"
            value={stats.lowStockCount}
            icon={AlertTriangle}
            description="Items at or below threshold."
            isLoading={isLoading}
            className="border-yellow-500"
          />
          <StatCard
            title="Out of Stock Items"
            value={stats.outOfStockCount}
            icon={XCircle}
            description="Items with zero quantity."
            isLoading={isLoading}
            className="border-destructive"
          />
        </div>

        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
          <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Products"
              value={stats.totalProducts}
              icon={Package}
              description="Number of unique products."
              isLoading={isLoading}
            />
            <StatCard
              title="Total Stock Units"
              value={stats.totalStock.toLocaleString()}
              icon={TrendingUp}
              description="Total units across all products."
              isLoading={isLoading}
            />
            <StatCard
              title="Total Inventory Value"
              value={stats.totalInventoryValue}
              icon={DollarSign}
              description="Based on cost price."
              isLoading={isLoading}
            />
            <StatCard
              title="All-Time Restock Cost"
              value={stats.totalRestockCost}
              icon={DollarSign}
              description="Total cost of all restocks."
              isLoading={isLoading}
            />
          </CollapsibleContent>
          <div className="mt-4 flex items-center justify-center">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                {isStatsExpanded ? 'Show Less' : 'Show More Stats'}
                <ChevronDown
                  className={cn(
                    'ml-2 h-4 w-4 transition-transform',
                    isStatsExpanded && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </Collapsible>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="restock">Restock Items</TabsTrigger>
            <TabsTrigger value="history">Restock History</TabsTrigger>
          </TabsList>

          <TabsContent value="restock" className="mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full sm:w-80"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredItems.length > 0 ? (
              <DataTable
                columns={columns}
                data={filteredItems}
                tableId="restock-table"
                filterColumn="name"
                filterPlaceholder="Filter items..."
              />
            ) : (
              <EmptyState
                icon={Package}
                title="No Items Found"
                description="No stock items match your search criteria."
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {restockHistory && restockHistory.length > 0 ? (
              <DataTable
                columns={historyColumns}
                data={restockHistory}
                tableId="restock-history-table"
                filterColumn="itemName"
                filterPlaceholder="Filter by item name..."
              />
            ) : (
              <EmptyState
                icon={History}
                title="No Restock History"
                description="No items have been restocked yet."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Restock Dialog */}
      <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Restock</DialogTitle>
            <DialogDescription>
              Add stock to {selectedItem?.name || 'this item'}.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-12 h-12 bg-background rounded-md flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{selectedItem.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current Stock: <span className="font-medium">{selectedItem.quantity}</span>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="restock-qty">Quantity to Add</Label>
                  <Input
                    id="restock-qty"
                    type="number"
                    placeholder="Enter quantity"
                    value={restockQuantities[selectedItem.id] || ''}
                    onChange={(e) => handleQuantityChange(selectedItem.id, e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restock-cost">Cost per Unit</Label>
                  <Input
                    id="restock-cost"
                    type="number"
                    step="0.01"
                    placeholder="Enter cost"
                    value={restockCosts[selectedItem.id] || selectedItem.costPrice || ''}
                    onChange={(e) => handleCostChange(selectedItem.id, e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="restock-notes">Notes (Optional)</Label>
                <Textarea
                  id="restock-notes"
                  placeholder="Add notes about this restock..."
                  value={bulkRestockNotes}
                  onChange={(e) => setBulkRestockNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {(restockQuantities[selectedItem.id] && restockCosts[selectedItem.id]) && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Total Cost:</span>
                    <span className="font-semibold">
                      {formatCurrency(
                        Number(restockQuantities[selectedItem.id] || 0) *
                        Number(restockCosts[selectedItem.id] || 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDialogRestock}
              disabled={!selectedItem || savingStates[selectedItem?.id || '']}
            >
              {savingStates[selectedItem?.id || ''] ? 'Saving...' : 'Restock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(RestockInventoryPage, PagePermission.RESTOCK_INVENTORY);
