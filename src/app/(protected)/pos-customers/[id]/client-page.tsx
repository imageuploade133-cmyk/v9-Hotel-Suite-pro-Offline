
'use client';

import * as React from 'react';
import Image from 'next/image';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Customer, StockSale, StockReturn, Payment } from '@/lib/types';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { ArrowLeft, CreditCard, DollarSign, Info, MoreHorizontal, Phone, Printer, ShoppingCart, Undo2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { useSettings } from '@/contexts/settings-context';
import { PayCreditDialog } from '@/components/customers/pay-credit-dialog';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { CreditPaymentReceiptDialog } from '@/components/customers/credit-payment-receipt-dialog';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecordCreditPaymentDialog } from '@/components/stock/record-credit-payment-dialog';
import { writeBatch } from 'firebase/firestore';
import type { CreditSale } from '@/app/(protected)/credit-sales/columns';
import { usePOS } from '@/hooks/usePOS';
import CustomerDetailsLoading from './loading';

type Transaction = (StockSale | Payment | StockReturn) & { transactionType: 'Sale' | 'Payment' | 'Return' };

function TransactionHistory({ transactions, currency, customer, onRecordPayment }: { transactions: Transaction[], currency: string, customer: Customer, onRecordPayment: (sale: StockSale & { totalPaid: number, outstandingBalance: number }) => void }) {
    const [openItem, setOpenItem] = React.useState<string | null>(null);
    const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
    const [creditPaymentReceipt, setCreditPaymentReceipt] = React.useState<{ payment: Payment; customer: Customer; balance: number } | null>(null);

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(value);

    // Sort transactions chronologically to calculate running balance correctly
    const chronologicalTransactions = React.useMemo(() => {
        return [...transactions].sort((a, b) => {
            const dateA = getSafeDate((a as any).soldAt || (a as any).transactionDate || (a as any).returnedAt)!;
            const dateB = getSafeDate((b as any).soldAt || (b as any).transactionDate || (b as any).returnedAt)!;
            return dateA.getTime() - dateB.getTime();
        });
    }, [transactions]);

    const runningBalances = React.useMemo(() => {
        let currentBalance = 0;
        const balances: { [id: string]: number } = {};

        chronologicalTransactions.forEach(trans => {
            if (trans.transactionType === 'Sale' && (trans as StockSale).paymentMethod === 'Credit') {
                currentBalance += (trans as StockSale).totalAmount - ((trans as StockSale).initialPaymentAmount || 0);
            } else if (trans.transactionType === 'Payment') {
                currentBalance -= (trans as Payment).amount;
            } else if (trans.transactionType === 'Return') {
                currentBalance -= (trans as StockReturn).totalRefundAmount;
            }
            balances[trans.id] = Math.max(0, currentBalance);
        });
        return balances;
    }, [chronologicalTransactions]);

    const handlePrintCreditPayment = (paymentToReprint: Payment) => {
        const balanceBeforePayment = runningBalances[paymentToReprint.id] + paymentToReprint.amount;

        setCreditPaymentReceipt({
            payment: paymentToReprint,
            customer: customer,
            balance: Math.max(0, balanceBeforePayment),
        });
    };

    return (
        <div className="space-y-3">
            {chronologicalTransactions.slice().reverse().map(t => {
                const date = getSafeDate((t as any).soldAt || (t as any).transactionDate || (t as any).returnedAt);

                let icon: React.ReactNode, title: string, amount: number, amountClass: string;
                let saleDetails: React.ReactNode = null;

                switch (t.transactionType) {
                    case 'Sale':
                        const sale = t as StockSale;
                        icon = <ShoppingCart className="h-5 w-5 text-blue-500" />;
                        title = `Sale #${sale.saleId}`;
                        amount = sale.totalAmount;
                        amountClass = 'text-foreground';

                        const repayments = transactions.filter(p => p.transactionType === 'Payment' && p.bookingId === sale.id) as Payment[];
                        const totalPaidForSale = (sale.initialPaymentAmount || 0) + repayments.reduce((sum, p) => sum + p.amount, 0);
                        const balanceForSale = sale.totalAmount - totalPaidForSale;
                        const isCredit = sale.paymentMethod === 'Credit';

                        saleDetails = (
                             <div className="text-xs space-y-2 mt-2">
                                <div className="flex justify-between"><span>Payment Method:</span><span className="font-medium">{sale.paymentMethod}</span></div>
                                {sale.initialPaymentAmount && <div className="flex justify-between"><span>Initial Payment:</span><span>{formatCurrency(sale.initialPaymentAmount)}</span></div>}
                                {repayments.map(p => (
                                    <div key={p.id} className="flex justify-between"><span>Repayment ({format(getSafeDate(p.transactionDate)!, 'PP')}):</span><span>{formatCurrency(p.amount)}</span></div>
                                ))}
                                <div className="flex justify-between font-semibold border-t pt-2"><span>Total Paid for this Sale:</span><span>{formatCurrency(totalPaidForSale)}</span></div>
                                {isCredit && balanceForSale > 0 && <div className="flex justify-between font-semibold text-destructive"><span>Balance on this Sale:</span><span>{formatCurrency(balanceForSale)}</span></div>}
                                {isCredit && balanceForSale > 0 && (
                                    <div className="pt-2">
                                        <Button
                                            size="sm"
                                            onClick={() => onRecordPayment({ ...sale, totalPaid: totalPaidForSale, outstandingBalance: balanceForSale })}
                                        >
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            Record Payment for this Sale
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )
                        break;
                    case 'Payment':
                        const payment = t as Payment;
                        icon = <CreditCard className="h-5 w-5 text-green-500" />;
                        title = `Credit Repayment`;
                        amount = -payment.amount;
                        amountClass = 'text-green-600';
                        break;
                    case 'Return':
                        const ret = t as StockReturn;
                        icon = <Undo2 className="h-5 w-5 text-yellow-600" />;
                        title = `Return for Sale #${ret.originalSaleId?.substring(0,8)}`;
                        amount = -ret.totalRefundAmount;
                        amountClass = 'text-yellow-600';
                        break;
                    default:
                        icon = <DollarSign className="h-5 w-5" />;
                        title = "Unknown Transaction";
                        amount = 0;
                        amountClass = 'text-muted-foreground';
                }
                const currentRunningBalance = runningBalances[t.id];

                return (
                    <Collapsible key={t.id} open={openItem === t.id} onOpenChange={() => setOpenItem(openItem === t.id ? null : t.id)}>
                        <div className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50">
                            <CollapsibleTrigger className="flex-1 text-left flex items-center gap-4">
                                {icon}
                                <div>
                                    <p className="font-semibold">{title}</p>
                                    <p className="text-xs text-muted-foreground">{date ? format(date, 'PPp') : 'N/A'}</p>
                                </div>
                            </CollapsibleTrigger>
                             <div className="flex items-center gap-4">
                                <p className={`font-semibold ${amountClass}`}>
                                    {amount >= 0 ? formatCurrency(amount) : `-${formatCurrency(Math.abs(amount))}`}
                                </p>
                                {currentRunningBalance > 0 && (
                                  <Badge variant="destructive" className="ml-2">
                                      Balance: {formatCurrency(currentRunningBalance)}
                                  </Badge>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {t.transactionType === 'Sale' && <DropdownMenuItem onClick={() => setSaleToPrint(t as StockSale)}><Printer className="mr-2 h-4 w-4" />Print Sale Receipt</DropdownMenuItem>}
                                        {t.transactionType === 'Payment' && <DropdownMenuItem onClick={() => handlePrintCreditPayment(t as Payment)}><Printer className="mr-2 h-4 w-4" />Print Payment Receipt</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <CollapsibleContent className="p-4 bg-muted/30 border border-t-0 rounded-b-md">
                            {(t.transactionType === 'Sale' || t.transactionType === 'Return') && (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {(t.transactionType === 'Sale' ? (t as StockSale).items : (t as StockReturn).items).map((item: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell>{item.itemName}</TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.sellingPrice || item.refundAmount || 0)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency((item.sellingPrice || item.refundAmount || 0) * item.quantity)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {saleDetails}
                        </CollapsibleContent>
                    </Collapsible>
                );
            })}

            {saleToPrint && <StockSaleReceiptDialog
                isOpen={!!saleToPrint}
                onClose={() => setSaleToPrint(null)}
                sale={saleToPrint}
                customerBalance={runningBalances[saleToPrint?.id || '']}
            />}
            {creditPaymentReceipt && (
                <CreditPaymentReceiptDialog
                    isOpen={!!creditPaymentReceipt}
                    onClose={() => setCreditPaymentReceipt(null)}
                    payment={creditPaymentReceipt.payment}
                    customer={creditPaymentReceipt.customer}
                    remainingBalance={creditPaymentReceipt.balance}
                />
            )}
        </div>
    )
}

function CustomerDetails({ customerData }: { customerData: any }) {
    const firestore = useFirestore();
    const { userProfile } = useUser();
    const { toast } = useToast();
    const { settings } = useSettings();
    const { getCollectionPath } = useBranch();
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isPayCreditOpen, setIsPayCreditOpen] = React.useState(false);
    const [reload, setReload] = React.useState(0);
    const [receiptData, setReceiptData] = React.useState<{ payment: Payment; customer: Customer; balance: number } | null>(null);
    const [saleToRecordPayment, setSaleToRecordPayment] = React.useState<(StockSale & { totalPaid: number, outstandingBalance: number }) | null>(null);

    const customer: Customer & { totalSpent?: number; totalPaid?: number; outstandingBalance?: number; } = {
        ...customerData,
        lastVisit: getSafeDate(customerData.lastVisit),
        createdAt: getSafeDate(customerData.createdAt),
    };

    const currency = settings?.currency || 'USD';
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(value);

    const { totalSpent, totalPaid, totalReturned, outstandingBalance } = React.useMemo(() => {
        if (transactions.length === 0) {
            return { totalSpent: 0, totalPaid: 0, totalReturned: 0, outstandingBalance: 0 };
        }

        let spent = 0;
        let paid = 0;
        let returned = 0;

        transactions.forEach(t => {
            if (t.transactionType === 'Sale') {
                const sale = t as StockSale;
                spent += sale.totalAmount;
                if (sale.paymentMethod !== 'Credit') {
                    paid += sale.totalAmount;
                } else if (sale.initialPaymentAmount) {
                    paid += sale.initialPaymentAmount;
                }
            } else if (t.transactionType === 'Payment') {
                paid += (t as Payment).amount;
            } else if (t.transactionType === 'Return') {
                returned += (t as StockReturn).totalRefundAmount;
            }
        });

        const balance = spent - paid - returned;

        return {
            totalSpent: spent,
            totalPaid: paid,
            totalReturned: returned,
            outstandingBalance: Math.max(0, balance)
        };
    }, [transactions]);

    React.useEffect(() => {
        const fetchTransactions = async () => {
            if (!firestore || !customer.id) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const salesQuery = query(collection(firestore, getCollectionPath('stockSales')), where('customerId', '==', customer.id), orderBy('soldAt', 'desc'));
                // Fetch all payment types (POS and Credit Repayment) for this customer's email
                const paymentsQuery = query(collection(firestore, getCollectionPath('payments')), where('guestEmail', '==', customer.email), orderBy('transactionDate', 'desc'));
                const returnsQuery = query(collection(firestore, getCollectionPath('stockReturns')), where('customerId', '==', customer.id), orderBy('returnedAt', 'desc'));

                const [salesSnap, paymentsSnap, returnsSnap] = await Promise.all([getDocs(salesQuery), getDocs(paymentsQuery), getDocs(returnsQuery)]);

                const salesData: Transaction[] = salesSnap.docs.map(d => ({ ...(d.data() as StockSale), id: d.id, transactionType: 'Sale' }));
                const paymentsData: Transaction[] = paymentsSnap.docs
                    .map(d => ({ ...(d.data() as Payment), id: d.id, transactionType: 'Payment' }))
                    .filter(p => p.type === 'POS' || p.type === 'Credit Repayment');
                const returnsData: Transaction[] = returnsSnap.docs.map(d => ({ ...(d.data() as StockReturn), id: d.id, transactionType: 'Return' } as unknown as Transaction));


                const all = [...salesData, ...paymentsData, ...returnsData].sort((a, b) => {
                    const dateA = getSafeDate((a as any).soldAt || (a as any).transactionDate || (a as any).returnedAt)!;
                    const dateB = getSafeDate((b as any).soldAt || (b as any).transactionDate || (b as any).returnedAt)!;
                    return dateB.getTime() - dateA.getTime();
                });

                setTransactions(all);
            } catch (error) {
                console.error("Transaction fetch error:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not fetch transaction history." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [firestore, customer.id, customer.email, toast, reload]);

    const handlePaymentSuccess = (data: { payment: Payment; customer: Customer; balance: number }) => {
        setIsPayCreditOpen(false);
        setReceiptData(data);
        setReload(c => c + 1);
    };

    const handleRecordPaymentForSale = (sale: StockSale & { totalPaid: number, outstandingBalance: number }) => {
        setSaleToRecordPayment(sale);
    };

    const handleConfirmPaymentForSale = async (sale: StockSale & { totalPaid: number; outstandingBalance: number; }, paymentAmount: number, paymentMethod: string, paymentRef: string) => {
        if (!firestore || !userProfile) {
            throw new Error('User or Firestore not available');
        }

        const batch = writeBatch(firestore);
        const newPaymentRef = doc(collection(firestore, getCollectionPath('payments')));
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

        if (sale.outstandingBalance - paymentAmount <= 0.001) {
            const saleRef = doc(firestore, getCollectionPath('stockSales'), sale.id);
            batch.update(saleRef, { paymentStatus: 'Paid' });
        }

        await batch.commit();
        setReload(c => c + 1);
    };

    const lastVisitDate = getSafeDate(customer?.lastVisit);

    if (isLoading) {
      return <CustomerDetailsLoading />;
    }

    return (
        <>
            <div className="flex flex-col gap-6">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={customer.photoURL} />
                        <AvatarFallback className="text-2xl">{getInitials(customer.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold">{customer.name}</h2>
                        <p className="text-muted-foreground">{customer.email}</p>
                    </div>
                     <Button onClick={() => setIsPayCreditOpen(true)} disabled={outstandingBalance <= 0}>
                        <CreditCard className="mr-2 h-4 w-4" /> Pay Full Credit
                    </Button>
                </div>

                <Separator />

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
                            <p className="text-xs text-muted-foreground">Total value of all sales.</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                            <DollarSign className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                             <p className="text-xs text-muted-foreground">All payments made.</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Returned</CardTitle>
                            <Undo2 className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalReturned)}</div>
                             <p className="text-xs text-muted-foreground">Value of all returned items.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Outstanding Balance</CardTitle>
                            <DollarSign className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                             <div className="text-2xl font-bold text-destructive">{formatCurrency(outstandingBalance)}</div>
                             <p className="text-xs text-muted-foreground">Remaining credit to be paid.</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Statement of Account</CardTitle>
                        <CardDescription>A complete history of sales and payments for this customer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                           <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                           </div>
                        ) : transactions.length > 0 ? (
                           <TransactionHistory transactions={transactions} currency={currency} customer={customer} onRecordPayment={handleRecordPaymentForSale} />
                        ) : (
                            <p className="py-4 text-center text-sm text-muted-foreground">No transaction history found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
             <PayCreditDialog
                isOpen={isPayCreditOpen}
                onClose={() => setIsPayCreditOpen(false)}
                customer={customer}
                outstandingBalance={outstandingBalance}
                onSuccess={handlePaymentSuccess}
            />
            {saleToRecordPayment && (
                <RecordCreditPaymentDialog
                    isOpen={!!saleToRecordPayment}
                    onClose={() => setSaleToRecordPayment(null)}
                    sale={saleToRecordPayment}
                    onConfirm={handleConfirmPaymentForSale}
                />
            )}
            {receiptData && (
                <CreditPaymentReceiptDialog
                    isOpen={!!receiptData}
                    onClose={() => setReceiptData(null)}
                    payment={receiptData.payment}
                    customer={receiptData.customer}
                    remainingBalance={receiptData.balance}
                />
            )}
        </>
    );
}

function PosCustomerClientPage({ customer }: { customer: any }) {
    const router = useRouter();

    if (!customer) {
        return <div className="text-center py-20">Customer not found.</div>
    }

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
             <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to POS Customers
            </Button>
            <CustomerDetails customerData={customer} />
        </div>
    );
}

export default withAuth(PosCustomerClientPage, PagePermission.MANAGE_POS_CUSTOMERS);
