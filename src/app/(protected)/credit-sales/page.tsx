
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  writeBatch,
  doc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';
import type { StockSale, Payment, StockReturn, Customer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { History, Search, Download, Loader2, Printer, CreditCard, TrendingUp, Undo2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { getCreditSalesColumns, type CreditSale } from './columns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { getSafeDate } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, format, isToday } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { StatCard } from '@/components/ui/stat-card';
import CreditSalesLoading from './loading';
import { exportToCsv } from '@/lib/csv-export';
import { useUser } from '@/contexts/user-context';
import { RecordCreditPaymentDialog } from '@/components/stock/record-credit-payment-dialog';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';


function CreditSalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const { getCollectionPath, isGlobalMode, isBranchMode, currentBranch } = useBranch();

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [saleToRecordPayment, setSaleToRecordPayment] = React.useState<CreditSale | null>(null);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [actionsSale, setActionsSale] = React.useState<CreditSale | null>(null);

  const salesConstraints = React.useMemo(() => [where('paymentMethod', '==', 'Credit'), orderBy('soldAt', 'desc')], []);
  const paymentsConstraints = React.useMemo(() => [where('type', '==', 'Credit Repayment')], []);

  // Branch mode queries
  const branchSalesQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('stockSales')), ...salesConstraints) : null, [firestore, isGlobalMode, getCollectionPath, salesConstraints]);
  const branchPaymentsQuery = React.useMemo(() => !isGlobalMode && firestore ? query(collection(firestore, getCollectionPath('payments')), ...paymentsConstraints) : null, [firestore, isGlobalMode, getCollectionPath, paymentsConstraints]);

  const branchSalesResult = useCollection<StockSale>(branchSalesQuery);
  const branchPaymentsResult = useCollection<Payment>(branchPaymentsQuery);

  // Global mode queries
  const globalSalesResult = useGlobalCollectionData<StockSale>('stockSales', salesConstraints);
  const globalPaymentsResult = useGlobalCollectionData<Payment>('payments', paymentsConstraints);

  // Use appropriate result based on mode
  const { data: sales, isLoading: areSalesLoading } = isGlobalMode ? globalSalesResult : branchSalesResult;
  const { data: payments, isLoading: arePaymentsLoading } = isGlobalMode ? globalPaymentsResult : branchPaymentsResult;

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const { creditSales, summaryStats } = React.useMemo(() => {
    let salesToProcess = sales || [];

    // Filter by date range first
    if (dateRange?.from) {
      salesToProcess = salesToProcess.filter(sale => {
          const soldAt = getSafeDate(sale.soldAt);
          return soldAt && isWithinInterval(soldAt, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to || dateRange.from!) });
        });
    }

    // Then filter by search term
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        salesToProcess = salesToProcess.filter(sale =>
            (sale.customerName?.toLowerCase().includes(lowercasedTerm)) ||
            (sale.saleId && sale.saleId.toLowerCase().includes(lowercasedTerm))
        );
    }

    let totalCredit = 0;
    let totalRepaid = 0;

    const salesWithBalance = salesToProcess.map(sale => {
        const repaymentsForSale = (payments || []).filter(p => p.bookingId === sale.id);
        const totalRepaidForSale = repaymentsForSale.reduce((sum, p) => sum + p.amount, 0) + (sale.initialPaymentAmount || 0);
        const outstandingBalance = sale.totalAmount - totalRepaidForSale;

        totalCredit += sale.totalAmount;
        totalRepaid += totalRepaidForSale;

        return {
            ...sale,
            totalPaid: totalRepaidForSale,
            outstandingBalance,
        };
    });

    const todaysCreditSales = (sales || []).filter(s => {
        const soldAt = getSafeDate(s.soldAt);
        return soldAt && isToday(soldAt) && s.paymentMethod === 'Credit';
    }).reduce((acc, s) => acc + s.totalAmount, 0);

    const totalOutstanding = totalCredit - totalRepaid;

    return {
      creditSales: salesWithBalance,
      summaryStats: {
        totalCredit,
        totalRepaid,
        totalOutstanding,
        todaysCreditSales: todaysCreditSales,
      },
    };
  }, [sales, payments, dateRange, searchTerm]);

  const handleConfirmPayment = async (sale: CreditSale, paymentAmount: number, paymentMethod: string, paymentRef: string) => {
    if (!firestore || !userProfile) {
        throw new Error('User or Firestore not available');
    }

    const batch = writeBatch(firestore);

    // 1. Create a new payment document
    const newPaymentRef = doc(collection(firestore, 'payments'));
    const newPaymentData: Omit<Payment, 'id'> = {
      bookingId: sale.id, // Link payment to the sale
      guestName: sale.customerName || 'N/A',
      guestEmail: sale.customerEmail,
      amount: paymentAmount,
      paymentMethod,
      status: 'Paid',
      transactionDate: new Date(),
      type: 'Credit Repayment',
      createdByUid: userProfile.uid,
      createdByName: userProfile.name,
      ...(paymentRef && { notes: paymentRef }),
    };
    batch.set(newPaymentRef, newPaymentData);

    // 2. Update the sale's payment status if fully paid
    if (sale.outstandingBalance - paymentAmount <= 0) {
      const saleRef = doc(firestore, 'stockSales', sale.id);
      batch.update(saleRef, { paymentStatus: 'Paid' });

      // 3. Delete the linked running table (held sale) if it exists
      if (sale.linkedHeldSaleId) {
        const heldSaleRef = doc(firestore, getCollectionPath('heldSales'), sale.linkedHeldSaleId);
        batch.delete(heldSaleRef);
      }
    }

    await batch.commit();
    setReloadCounter(c => c + 1); // Trigger a re-fetch
  };

  const columns = React.useMemo(() => getCreditSalesColumns({ currency, onActions: setActionsSale }), [currency]);

  const handleExport = () => {
    if (creditSales.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no credit sales to export for the current filters.',
      });
      return;
    }
    setIsExporting(true);
    try {
      const dataToExport = creditSales.map(s => ({
        'Sale ID': s.saleId,
        'Customer': s.customerName,
        'Date': format(getSafeDate(s.soldAt)!, 'EEEE dd-MM-yyyy, p'),
        'Total Amount': s.totalAmount,
        'Amount Paid': s.totalPaid,
        'Outstanding Balance': s.outstandingBalance,
        'Sold By': s.soldByName,
      }));
      exportToCsv(dataToExport, `credit-sales-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = areSalesLoading || arePaymentsLoading;

  if (isLoading) {
    return <CreditSalesLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <CreditCard className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Credit Sales</h1>
              <p className="text-muted-foreground">
                {isBranchMode ? `Branch: ${currentBranch?.name}` : "Track and manage all outstanding payments from credit sales."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Today's Credit Sales"
              value={formatCurrency(summaryStats.todaysCreditSales)}
              icon={TrendingUp}
              description="Value of sales made on credit today."
              className="border-blue-500 text-blue-500"
            />
            <StatCard
              title="Total Credit Sales"
              value={formatCurrency(summaryStats.totalCredit)}
              icon={DollarSign}
              description="Total value of all sales made on credit."
            />
            <StatCard
              title="Total Repaid"
              value={formatCurrency(summaryStats.totalRepaid)}
              icon={Undo2}
              description="Total amount repaid towards credit sales."
              className="border-green-500 text-green-500"
            />
            <StatCard
              title="Total Outstanding"
              value={formatCurrency(summaryStats.totalOutstanding)}
              icon={DollarSign}
              description="Total amount still owed by all customers."
              className="border-destructive text-destructive"
            />
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Credit Sales History</CardTitle>
                  <CardDescription>
                      A list of all sales made on credit. Use the actions to record payments.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name or Sale ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
                 <DataTable
                    columns={columns}
                    data={creditSales}
                    filterColumn="customerName"
                    tableId="credit-sales-history"
                />
            </CardContent>
          </Card>
      </div>
      <RecordCreditPaymentDialog
        isOpen={!!saleToRecordPayment}
        onClose={() => setSaleToRecordPayment(null)}
        sale={saleToRecordPayment}
        onConfirm={handleConfirmPayment}
      />
       <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
      />
       <Dialog open={!!actionsSale} onOpenChange={(open) => !open && setActionsSale(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Actions for Sale #{actionsSale?.saleId}</DialogTitle>
                 <DialogDescription>
                  Customer: {actionsSale?.customerName}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                        setSaleToRecordPayment(actionsSale);
                        setActionsSale(null);
                    }}
                    disabled={(actionsSale?.outstandingBalance ?? 0) <= 0}
                >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                </Button>
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                        setSaleToPrint(actionsSale as StockSale);
                        setActionsSale(null);
                    }}
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Reprint Receipt
                </Button>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setActionsSale(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(CreditSalesPage, PagePermission.MANAGE_CREDIT_SALES);
