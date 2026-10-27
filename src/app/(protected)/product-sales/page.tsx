'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import type { StockItem, StockSale, UserProfile } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign, Package, TrendingUp, Eye } from 'lucide-react';
import ProductSalesLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, isToday, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { getProductSalesColumns } from './product-sales-columns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { IndividualSalesLogDialog } from '@/components/stock/individual-sales-log-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// This is the shape of the data for each row in our main table
export interface ProductPerformanceData {
  id: string;
  name: string;
  category: string;
  images?: string[];
  currentStock: number;
  lowStockThreshold?: number;
  unitsSold: number;
  grossRevenue: number;
  netProfit: number;
  profitMargin: number;
  sales: (Partial<StockSale> & { quantity: number; sellingPrice: number })[]; // Array of sales for this item
}


function ProductSalesPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const { getCollectionPath, isBranchMode, currentBranch } = useBranch();

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [showTodayOnly, setShowTodayOnly] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductPerformanceData | null>(null);
  const [actionsProduct, setActionsProduct] = React.useState<ProductPerformanceData | null>(null);

  const stockQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('stock')));
  }, [firestore, getCollectionPath]);

  const salesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, getCollectionPath('stockSales')));
  }, [firestore, getCollectionPath]);

  const usersQuery = useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);

  const { data: stockItems, isLoading: areStockItemsLoading } = useCollection<StockItem>(stockQuery);
  const { data: sales, isLoading: areSalesLoading } = useCollection<StockSale>(salesQuery);
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    if (!users) return new Map();
    return new Map(users.map(u => [u.uid, u]));
  }, [users]);

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const { productPerformance, summaryStats } = React.useMemo(() => {
    const safeStockItems = stockItems || [];
    let salesToProcess = sales || [];

    if (showTodayOnly) {
        salesToProcess = salesToProcess.filter(sale => {
            const soldAt = getSafeDate(sale.soldAt);
            return soldAt && isToday(soldAt);
        });
    } else if (dateRange?.from) {
        salesToProcess = salesToProcess.filter(sale => {
          const soldAt = getSafeDate(sale.soldAt);
          return soldAt && isWithinInterval(soldAt, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to || dateRange.from!) });
        });
    }

    const performanceData: ProductPerformanceData[] = safeStockItems.map(item => {
      const salesForItem = salesToProcess.flatMap(sale =>
        sale.items
          .filter(saleItem => saleItem.itemId === item.id)
          .map(saleItem => ({
              // Denormalize some sale data onto the item for easy access
              ...sale,
              quantity: saleItem.quantity,
              sellingPrice: saleItem.sellingPrice,
              total: saleItem.sellingPrice * saleItem.quantity,
          }))
      );

      const unitsSold = salesForItem.reduce((sum, s) => sum + s.quantity, 0);
      const grossRevenue = salesForItem.reduce((sum, s) => sum + (s.sellingPrice * s.quantity), 0);
      const totalCost = unitsSold * (item.costPrice || 0);
      const netProfit = grossRevenue - totalCost;
      const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        images: item.images,
        currentStock: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
        unitsSold,
        grossRevenue,
        netProfit,
        profitMargin,
        sales: salesForItem,
      };
    }).sort((a,b) => b.grossRevenue - a.grossRevenue);

    const totalRevenue = performanceData.reduce((sum, p) => sum + p.grossRevenue, 0);
    const totalProfit = performanceData.reduce((sum, p) => sum + p.netProfit, 0);
    const totalUnits = performanceData.reduce((sum, p) => sum + p.unitsSold, 0);
    const bestSeller = performanceData[0];

    return {
      productPerformance: performanceData,
      summaryStats: {
        totalRevenue,
        totalProfit,
        totalUnits,
        bestSeller,
      },
    };

  }, [stockItems, sales, dateRange, showTodayOnly]);

  const columns = React.useMemo(() => getProductSalesColumns({
      currency,
      onActions: setActionsProduct,
      globalStockImageUrl: settings?.globalStockImageUrl,
      useGlobalStockImage: settings?.useGlobalStockImage
  }), [currency, settings]);


  const isLoading = areStockItemsLoading || areSalesLoading || areUsersLoading;

  if (isLoading) {
    return <ProductSalesLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <TrendingUp className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Product Sales Report</h1>
              <p className="text-muted-foreground">
                {isBranchMode ? `Branch: ${currentBranch?.name}` : "An overview of your product sales performance."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                  <Switch
                      id="today-only-filter"
                      checked={showTodayOnly}
                      onCheckedChange={setShowTodayOnly}
                  />
                  <Label htmlFor="today-only-filter">Today's Sales</Label>
              </div>
              <DateRangePicker date={dateRange} onDateChange={setDateRange} disabled={showTodayOnly} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(summaryStats.totalRevenue)}
            icon={DollarSign}
            description="Total income from all product sales in this period."
            className="border-green-500 text-green-500"
          />
          <StatCard
            title="Net Profit"
            value={formatCurrency(summaryStats.totalProfit)}
            icon={TrendingUp}
            description="Revenue minus cost of goods sold for the period."
            className={summaryStats.totalProfit >= 0 ? "border-green-500 text-green-500" : "border-destructive text-destructive"}
          />
          <StatCard
            title="Total Units Sold"
            value={summaryStats.totalUnits.toLocaleString()}
            icon={Package}
            description="Total number of individual products sold."
          />
          {summaryStats.bestSeller && (
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Best Seller</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                      <div className="text-lg font-bold">{summaryStats.bestSeller.name}</div>
                      <p className="text-xs text-muted-foreground">
                          {summaryStats.bestSeller.unitsSold} units sold for {formatCurrency(summaryStats.bestSeller.grossRevenue)}
                      </p>
                  </CardContent>
              </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Performance Breakdown</CardTitle>
            <CardDescription>
              A detailed list of all products and their sales metrics for the selected period. Click the actions menu to see individual sales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={productPerformance}
              filterColumn="name"
              filterPlaceholder="Filter by product name..."
              tableId="product-sales"
            />
          </CardContent>
        </Card>
      </div>
      <IndividualSalesLogDialog
        open={!!selectedProduct}
        onOpenChange={() => setSelectedProduct(null)}
        product={selectedProduct}
        currency={currency}
      />
      <Dialog open={!!actionsProduct} onOpenChange={() => setActionsProduct(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Actions for {actionsProduct?.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                        setSelectedProduct(actionsProduct);
                        setActionsProduct(null);
                    }}
                >
                    <Eye className="mr-2 h-4 w-4" />
                    View Sales Log
                </Button>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setActionsProduct(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(ProductSalesPage, PagePermission.VIEW_SALES_REPORTS);
