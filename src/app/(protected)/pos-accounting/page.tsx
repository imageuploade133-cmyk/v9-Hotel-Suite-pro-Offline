'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { HeldSale, StockSale, StockReturn, UserProfile, Payment, UnifiedItem } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import { StatCard } from '@/components/ui/stat-card';
import { TopHeader } from '@/components/top-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import {
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp,
  List,
  Printer,
  Calculator,
  User,
  Calendar,
  Clock,
  MoreHorizontal,
  Eye,
  Undo2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  Wallet,
  Filter,
  X,
  UtensilsCrossed
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface StaffPOSPerformance {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  totalSales: number;
  totalTransactions: number;
  totalRefunds: number;
  netIncome: number;
  periodSales: number;
  periodTransactions: number;
  periodRefunds: number;
  periodNetIncome: number;
  recentSales: StockSale[];
}

interface RunningTableData {
  id: string;
  name: string;
  customerName: string;
  heldByName: string;
  heldAt: Date;
  totalAmount: number;
  totalItems: number;
  status: 'active' | 'billed';
}

function PosAccountingLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RunningTableCard({
  table,
  currency,
  onView
}: {
  table: RunningTableData;
  currency: string;
  onView: () => void;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const heldTime = React.useMemo(() => {
    const now = new Date();
    const diff = now.getTime() - table.heldAt.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }, [table.heldAt]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{table.name}</h3>
              <Badge variant={table.status === 'billed' ? 'secondary' : 'default'}>
                {table.status === 'billed' ? 'Billed to Room' : 'Active'}
              </Badge>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{table.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(table.heldAt, 'PPpp')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Started by: {table.heldByName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">Duration: {heldTime}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(table.totalAmount)}</p>
            <p className="text-sm text-muted-foreground">{table.totalItems} items</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onView}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffPerformanceCard({
  staff,
  currency,
  isExpanded,
  onToggle
}: {
  staff: StaffPOSPerformance;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary">
              {staff.photoURL ? (
                <AvatarImage src={staff.photoURL} alt={staff.name} />
              ) : (
                <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <CardTitle className="text-lg">{staff.name}</CardTitle>
              {staff.email && (
                <p className="text-sm text-muted-foreground">{staff.email}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onToggle}>
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">PERIOD SALES</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(staff.periodSales)}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">PERIOD TRANSACTIONS</p>
            <p className="text-xl font-bold">{staff.periodTransactions}</p>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Total Sales (All Time)</p>
                <p className="text-lg font-bold">{formatCurrency(staff.totalSales)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Total Transactions</p>
                <p className="text-lg font-bold">{staff.totalTransactions}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Total Refunds</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(staff.totalRefunds)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Net Income</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(staff.netIncome)}</p>
              </div>
            </div>

            {/* Recent Sales */}
            {staff.recentSales.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Sales</p>
                <div className="space-y-2">
                  {staff.recentSales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex justify-between text-sm border rounded p-2">
                      <div>
                        <span className="font-medium">{sale.saleId}</span>
                        <span className="text-muted-foreground ml-2">
                          {sale.customerName || 'Walk-in'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(sale.totalAmount)}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {sale.paymentMethod}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PosAccountingPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch, branches, selectBranch } = useBranch();

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('all');
  const [expandedStaff, setExpandedStaff] = React.useState<Set<string>>(new Set());
  const [viewingTable, setViewingTable] = React.useState<HeldSale | null>(null);
  const [viewingSale, setViewingSale] = React.useState<StockSale | null>(null);

  // Fetch users
  const usersQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'users'), orderBy('name')) : null,
    [firestore]
  );
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  // Fetch running tables based on branch mode
  const heldSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, getCollectionPath('heldSales')),
      orderBy('heldAt', 'desc')
    );
  }, [firestore, getCollectionPath]);

  const { data: heldSales, isLoading: areHeldSalesLoading } = useCollection<HeldSale>(heldSalesQuery);

  // Fetch stock sales based on branch mode
  const stockSalesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, getCollectionPath('stockSales')),
      orderBy('soldAt', 'desc')
    );
  }, [firestore, getCollectionPath]);

  const { data: stockSales, isLoading: areStockSalesLoading } = useCollection<StockSale>(stockSalesQuery);

  // Fetch stock returns
  const returnsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, getCollectionPath('stockReturns')),
      orderBy('returnedAt', 'desc')
    );
  }, [firestore, getCollectionPath]);

  const { data: returns, isLoading: areReturnsLoading } = useCollection<StockReturn>(returnsQuery);

  // Filter data by selected branch and date range
  const filteredRunningTables = React.useMemo(() => {
    if (!heldSales) return [];
    return heldSales;
  }, [heldSales]);

  const filteredSales = React.useMemo(() => {
    if (!stockSales) return [];

    let sales = stockSales;

    // Filter by date range if set
    if (dateRange?.from) {
      sales = sales.filter(sale => {
        const soldAt = getSafeDate(sale.soldAt);
        if (!soldAt) return false;
        return isWithinInterval(soldAt, {
          start: startOfDay(dateRange.from!),
          end: endOfDay(dateRange.to || dateRange.from!)
        });
      });
    }

    return sales;
  }, [stockSales, dateRange]);

  // Calculate running tables statistics
  const runningTablesStats = React.useMemo(() => {
    if (!filteredRunningTables) return {
      totalTables: 0,
      activeTables: 0,
      billedTables: 0,
      totalValue: 0,
      totalItems: 0
    };

    const activeTables = filteredRunningTables.filter(t => !t.linkedBillId);
    const billedTables = filteredRunningTables.filter(t => t.linkedBillId);

    const totalValue = filteredRunningTables.reduce((sum, sale) =>
      sum + sale.cart.reduce((itemSum, item) =>
        itemSum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
      ), 0
    );

    const totalItems = filteredRunningTables.reduce((sum, sale) =>
      sum + sale.cart.reduce((itemSum, item) => itemSum + Number(item.sellQuantity || 0), 0),
      0
    );

    return {
      totalTables: filteredRunningTables.length,
      activeTables: activeTables.length,
      billedTables: billedTables.length,
      totalValue,
      totalItems
    };
  }, [filteredRunningTables]);

  // Calculate POS income statistics
  const incomeStats = React.useMemo(() => {
    if (!filteredSales) return {
      totalSales: 0,
      totalTransactions: 0,
      totalRefunds: 0,
      netIncome: 0,
      cashSales: 0,
      cardSales: 0,
      creditSales: 0
    };

    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = filteredSales.length;

    const refunds = returns || [];
    const totalRefunds = refunds.reduce((sum, r) => sum + r.totalRefundAmount, 0);

    const cashSales = filteredSales
      .filter(s => s.paymentMethod === 'Cash')
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const cardSales = filteredSales
      .filter(s => s.paymentMethod === 'Card')
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const creditSales = filteredSales
      .filter(s => s.paymentMethod === 'Credit')
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      totalSales,
      totalTransactions,
      totalRefunds,
      netIncome: totalSales - totalRefunds,
      cashSales,
      cardSales,
      creditSales
    };
  }, [filteredSales, returns]);

  // Calculate staff performance
  const staffPerformance = React.useMemo(() => {
    if (!users || !stockSales || !returns) return [];

    const staffMap = new Map<string, StaffPOSPerformance>();

    // Initialize staff map
    users.forEach(user => {
      staffMap.set(user.uid, {
        id: user.uid,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        totalSales: 0,
        totalTransactions: 0,
        totalRefunds: 0,
        netIncome: 0,
        periodSales: 0,
        periodTransactions: 0,
        periodRefunds: 0,
        periodNetIncome: 0,
        recentSales: []
      });
    });

    // Calculate total stats (all time)
    stockSales.forEach(sale => {
      const staff = staffMap.get(sale.soldByUid);
      if (staff) {
        staff.totalSales += sale.totalAmount;
        staff.totalTransactions += 1;
        staff.recentSales.push(sale);
      }
    });

    returns.forEach(ret => {
      const staff = staffMap.get(ret.returnedByUid);
      if (staff) {
        staff.totalRefunds += ret.totalRefundAmount;
      }
    });

    // Calculate net income
    staffMap.forEach(staff => {
      staff.netIncome = staff.totalSales - staff.totalRefunds;
    });

    // Calculate period stats
    if (dateRange?.from) {
      const periodSales = stockSales.filter(sale => {
        const soldAt = getSafeDate(sale.soldAt);
        if (!soldAt) return false;
        return isWithinInterval(soldAt, {
          start: startOfDay(dateRange.from!),
          end: endOfDay(dateRange.to || dateRange.from!)
        });
      });

      const periodReturns = returns.filter(ret => {
        const returnedAt = getSafeDate(ret.returnedAt);
        if (!returnedAt) return false;
        return isWithinInterval(returnedAt, {
          start: startOfDay(dateRange.from!),
          end: endOfDay(dateRange.to || dateRange.from!)
        });
      });

      staffMap.forEach(staff => {
        const staffPeriodSales = periodSales.filter(s => s.soldByUid === staff.id);
        staff.periodSales = staffPeriodSales.reduce((sum, s) => sum + s.totalAmount, 0);
        staff.periodTransactions = staffPeriodSales.length;

        const staffPeriodReturns = periodReturns.filter(r => r.returnedByUid === staff.id);
        staff.periodRefunds = staffPeriodReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
        staff.periodNetIncome = staff.periodSales - staff.periodRefunds;
      });
    } else {
      // If no date range, period = all time
      staffMap.forEach(staff => {
        staff.periodSales = staff.totalSales;
        staff.periodTransactions = staff.totalTransactions;
        staff.periodRefunds = staff.totalRefunds;
        staff.periodNetIncome = staff.netIncome;
      });
    }

    return Array.from(staffMap.values())
      .filter(s => s.totalTransactions > 0)
      .sort((a, b) => b.periodSales - a.periodSales);
  }, [users, stockSales, returns, dateRange]);

  const isLoading = areUsersLoading || areHeldSalesLoading || areStockSalesLoading || areReturnsLoading;

  const toggleStaffExpand = (staffId: string) => {
    setExpandedStaff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return <PosAccountingLoading />;
  }

  const branchHeader = isBranchMode && currentBranch
    ? `Branch: ${currentBranch.name}`
    : isGlobalMode
      ? 'All Branches'
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <TopHeader
          name="POS Accounting"
          icon={<Calculator />}
          description={branchHeader}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch Filter */}
          {isGlobalMode && branches.length > 0 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Running Tables"
          value={runningTablesStats.totalTables}
          icon={List}
          description={`${runningTablesStats.activeTables} active, ${runningTablesStats.billedTables} billed - ${runningTablesStats.totalItems} items`}
        />
        <StatCard
          title="Total POS Income"
          value={formatCurrency(incomeStats.totalSales)}
          icon={DollarSign}
          description={`${incomeStats.totalTransactions} transactions`}
          className="border-green-500"
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(incomeStats.netIncome)}
          icon={TrendingUp}
          description={`After ${formatCurrency(incomeStats.totalRefunds)} refunds`}
          className="border-primary"
        />
        <StatCard
          title="Active Staff"
          value={staffPerformance.length}
          icon={Users}
          description="Staff with POS activity"
        />
      </div>

      {/* Income Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Cash Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(incomeStats.cashSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Card Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(incomeStats.cardSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Credit Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(incomeStats.creditSales)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="tables" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Running Tables
            {runningTablesStats.totalTables > 0 && (
              <Badge variant="secondary" className="ml-1">{runningTablesStats.totalTables}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="income" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Income Details
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Staff Performance
            {staffPerformance.length > 0 && (
              <Badge variant="secondary" className="ml-1">{staffPerformance.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Running Tables Tab */}
        <TabsContent value="tables" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Active Running Tables
                  </CardTitle>
                  <CardDescription>
                    Current POS tables with items. Total value: {formatCurrency(runningTablesStats.totalValue)}
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/running-tables">
                    <Eye className="h-4 w-4 mr-2" />
                    View All Tables
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!filteredRunningTables || filteredRunningTables.length === 0 ? (
                <EmptyState
                  icon={List}
                  title="No Running Tables"
                  description="There are no active running tables at the moment."
                  className="py-12"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRunningTables.slice(0, 9).map((sale) => {
                    const totalAmount = sale.cart.reduce((sum, item) =>
                      sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
                    );
                    const totalItems = sale.cart.reduce((sum, item) => sum + Number(item.sellQuantity || 0), 0);

                    return (
                      <RunningTableCard
                        key={sale.id}
                        table={{
                          id: sale.id,
                          name: sale.name,
                          customerName: sale.customer?.name || 'Walk-in Customer',
                          heldByName: sale.heldByName,
                          heldAt: getSafeDate(sale.heldAt) || new Date(),
                          totalAmount,
                          totalItems,
                          status: sale.linkedBillId ? 'billed' : 'active'
                        }}
                        currency={currency}
                        onView={() => setViewingTable(sale)}
                      />
                    );
                  })}
                </div>
              )}
              {filteredRunningTables.length > 9 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" asChild>
                    <Link href="/running-tables">
                      View All {filteredRunningTables.length} Tables
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Income Details Tab */}
        <TabsContent value="income" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    POS Income Details
                  </CardTitle>
                  <CardDescription>
                    {dateRange?.from
                      ? `Income from ${format(dateRange.from, 'PP')} to ${format(dateRange.to || dateRange.from, 'PP')}`
                      : 'Income for all time'
                    }
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/sales-history">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Full Sales History
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="No Sales Data"
                  description="No POS sales found for the selected period."
                  className="py-12"
                />
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredSales.slice(0, 50).map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{sale.saleId}</span>
                            <Badge variant="outline">{sale.paymentMethod}</Badge>
                            {(sale as any).status === 'Refunded' && (
                              <Badge variant="destructive">Refunded</Badge>
                            )}
                            {(sale as any).status === 'Partially Refunded' && (
                              <Badge variant="warning">Partial Refund</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>{sale.customerName || 'Walk-in Customer'}</span>
                            <span className="mx-2">•</span>
                            <span>{getSafeDate(sale.soldAt) ? format(getSafeDate(sale.soldAt)!, 'PPpp') : 'N/A'}</span>
                            <span className="mx-2">•</span>
                            <span>By: {sale.soldByName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingSale(sale)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Items ({sale.items?.length || 0})
                            </Button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(sale.totalAmount)}</p>
                          {(sale as any).amountPaid !== undefined && sale.paymentMethod === 'Credit' && (
                            <p className="text-xs text-muted-foreground">
                              Paid: {formatCurrency((sale as any).amountPaid || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {filteredSales.length > 50 && (
                <div className="mt-4 text-center text-muted-foreground">
                  Showing 50 of {filteredSales.length} transactions.
                  <Button variant="link" asChild className="ml-2">
                    <Link href="/sales-history">View Full History</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Performance Tab */}
        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Staff POS Performance
                  </CardTitle>
                  <CardDescription>
                    View staff performance by branch. Click to expand details.
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/staff-analytics">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Full Analytics
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {staffPerformance.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Staff Data"
                  description="No staff POS performance data available."
                  className="py-12"
                />
              ) : (
                <div className="space-y-4">
                  {staffPerformance.map(staff => (
                    <StaffPerformanceCard
                      key={staff.id}
                      staff={staff}
                      currency={currency}
                      isExpanded={expandedStaff.has(staff.id)}
                      onToggle={() => toggleStaffExpand(staff.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Table Items Dialog */}
      <Dialog open={!!viewingTable} onOpenChange={() => setViewingTable(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              {viewingTable?.name || 'Table Details'}
            </DialogTitle>
            <DialogDescription>
              {viewingTable && (
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{viewingTable.customer?.name || 'Walk-in Customer'}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{getSafeDate(viewingTable.heldAt) ? format(getSafeDate(viewingTable.heldAt)!, 'PPpp') : 'N/A'}</span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewingTable && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Held by: <span className="font-medium text-foreground">{viewingTable.heldByName}</span>
                </div>
                <Badge variant={viewingTable.linkedBillId ? 'secondary' : 'default'}>
                  {viewingTable.linkedBillId ? 'Billed to Room' : 'Active'}
                </Badge>
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {viewingTable.cart && viewingTable.cart.length > 0 ? (
                    viewingTable.cart.map((item, index) => {
                      const itemPrice = item.price || item.sellingPrice || 0;
                      const itemQuantity = Number(item.sellQuantity || 0);
                      const itemTotal = itemPrice * itemQuantity;
                      const itemAny = item as any;

                      return (
                        <div key={item.id || index} className="flex items-start justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(itemPrice)} × {itemQuantity}
                            </div>
                            {itemAny.variants && itemAny.variants.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {itemAny.variants.map((v: any) => v.name).join(', ')}
                              </div>
                            )}
                            {itemAny.addons && itemAny.addons.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Addons: {itemAny.addons.map((a: any) => a.name).join(', ')}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(itemTotal)}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No items in this table
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Items</span>
                  <span className="font-medium">
                    {viewingTable.cart?.reduce((sum, item) => sum + Number(item.sellQuantity || 0), 0) || 0}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span className="text-primary">
                    {formatCurrency(
                      viewingTable.cart?.reduce((sum, item) =>
                        sum + ((item.price || item.sellingPrice || 0) * Number(item.sellQuantity || 0)), 0
                      ) || 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewingTable(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Items Dialog */}
      <Dialog open={!!viewingSale} onOpenChange={() => setViewingSale(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Sale Details - {viewingSale?.saleId}
            </DialogTitle>
            <DialogDescription>
              {viewingSale && (
                <div className="flex flex-col gap-2 mt-2 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{viewingSale.customerName || 'Walk-in Customer'}</span>
                    </div>
                    <span>•</span>
                    <Badge variant="outline">{viewingSale.paymentMethod}</Badge>
                    {(viewingSale as any).status === 'Refunded' && (
                      <Badge variant="destructive">Refunded</Badge>
                    )}
                    {(viewingSale as any).status === 'Partially Refunded' && (
                      <Badge variant="warning">Partial Refund</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{getSafeDate(viewingSale.soldAt) ? format(getSafeDate(viewingSale.soldAt)!, 'PPpp') : 'N/A'}</span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewingSale && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Sold by: <span className="font-medium text-foreground">{viewingSale.soldByName}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {viewingSale.items?.length || 0} item(s)
                </div>
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {viewingSale.items && viewingSale.items.length > 0 ? (
                    viewingSale.items.map((item, index) => {
                      const saleItem = item as any;
                      const itemPrice = saleItem.price || saleItem.sellingPrice || 0;
                      const itemQuantity = Number(saleItem.quantity || 1);
                      const itemTotal = itemPrice * itemQuantity;

                      return (
                        <div key={saleItem.id || saleItem.itemId || index} className="flex items-start justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{saleItem.name || saleItem.itemName}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(itemPrice)} × {itemQuantity}
                            </div>
                            {saleItem.category && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Category: {saleItem.category}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(itemTotal)}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No items in this sale
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Items</span>
                  <span className="font-medium">
                    {viewingSale.items?.reduce((sum, item) => sum + Number((item as any).quantity || 1), 0) || 0}
                  </span>
                </div>
                {(viewingSale as any).discountAmount && (viewingSale as any).discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Discount</span>
                    <span>-{formatCurrency((viewingSale as any).discountAmount)}</span>
                  </div>
                )}
                {(viewingSale as any).taxAmount && (viewingSale as any).taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span>{formatCurrency((viewingSale as any).taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span className="text-primary">
                    {formatCurrency(viewingSale.totalAmount)}
                  </span>
                </div>
                {viewingSale.paymentMethod === 'Credit' && (viewingSale as any).amountPaid !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span>Amount Paid</span>
                    <span>{formatCurrency((viewingSale as any).amountPaid || 0)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewingSale(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default withAuth(PosAccountingPage, PagePermission.VIEW_POS_ACCOUNTING);
