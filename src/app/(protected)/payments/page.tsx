
'use client';

import React from 'react';
import { Wallet, Download, Loader2, Printer, Image as ImageIcon } from 'lucide-react';
import { PaymentList } from '@/components/payments/payment-list';
import type { Payment, Booking, StockSale, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ViewPaymentDialog } from '@/components/payments/view-payment-dialog';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { RefundDialog } from '@/components/payments/refund-dialog';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, query, where } from 'firebase/firestore';
import { exportToCsv } from '@/lib/csv-export';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getSafeDate } from '@/lib/helpers';
import * as htmlToImage from 'html-to-image';
import { PaymentHistoryReport } from '@/components/payments/payment-history-report';
import PaymentsLoading from './loading';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';

function PaymentsPage() {
  const [selectedPayment, setSelectedPayment] = React.useState<(Payment & { outstandingBalance?: number }) | null>(null);
  const [isViewOpen, setIsViewOpen] = React.useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false);
  const [isRefundOpen, setIsRefundOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const printRef = React.useRef<HTMLDivElement>(null);


  const firestore = useFirestore();
  const { user, userProfile, loading: isProfileLoading } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { getCollectionPath } = useBranch();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    if (!usersData) return new Map();
    return new Map(usersData.map(u => [u.uid, u]));
  }, [usersData]);

  const bookingsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'bookings'));
  }, [firestore, user, reloadCounter]);

  const additionalPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'payments'));
  }, [firestore, user, reloadCounter]);

  const stockSalesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, getCollectionPath('stockSales')));
  }, [firestore, user, reloadCounter, getCollectionPath]);

  const { data: bookings, isLoading: areBookingsLoading } = useCollection<Booking>(bookingsQuery);
  const { data: additionalPayments, isLoading: areAddPaymentsLoading } = useCollection<Payment>(additionalPaymentsQuery);
  const { data: stockSales, isLoading: areStockSalesLoading } = useCollection<StockSale>(stockSalesQuery);

  const customerCreditData = React.useMemo(() => {
    const customerData: { [email: string]: { totalCredit: number; totalRepaid: number } } = {};

    (stockSales || []).forEach(sale => {
        if (sale.paymentMethod === 'Credit' && sale.customerEmail) {
            if (!customerData[sale.customerEmail]) {
                customerData[sale.customerEmail] = { totalCredit: 0, totalRepaid: 0 };
            }
            customerData[sale.customerEmail].totalCredit += sale.totalAmount - (sale.initialPaymentAmount || 0);
        }
    });

    (additionalPayments || []).forEach(payment => {
        if (payment.type === 'Credit Repayment' && payment.guestEmail) {
             if (!customerData[payment.guestEmail]) {
                customerData[payment.guestEmail] = { totalCredit: 0, totalRepaid: 0 };
            }
            customerData[payment.guestEmail].totalRepaid += payment.amount;
        }
    });

    return customerData;

  }, [stockSales, additionalPayments]);

  const getOutstandingBalance = (email: string | null | undefined) => {
      if (!email || !customerCreditData[email]) return 0;
      const { totalCredit, totalRepaid } = customerCreditData[email];
      return Math.max(0, totalCredit - totalRepaid);
  }

  const { allPayments, refundedPayments, activeCheckinPayments } = React.useMemo(() => {
    if (!bookings && !additionalPayments) return { allPayments: [], refundedPayments: [], activeCheckinPayments: [] };

    const processPayment = (p: Payment | Booking): Payment => {
      const createdByUid = (p as any).createdByUid;
      const staffProfile = createdByUid ? userMap.get(createdByUid) : null;
      const staffName = staffProfile?.name || ('createdByName' in p ? p.createdByName : undefined) || 'System';

      if ('checkInDate' in p) { // This is a robust check for a Booking object
        const booking = p as Booking;
        const transactionDate = getSafeDate(booking.createdAt) || new Date();
        return {
          id: booking.bookingId || booking.id,
          guestName: booking.guestName,
          guestPhotoURL: booking.guestPhotoURL,
          guestEmail: booking.guestEmail,
          roomNumber: booking.roomNumber,
          amount: booking.totalAmount ?? 0,
          paymentMethod: booking.paymentMethod!,
          status: booking.status,
          transactionDate: transactionDate,
          bookingDetails: {
            ...booking,
            checkInDate: getSafeDate(booking.checkInDate),
            checkOutDate: getSafeDate(booking.checkOutDate),
            actualCheckOutDate: getSafeDate(booking.actualCheckOutDate),
          },
          type: 'Booking',
          createdByUid: createdByUid,
          createdByName: staffName,
        };
      }

      // It's a Payment object
      return {
        ...(p as Payment),
        transactionDate: getSafeDate((p as Payment).transactionDate)!,
        createdByUid: createdByUid,
        createdByName: staffName,
      };
    };

    const bookingPayments = (bookings || []).filter(booking => !!booking.paymentMethod).map(processPayment);
    const billPayments = (additionalPayments || []).map(processPayment);

    const combinedPayments = [...bookingPayments, ...billPayments].sort(
        (a, b) => (getSafeDate(b.transactionDate)?.getTime() || 0) - (getSafeDate(a.transactionDate)?.getTime() || 0)
    );

    const refunded = combinedPayments.filter(p => p.status === 'Refunded');
    const activeCheckins = combinedPayments.filter(p => p.status === 'Active' || p.status === 'Checked-in');
    const nonRefundedPayments = combinedPayments.filter(p => p.status !== 'Refunded');

    return { allPayments: nonRefundedPayments, refundedPayments: refunded, activeCheckinPayments: activeCheckins };
  }, [bookings, additionalPayments, userMap]);

  const userCurrency = settings?.currency || 'USD';
  const isLoading = areBookingsLoading || areAddPaymentsLoading || isProfileLoading || areStockSalesLoading || areUsersLoading;

  const handleViewDetails = (payment: Payment) => {
    const outstandingBalance = getOutstandingBalance(payment.guestEmail);
    setSelectedPayment({ ...payment, outstandingBalance });
    setIsViewOpen(true);
  };

  const handleReprintReceipt = (payment: Payment) => {
    const outstandingBalance = getOutstandingBalance(payment.guestEmail);
    setSelectedPayment({ ...payment, outstandingBalance });
    setIsReceiptOpen(true);
  };

  const handleRefund = (payment: Payment) => {
    const outstandingBalance = getOutstandingBalance(payment.guestEmail);
    setSelectedPayment({ ...payment, outstandingBalance });
    setIsRefundOpen(true);
  };

  const handleDataMutation = () => {
    setReloadCounter(prev => prev + 1);
  };

  const closeDialogs = () => {
    setSelectedPayment(null);
    setIsViewOpen(false);
    setIsReceiptOpen(false);
    setIsRefundOpen(false);
  };

  const handleExport = (data: Payment[], fileName: string) => {
    if (!data || data.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no payments to export in this view.',
      });
      return;
    }
    setIsExporting(true);
    toast({
      title: 'Exporting Data',
      description: 'Your payment history is being prepared for download.',
    });

    try {
      const dataToExport = data.map(p => ({
        'Transaction ID': p.id,
        'Guest Name': p.guestName,
        'Guest Email': p.guestEmail,
        'Room Number': p.roomNumber,
        'Amount': p.amount,
        'Currency': userCurrency,
        'Payment Method': p.paymentMethod,
        'Status': p.status,
        'Transaction Date': p.transactionDate.toISOString(),
        'Processed By': p.createdByName,
      }));

      exportToCsv(dataToExport, fileName);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'An unexpected error occurred while exporting data.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (content) {
      setIsPrinting(true);
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Payment History Report</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body class="p-8">');
        printWindow.document.write(content.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
          setIsPrinting(false);
        }, 500);
      } else {
        setIsPrinting(false);
      }
    }
  };

   const handleDownloadImage = async () => {
    const reportNode = printRef.current;
    if (!reportNode) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not find report content.' });
      return;
    }
    setIsExporting(true);
    toast({ title: 'Generating Image', description: 'Your report is being converted to an image.' });
    try {
      const dataUrl = await htmlToImage.toPng(reportNode, { quality: 1.0, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `payment-history-report_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      toast({ variant: 'success', title: 'Image Downloaded' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Image Generation Failed', description: 'Could not generate image.' });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <PaymentsLoading />;
  }

  return (
    <>
      <div className="hidden print:block">
        <div ref={printRef}>
          <PaymentHistoryReport data={allPayments} settings={settings} userProfile={userProfile} />
        </div>
      </div>
      <div className="flex h-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wallet className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Payment History
              </h1>
              <p className="text-muted-foreground">
                View and manage all transactions and payments.
              </p>
            </div>
          </div>
            <div className="flex items-center gap-2">
                 <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                    {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Print
                </Button>
                <Button variant="outline" onClick={handleDownloadImage} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                    Download
                </Button>
                <Button onClick={() => handleExport(allPayments, `all-payments-${new Date().toISOString().split('T')[0]}.csv`)} disabled={isLoading || isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export All
                </Button>
            </div>
        </div>

        <Tabs defaultValue="all">
          <div className="flex items-center justify-between">
             <TabsList>
                <TabsTrigger value="all" className="flex items-center gap-2">
                    All Transactions
                    <Badge variant="secondary" className="rounded-full">{allPayments.length}</Badge>
                </TabsTrigger>
                 <TabsTrigger value="active" className="flex items-center gap-2">
                    Active Check-ins
                    <Badge variant="secondary" className="rounded-full">{activeCheckinPayments.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="refunds" className="flex items-center gap-2">
                    Refunds
                     <Badge variant="secondary" className="rounded-full">{refundedPayments.length}</Badge>
                </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all">
            <PaymentList
              payments={allPayments}
              isLoading={isLoading}
              currency={userCurrency}
              onViewDetails={handleViewDetails}
              onReprintReceipt={handleReprintReceipt}
              onRefund={handleRefund}
            />
          </TabsContent>

           <TabsContent value="active">
            <PaymentList
              payments={activeCheckinPayments}
              isLoading={isLoading}
              currency={userCurrency}
              onViewDetails={handleViewDetails}
              onReprintReceipt={handleReprintReceipt}
              onRefund={handleRefund}
            />
          </TabsContent>

          <TabsContent value="refunds">
            <PaymentList
              payments={refundedPayments}
              isLoading={isLoading}
              currency={userCurrency}
              onViewDetails={handleViewDetails}
              onReprintReceipt={handleReprintReceipt}
              onRefund={handleRefund}
            />
          </TabsContent>
        </Tabs>
      </div>

      {selectedPayment && (
        <>
          <ViewPaymentDialog
            payment={selectedPayment}
            isOpen={isViewOpen}
            onClose={closeDialogs}
            currency={userCurrency}
          />
          <ReprintReceiptDialog
            payment={selectedPayment}
            isOpen={isReceiptOpen}
            onClose={closeDialogs}
            settings={settings}
          />
          <RefundDialog
            payment={selectedPayment}
            isOpen={isRefundOpen}
            onClose={closeDialogs}
            onSuccess={handleDataMutation}
          />
        </>
      )}
    </>
  );
}

export default withAuth(PaymentsPage, PagePermission.VIEW_PAYMENTS_PAGE);
