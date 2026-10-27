

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
  addDoc,
  deleteDoc,
  updateDoc,
  increment,
  getDocs,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { Package, Plus, DollarSign, Archive, PackagePlus, FileText, TrendingUp, Search, ChevronDown, CalendarCheck } from 'lucide-react';
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
import { StockKeeperList } from '@/components/stock-keeper/stock-keeper-list';
import { AddEditStockKeeperItemDialog } from '@/components/stock-keeper/add-edit-stock-keeper-item-dialog';
import { DeleteStockKeeperItemDialog } from '@/components/stock-keeper/delete-stock-keeper-item-dialog';
import { TransferToInventoryDialog } from '@/components/stock-keeper/transfer-to-inventory-dialog';
import { TransferToBranchDialog } from '@/components/stock-keeper/transfer-to-branch-dialog';
import { TransferReceiptDialog } from '@/components/stock-keeper/transfer-receipt-dialog';
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
import { isToday } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransferHistoryTable } from '@/components/stock-keeper/transfer-history-table';
import { ReverseTransferDialog } from '@/components/stock-keeper/reverse-transfer-dialog';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { useBranch } from '@/contexts/branch-context';

export interface TransferReceiptData {
  id: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    subtotal: number;
  }[];
  totalValue: number;
  transferredBy: string;
  transferredAt: Date;
  supplier?: string;
  invoiceNumber?: string;
}


function StockKeeperPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isTransferOpen, setIsTransferOpen] = React.useState(false);
  const [isTransferToBranchOpen, setIsTransferToBranchOpen] = React.useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false);
  const [isReverseOpen, setIsReverseOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [itemsToTransfer, setItemsToTransfer] = React.useState<StockItem[]>([]);
  const [transferReceiptData, setTransferReceiptData] = React.useState<TransferReceiptData | null>(null);
  const [logToReverse, setLogToReverse] = React.useState<any | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const { hasPermission } = usePermissions();
  const canManageItems = hasPermission(PagePermission.MANAGE_STOCK_ITEMS);


  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();

  const constraints = React.useMemo(() => {
    const c: any[] = [orderBy('name')];
    if (selectedCategory !== 'all') {
      c.push(where('category', '==', selectedCategory));
    }
    return c;
  }, [selectedCategory]);

  const transferLogsConstraints = React.useMemo(() => [orderBy('transferredAt', 'desc')], []);

  // Branch mode queries
  const branchStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockKeeperItems')), ...constraints) : null, [firestore, isGlobalMode, getCollectionPath, constraints]);
  const branchMainStockQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stock'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchCategoriesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockCategories'))) : null, [firestore, isGlobalMode, getCollectionPath]);
  const branchTransferLogsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('transferLog')), ...transferLogsConstraints) : null, [firestore, isGlobalMode, getCollectionPath, transferLogsConstraints]);

  const branchStockResult = useCollection<StockItem>(branchStockQuery);
  const branchMainStockResult = useCollection<StockItem>(branchMainStockQuery);
  const branchCategoriesResult = useCollection<StockCategory>(branchCategoriesQuery);
  const branchTransferLogsResult = useCollection(branchTransferLogsQuery);

  // Global mode queries
  const globalStockResult = useGlobalCollectionData<StockItem>('stockKeeperItems', constraints);
  const globalMainStockResult = useGlobalCollectionData<StockItem>('stock', []);
  const globalCategoriesResult = useGlobalCollectionData<StockCategory>('stockCategories', []);
  const globalTransferLogsResult = useGlobalCollectionData('transferLog', transferLogsConstraints);

  // Use appropriate result based on mode
  const { data: stockItems, isLoading: areStockItemsLoading } = isGlobalMode ? globalStockResult : branchStockResult;
  const { data: mainStockItems } = isGlobalMode ? globalMainStockResult : branchMainStockResult;
  const { data: categories, isLoading: areCategoriesLoading } = isGlobalMode ? globalCategoriesResult : branchCategoriesResult;
  const { data: transferLogs, isLoading: areLogsLoading } = isGlobalMode ? globalTransferLogsResult : branchTransferLogsResult;


  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const handleSuccess = () => setReloadCounter(c => c + 1);

  const stats = React.useMemo(() => {
    const safeStockItems = stockItems || [];
    const safeTransferLogs = transferLogs || [];
    const totalProducts = safeStockItems.length;
    const totalStock = safeStockItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalInventoryValue = safeStockItems.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);
    const potentialRevenue = safeStockItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const potentialProfit = potentialRevenue - totalInventoryValue;

    const totalTransferredItems = safeTransferLogs.reduce((sum, log) => sum + log.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0);
    const totalTransferredCost = safeTransferLogs.reduce((sum, log) => sum + log.totalValue, 0);
    const totalTransferredSellingValue = safeTransferLogs.reduce((sum, log) => sum + log.items.reduce((itemSum: number, item: any) => itemSum + (item.sellingPrice * item.quantity), 0), 0);

    const todaysLogs = safeTransferLogs.filter(log => getSafeDate(log.transferredAt) && isToday(getSafeDate(log.transferredAt)!));
    const todaysTransferredItems = todaysLogs.reduce((sum, log) => sum + log.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0);
    const todaysTransferredCost = todaysLogs.reduce((sum, log) => sum + log.totalValue, 0);
    const todaysTransferredSellingValue = todaysLogs.reduce((sum, log) => sum + log.items.reduce((itemSum: number, item: any) => itemSum + (item.sellingPrice * item.quantity), 0), 0);

    return {
      totalProducts,
      totalStock,
      totalInventoryValue: formatCurrency(totalInventoryValue),
      potentialRevenue: formatCurrency(potentialRevenue),
      potentialProfit: formatCurrency(potentialProfit),
      totalTransferredItems,
      totalTransferredCost: formatCurrency(totalTransferredCost),
      totalTransferredSellingValue: formatCurrency(totalTransferredSellingValue),
      todaysTransferredItems,
      todaysTransferredCost: formatCurrency(todaysTransferredCost),
      todaysTransferredSellingValue: formatCurrency(todaysTransferredSellingValue),
    };
  }, [stockItems, transferLogs, mainStockItems, currency]);

  const isLoading = areStockItemsLoading || areCategoriesLoading || areLogsLoading;

  const handleEdit = (item: StockItem) => { setSelectedItem(item); setIsFormOpen(true); };
  const handleDelete = (item: StockItem) => { setSelectedItem(item); setIsDeleteOpen(true); };
  const handleTransfer = (items: StockItem[]) => { setItemsToTransfer(items); setIsTransferOpen(true); };
  const handleTransferToBranch = (items: StockItem[]) => { setItemsToTransfer(items); setIsTransferToBranchOpen(true); };

  const handleTransferSuccess = (receiptData: TransferReceiptData) => {
    setTransferReceiptData(receiptData);
    setIsReceiptOpen(true);
    handleSuccess();
  };

  const handleBranchTransferSuccess = () => {
    handleSuccess();
  };

  const handleCloseDialogs = () => {
    setSelectedItem(null);
    setIsFormOpen(false);
    setIsDeleteOpen(false);
    setIsTransferOpen(false);
    setIsTransferToBranchOpen(false);
  };

  const handlePrintReceipt = (log: any) => {
    const receipt: TransferReceiptData = {
        id: log.id,
        items: log.items,
        totalValue: log.totalValue,
        transferredBy: log.transferredBy,
        transferredAt: getSafeDate(log.transferredAt)!,
        supplier: log.supplier,
        invoiceNumber: log.invoiceNumber,
    }
    setTransferReceiptData(receipt);
    setIsReceiptOpen(true);
  };

  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <TopHeader
            name="Stock Keeper"
            icon={<Archive />}
            description={isBranchMode ? `Branch: ${currentBranch?.name}` : undefined}
          />
          {canManageItems && (
            <div className="flex items-center gap-2">
                <Button asChild>
                <Link href="/stock-keeper/bulk-add">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Bulk Add Items
                </Link>
                </Button>
                <Button onClick={() => { setSelectedItem(null); setIsFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add New Item
                </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
                title="Today's Items Transferred"
                value={stats.todaysTransferredItems.toLocaleString()}
                icon={CalendarCheck}
                description="Total units moved to main inventory today."
                isLoading={isLoading}
            />
            <StatCard
                title="Today's Cost of Transfers"
                value={stats.todaysTransferredCost}
                icon={DollarSign}
                description="Total cost of items transferred today."
                isLoading={isLoading}
            />
            <StatCard
                title="Today's Selling Value of Transfers"
                value={stats.todaysTransferredSellingValue}
                icon={TrendingUp}
                description="Total potential revenue of items transferred today."
                isLoading={isLoading}
            />
        </div>


        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon={TrendingUp} title="Potential Revenue" value={stats.potentialRevenue} description="Expected income from staged items." isLoading={isLoading} />
                <StatCard icon={DollarSign} title="Potential Profit" value={stats.potentialProfit} description="Expected profit from staged items." isLoading={isLoading} />
                <StatCard icon={Package} title="Total Staged Items" value={stats.totalStock} description="Total units of all items in staging." isLoading={isLoading} />
            </div>
            <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
                 <StatCard icon={PackagePlus} title="Total Items Transferred" value={stats.totalTransferredItems.toLocaleString()} description="All-time units moved to main inventory." isLoading={isLoading} />
                 <StatCard icon={DollarSign} title="Total Cost of Transfers" value={stats.totalTransferredCost} description="Total cost of all items transferred." isLoading={isLoading} />
                 <StatCard icon={TrendingUp} title="Total Selling Value of Transfers" value={stats.totalTransferredSellingValue} description="Total potential revenue of transferred items." isLoading={isLoading} />
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

        <Tabs defaultValue="staging" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <TabsList>
                    <TabsTrigger value="staging">Staging Area</TabsTrigger>
                    <TabsTrigger value="history">Transfer History</TabsTrigger>
                </TabsList>
                <Button asChild>
                  <Link href="/stock-keeper/report"><FileText className="mr-2 h-4 w-4" />See Full Report</Link>
                </Button>
            </div>
            <TabsContent value="staging" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search items by name or barcode..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-64"
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
                <StockKeeperList
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onTransfer={handleTransfer}
                    onTransferToBranch={handleTransferToBranch}
                    stockItems={stockItems || []}
                    isLoading={areStockItemsLoading}
                    searchTerm={searchTerm}
                />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
                <TransferHistoryTable onPrintReceipt={handlePrintReceipt} onReverse={setLogToReverse} />
            </TabsContent>
        </Tabs>
      </div>
      <AddEditStockKeeperItemDialog
        isOpen={isFormOpen}
        onClose={handleCloseDialogs}
        item={selectedItem}
        onSuccess={handleSuccess}
      />
      {selectedItem && (
        <DeleteStockKeeperItemDialog
            isOpen={isDeleteOpen}
            onClose={handleCloseDialogs}
            item={selectedItem}
            onSuccess={handleSuccess}
        />
      )}
      <TransferToInventoryDialog
        isOpen={isTransferOpen}
        onClose={handleCloseDialogs}
        itemsToTransfer={itemsToTransfer}
        onSuccess={handleTransferSuccess}
      />
      <TransferToBranchDialog
        isOpen={isTransferToBranchOpen}
        onClose={handleCloseDialogs}
        itemsToTransfer={itemsToTransfer}
        onSuccess={handleBranchTransferSuccess}
      />
       <TransferReceiptDialog
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptData={transferReceiptData}
      />
       <ReverseTransferDialog
        isOpen={!!logToReverse}
        onClose={() => setLogToReverse(null)}
        log={logToReverse}
        onSuccess={handleSuccess}
      />
    </>
  );
}

export default withAuth(StockKeeperPage, PagePermission.VIEW_STOCK_MANAGEMENT);
