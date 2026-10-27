
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Expense, Payment, Booking, StockSale, SalonService, StockReturn, Transfer } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { FileText, Plus, DollarSign, TrendingUp, TrendingDown, Landmark, CreditCard, Banknote, Smartphone, Edit, Trash2, Printer } from 'lucide-react';
import ExpensesLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { getExpenseColumns } from '@/components/expenses/columns';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { ExpenseReceiptDialog } from '@/components/expenses/expense-receipt-dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as DialogTitleComponent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

function ExpensesPage() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const { userProfile } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [actionsExpense, setActionsExpense] = React.useState<Expense | null>(null);
  const [expenseToPrint, setExpenseToPrint] = React.useState<Expense | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = React.useState(false);
  const [voidConfirmText, setVoidConfirmText] = React.useState('');
  const CONFIRM_VOID_TEXT = "VOID";


  // Use real-time listeners for all financial data
  const expensesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'expenses'), orderBy('date', 'desc')) : null, [firestore, reloadCounter]);
  const paymentsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore, reloadCounter]);
  const bookingsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'bookings')) : null, [firestore, reloadCounter]);
  const stockSalesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'stockSales')) : null, [firestore, reloadCounter]);
  const salonServicesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'salonServices'), where('paymentStatus', '==', 'Paid')) : null, [firestore, reloadCounter]);
  const stockReturnsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'stockReturns')) : null, [firestore, reloadCounter]);
  const transfersQuery = React.useMemo(() => firestore ? query(collection(firestore, 'transfers')) : null, [firestore, reloadCounter]);

  const { data: expenses, isLoading: areExpensesLoading } = useCollection<Expense>(expensesQuery);
  const { data: payments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);
  const { data: bookings, isLoading: areBookingsLoading } = useCollection<Booking>(bookingsQuery);
  const { data: stockSales, isLoading: areStockSalesLoading } = useCollection<StockSale>(stockSalesQuery);
  const { data: salonServices, isLoading: areSalonServicesLoading } = useCollection<SalonService>(salonServicesQuery);
  const { data: stockReturns, isLoading: areStockReturnsLoading } = useCollection<StockReturn>(stockReturnsQuery);
  const { data: transfers, isLoading: areTransfersLoading } = useCollection<Transfer>(transfersQuery);


  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const { filteredExpenses, summaryStats, grandTotalNetIncome, accountBalances } = React.useMemo(() => {
    // === INCOME ===
    const allBookingPayments = (bookings || [])
        .filter(b => b.paymentMethod && b.status !== 'Refunded' && b.status !== 'Cancelled')
        .map(b => ({
            amount: b.totalAmount || 0,
            date: getSafeDate(b.createdAt)!,
            paymentMethod: b.paymentMethod!,
        }));

    const allAdditionalPayments = (payments || []).map(p => ({
        amount: p.amount,
        date: getSafeDate(p.transactionDate)!,
        paymentMethod: p.paymentMethod,
    }));

    const allStockSalesPayments = (stockSales || [])
      .filter(s => s.paymentStatus === 'Paid')
      .map(s => ({
        amount: s.totalAmount,
        date: getSafeDate(s.soldAt)!,
        paymentMethod: s.paymentMethod,
      }));

    const allSalonServicesPayments = (salonServices || [])
      .filter(s => s.paymentStatus === 'Paid')
      .map(s => ({
          amount: s.totalPrice,
          date: getSafeDate(s.createdAt)!,
          paymentMethod: s.paymentMethod,
      }));

    const allPayments = [...allBookingPayments, ...allAdditionalPayments, ...allStockSalesPayments, ...allSalonServicesPayments].filter(p => p.date);

    // === REFUNDS & RETURNS ===
    const allBookingRefunds = (bookings || [])
        .filter(b => b.status === 'Refunded')
        .map(b => ({
            amount: b.totalAmount || 0,
            date: getSafeDate(b.refundedAt || b.cancelledAt)!
        }));

    const allStockReturns = (stockReturns || []).map(r => ({
      amount: r.totalRefundAmount,
      date: getSafeDate(r.returnedAt)!
    }));

    const allRefundsAndReturns = [...allBookingRefunds, ...allStockReturns].filter(r => r.date);

    // === EXPENSES ===
    const allExpenses = expenses || [];

    const accountBalances = new Map<string, number>();

    allPayments.forEach(p => {
        const method = p.paymentMethod;
        accountBalances.set(method, (accountBalances.get(method) || 0) + p.amount);
    });

    allExpenses.filter(e => e.status !== 'Voided').forEach(e => {
        const method = e.paymentMethod;
        accountBalances.set(method, (accountBalances.get(method) || 0) - e.amount);
    });

    (transfers || []).forEach(transfer => {
        const fromBalance = accountBalances.get(transfer.fromAccount) || 0;
        const toBalance = accountBalances.get(transfer.toAccount) || 0;
        accountBalances.set(transfer.fromAccount, fromBalance - transfer.amount);
        accountBalances.set(transfer.toAccount, toBalance + transfer.amount);
    });

    // Grand Total Calculation
    const grandTotalIncome = allPayments.reduce((acc, p) => acc + p.amount, 0);
    const grandTotalRefunds = allRefundsAndReturns.reduce((acc, r) => acc + r.amount, 0);
    const grandTotalExpenses = allExpenses.filter(e => e.status !== 'Voided').reduce((acc, e) => acc + e.amount, 0);
    const calculatedGrandTotalNetIncome = grandTotalIncome - grandTotalRefunds - grandTotalExpenses;


    // Filter by date range
    const applyDateFilter = (items: any[], dateField: string) => {
        if (!dateRange?.from) return items;
        return items.filter(i => {
            const itemDate = getSafeDate(i[dateField]);
            return itemDate && isWithinInterval(itemDate, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to || dateRange.from!) });
        });
    }

    const dateFilteredPayments = applyDateFilter(allPayments, 'date');
    const dateFilteredRefunds = applyDateFilter(allRefundsAndReturns, 'date');
    const dateFilteredExpenses = applyDateFilter(allExpenses, 'date');

    const totalIncome = dateFilteredPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalRefunds = dateFilteredRefunds.reduce((acc, r) => acc + r.amount, 0);
    const totalExpenses = dateFilteredExpenses.filter(e => e.status !== 'Voided').reduce((acc, e) => acc + e.amount, 0);
    const netIncome = totalIncome - totalRefunds - totalExpenses;

    return {
      filteredExpenses: dateFilteredExpenses,
      summaryStats: {
        totalIncome: dateRange?.from ? totalIncome : grandTotalIncome,
        totalExpenses: dateRange?.from ? totalExpenses : grandTotalExpenses,
        netIncome: dateRange?.from ? netIncome : calculatedGrandTotalNetIncome,
      },
      grandTotalNetIncome: calculatedGrandTotalNetIncome,
      accountBalances,
    };

  }, [expenses, payments, bookings, stockSales, salonServices, stockReturns, dateRange, transfers]);

  const handleSuccess = () => {
    setReloadCounter(c => c + 1);
  };

  const handleEdit = (expense: Expense) => {
    router.push(`/expenses/${expense.id}/edit`);
  };

  const confirmVoid = async () => {
    if (!firestore || !userProfile || !actionsExpense) return;
    try {
      const expenseRef = doc(firestore, 'expenses', actionsExpense.id);
      await updateDoc(expenseRef, {
        status: 'Voided',
        voidedAt: serverTimestamp(),
        voidedBy: userProfile.name,
        voidedByUid: userProfile.uid,
      });
      toast({ variant: 'success', title: 'Expense Voided', description: `The expense "${actionsExpense.description}" has been marked as void.` });
      handleSuccess();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        handleCloseDialogs();
    }
  }

  const handleCloseDialogs = () => {
    setActionsExpense(null);
    setShowVoidConfirm(false);
    setVoidConfirmText('');
  };

  const columns = React.useMemo(() => getExpenseColumns({ currency, onActions: setActionsExpense }), [currency]);

  const getPaymentMethodIcon = (method: string) => {
    const lowerMethod = method.toLowerCase();
    if (lowerMethod.includes('card')) return CreditCard;
    if (lowerMethod.includes('cash')) return Banknote;
    if (lowerMethod.includes('transfer') || lowerMethod.includes('bank')) return Landmark;
    if (lowerMethod.includes('mobile')) return Smartphone;
    return DollarSign;
  };

  const isLoading = areExpensesLoading || arePaymentsLoading || areBookingsLoading || areStockSalesLoading || areSalonServicesLoading || areStockReturnsLoading || areTransfersLoading;

  if (isLoading) {
    return <ExpensesLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Expenses</h1>
              <p className="text-muted-foreground">
                Log, track, and manage all your business expenses.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             <Button asChild>
                <Link href="/expenses/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="All-Time Net Income"
              value={formatCurrency(grandTotalNetIncome)}
              icon={Landmark}
              description="Total income minus all expenses & refunds."
              className={grandTotalNetIncome >= 0 ? "border-green-500 text-green-500" : "border-destructive text-destructive"}
              isLoading={isLoading}
            />
            <StatCard
              title={dateRange?.from ? "Filtered Gross Income" : "All-Time Gross Income"}
              value={formatCurrency(summaryStats.totalIncome)}
              icon={TrendingUp}
              description={dateRange?.from ? "Gross revenue in the selected period." : "All-time gross revenue from all sources."}
              className="border-green-500 text-green-500"
              isLoading={isLoading}
            />
             <StatCard
              title={dateRange?.from ? "Filtered Expenses" : "All-Time Expenses"}
              value={formatCurrency(summaryStats.totalExpenses)}
              icon={TrendingDown}
              description={dateRange?.from ? "Expenses in the selected period." : "All-time recorded business expenses."}
              className="border-destructive text-destructive"
              isLoading={isLoading}
            />
             <StatCard
              title={dateRange?.from ? "Filtered Net Income" : "All-Time Net Income"}
              value={formatCurrency(summaryStats.netIncome)}
              icon={Landmark}
              description={dateRange?.from ? "Income minus expenses for the period." : "Total income after all expenses."}
              className={summaryStats.netIncome >= 0 ? "border-green-500 text-green-500" : "border-destructive text-destructive"}
              isLoading={isLoading}
            />
          </div>

        <Card>
            <CardHeader>
                <CardTitle>Account Balances</CardTitle>
                <CardDescription>Real-time balance of each payment account after all income and expenses.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from(accountBalances.entries()).map(([method, balance]) => (
                        <StatCard
                            key={method}
                            title={`${method} Balance`}
                            value={formatCurrency(balance)}
                            icon={getPaymentMethodIcon(method)}
                            description={method === 'Credit' ? 'Total amount owed by customers.' : `Available funds in ${method} account.`}
                            className={method === 'Credit' ? 'border-destructive text-destructive' : (balance < 0 ? 'border-destructive text-destructive' : '')}
                        />
                    ))}
                    {accountBalances.size === 0 && (
                      <p className="text-sm text-muted-foreground col-span-full text-center py-4">No account activity to display.</p>
                    )}
                </div>
            </CardContent>
        </Card>

          <Card>
            <CardHeader>
                <CardTitle>Expense Log</CardTitle>
                <CardDescription>
                    A detailed list of all recorded business expenses. Use the date picker to filter.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {filteredExpenses.length > 0 ? (
                    <DataTable
                        columns={columns}
                        data={filteredExpenses}
                        filterColumn="description"
                        filterPlaceholder="Filter by description..."
                        tableId="expenses-log"
                    />
                ) : (
                    <EmptyState
                        icon={FileText}
                        title="No Expenses Recorded"
                        description={dateRange?.from ? "There are no expenses recorded in this period." : "Click 'Add Expense' to start logging your business expenses."}
                        className="h-64"
                    />
                )}
            </CardContent>
          </Card>
      </div>

       <Dialog open={!!actionsExpense} onOpenChange={(open) => { if (!open) handleCloseDialogs(); }}>
        <DialogContent>
            {actionsExpense && (
              <>
                <DialogHeader>
                    <DialogTitleComponent>{showVoidConfirm ? 'Confirm Void Expense' : 'Actions for Expense'}</DialogTitleComponent>
                    {!showVoidConfirm ? (
                        <DialogDescription>{actionsExpense.description}</DialogDescription>
                    ) : (
                        <DialogDescription>
                            This will permanently mark the expense for "{actionsExpense.description}" as voided. This action cannot be undone.
                        </DialogDescription>
                    )}
                </DialogHeader>
                {!showVoidConfirm ? (
                    <div className="grid gap-3 py-4">
                        <Button variant="outline" className="justify-start" onClick={() => { setExpenseToPrint(actionsExpense); handleCloseDialogs(); }}>
                            <Printer className="mr-2 h-4 w-4" /> Print Receipt
                        </Button>
                        {actionsExpense.status !== 'Voided' && (
                            <>
                                <Button variant="outline" className="justify-start" onClick={() => { handleEdit(actionsExpense!); handleCloseDialogs(); }}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit Expense
                                </Button>
                                <Button variant="destructive" className="justify-start" onClick={() => setShowVoidConfirm(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Void Expense
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 py-4">
                        <Label htmlFor="void-confirm" className="text-destructive">Type "{CONFIRM_VOID_TEXT}" to confirm.</Label>
                        <Input id="void-confirm" value={voidConfirmText} onChange={e => setVoidConfirmText(e.target.value)} autoComplete="off" />
                    </div>
                )}
                <DialogFooter>
                    {!showVoidConfirm ? (
                        <Button variant="ghost" onClick={handleCloseDialogs}>Close</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setShowVoidConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmVoid} disabled={voidConfirmText !== CONFIRM_VOID_TEXT}>Confirm Void</Button>
                        </>
                    )}
                </DialogFooter>
              </>
            )}
        </DialogContent>
      </Dialog>
      <ExpenseReceiptDialog
        isOpen={!!expenseToPrint}
        onClose={() => setExpenseToPrint(null)}
        expense={expenseToPrint}
      />
    </>
  );
}

export default withAuth(ExpensesPage, PagePermission.MANAGE_EXPENSES);

