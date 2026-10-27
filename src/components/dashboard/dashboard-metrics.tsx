'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  CalendarDays,
  Wallet,
  DollarSign,
  Landmark,
  TrendingUp,
  TrendingDown,
  Package,
  CreditCard,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { CollapsibleContent } from '@/components/ui/collapsible';

export function DashboardMetrics({
  data,
  incomeFilter,
  setIncomeFilter,
  monthlyIncomeFilter,
  setMonthlyIncomeFilter,
  yearlyIncomeFilter,
  setYearlyIncomeFilter,
  dateRange,
  canViewTodaysIncome = true,
}: any) {
  const {
    metrics,
    stockMetrics,
    totalStockProfit,
    filteredIncome,
    filteredIncomeLabel,
    grandTotalIncome,
    filteredMonthlyIncome,
    filteredMonthlyIncomeLabel,
    allMonths,
    filteredYearlyIncome,
    filteredYearlyIncomeLabel,
    allYears,
    netProfit,
    totalExpenses,
    totalInventoryValue,
    totalOutstanding,
    userCurrency
  } = data;

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
    }).format(value);
  };

  const primaryMetrics = metrics?.slice(0, 4) || [];
  const secondaryMetrics = metrics?.slice(4) || [];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canViewTodaysIncome && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto p-0 text-sm font-medium -ml-2" disabled={!!dateRange}>
                    {filteredIncomeLabel}
                    <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => setIncomeFilter('today')}>Today</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIncomeFilter('yesterday')}>Yesterday</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIncomeFilter('lastWeek')}>Last 7 Days</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(filteredIncome)}</div>
              <p className="text-xs text-muted-foreground">
                Total revenue from the selected period.
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-0 text-sm font-medium -ml-2">
                  {filteredMonthlyIncomeLabel}
                  <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setMonthlyIncomeFilter('this-month')}>This Month</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMonthlyIncomeFilter('last-month')}>Last Month</DropdownMenuItem>
                {(allMonths || []).length > 0 && <DropdownMenuSeparator />}
                {(allMonths || []).map((monthStr: string) => (
                    <DropdownMenuItem key={monthStr} onSelect={() => setMonthlyIncomeFilter(monthStr)}>
                        {format(new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]) - 1), 'MMMM yyyy')}
                    </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filteredMonthlyIncome)}</div>
            <p className="text-xs text-muted-foreground">
              Total revenue for the selected month.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-0 text-sm font-medium -ml-2">
                {filteredYearlyIncomeLabel}
                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setYearlyIncomeFilter('this-year')}>This Year</DropdownMenuItem>
                {(allYears || []).filter((y: string) => y !== String(new Date().getFullYear())).map((yearStr: string) => (
                    <DropdownMenuItem key={yearStr} onSelect={() => setYearlyIncomeFilter(yearStr)}>
                        {yearStr}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
            </DropdownMenu>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filteredYearlyIncome)}</div>
            <p className="text-xs text-muted-foreground">
            Total revenue for the selected year.
            </p>
          </CardContent>
        </Card>
        <StatCard
          title="Grand Total Income"
          value={formatCurrency(grandTotalIncome)}
          icon={Landmark}
          description="All-time revenue from all sources."
          className="bg-primary/10 text-primary"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        {primaryMetrics.map((metric: any) => (
          <StatCard key={metric.title} {...metric} />
        ))}
      </div>

      <CollapsibleContent className="grid animate-in fade-in-0 zoom-in-95 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
            title="Total Stock Profit"
            value={formatCurrency(totalStockProfit)}
            icon={TrendingUp}
            description="All-time profit from stock sales."
            className={totalStockProfit >= 0 ? "text-primary border-primary" : "text-destructive border-destructive"}
        />
        <StatCard
            title="Total Expenses"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            description="All-time total expenses."
            className="border-destructive text-destructive"
          />
          <StatCard
            title="Net Profit (All Time)"
            value={formatCurrency(netProfit)}
            icon={DollarSign}
            description="All income minus all expenses & COGS."
            className={netProfit >= 0 ? "text-primary border-primary" : "text-destructive border-destructive"}
        />
          <StatCard
            title="Total Outstanding"
            value={formatCurrency(totalOutstanding)}
            icon={CreditCard}
            description="All-time outstanding balance from credit sales."
            className={totalOutstanding > 0 ? "text-destructive border-destructive" : "text-primary border-primary"}
        />
        <StatCard
            title="Total Inventory Value"
            value={formatCurrency(totalInventoryValue)}
            icon={Package}
            description="Value of all stock based on cost price."
        />
        {secondaryMetrics.map((metric: any) => (
          <StatCard key={metric.title} {...metric} />
        ))}
        {(stockMetrics || []).map((metric: any) => (
          <StatCard key={metric.title} {...metric} />
        ))}
      </CollapsibleContent>
    </>
  );
}
