
'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  Timestamp,
  orderBy,
  getDocs,
  collectionGroup,
} from 'firebase/firestore';
import {
  Download,
  Printer,
  Loader2,
  BookUser,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Undo2,
  ImageIcon,
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';

import type { Payment, Booking, Room, Bill, StockReturn, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { exportToCsv } from '@/lib/csv-export';
import { GuestFolioTable } from '@/components/guest-folio/guest-folio-table';
import { getSafeDate, getCheckoutDateTime } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { StatCard } from '@/components/ui/stat-card';
import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Logo } from '@/components/logo';
import { GuestFolioReport } from '@/components/guest-folio/guest-folio-report';

const PAGE_SIZE = 15;

export interface ProcessedFolioData {
  id: string;
  guestName: string;
  phoneNumber: string;
  roomNumber: string;
  roomType: string;
  checkInDate: any;
  checkedOutByName?: string | null;
  checkOutDate: any;
  checkedInByName?: string | null;
  roomFee: number;
  guestBill: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    createdByName?: string;
    billId?: string;
  }[];
  guestBillTotal: number;
  totalBill: number;
  totalPaid: number;
  balanceDue: number;
  status: string;
  payments: { amount: number; staffName: string | null, paymentMethod: string, type?: 'Booking' | 'Additional Charges' | 'Credit Repayment' | 'POS' | 'Service' | 'Gym Membership' }[];
  returns: StockReturn[];
  totalReturns: number;
}

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" onClick={onNext} disabled={!canNext}>
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}


function GuestFolioPage() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [filters, setFilters] = React.useState({
    includeRoomFee: false, // Default to OFF
    guestBills: false,
    activeCheckin: false,
    checkedOutOnly: false,
  });

  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const userCurrency = settings?.currency || 'USD';
  const printRef = React.useRef<HTMLDivElement>(null);

  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [allBookings, setAllBookings] = React.useState<Booking[]>([]);
  const [allBills, setAllBills] = React.useState<Bill[]>([]);
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [allReturns, setAllReturns] = React.useState<StockReturn[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!firestore) return;
      setIsLoading(true);
      try {
        const [
          roomsSnap,
          bookingsSnap,
          billsSnap,
          paymentsSnap,
          returnsSnap,
          usersSnap,
        ] = await Promise.all([
          getDocs(query(collection(firestore, 'rooms'))),
          getDocs(query(collection(firestore, 'bookings'), orderBy('createdAt', 'desc'))),
          getDocs(query(collectionGroup(firestore, 'bills'))),
          getDocs(query(collection(firestore, 'payments'))),
          getDocs(query(collectionGroup(firestore, 'stockReturns'))),
          getDocs(query(collection(firestore, 'users'))),
        ]);

        setRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
        setAllBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
        setAllBills(billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
        setAllPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        setAllReturns(returnsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockReturn)));
        setAllUsers(usersSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() } as UserProfile)));
      } catch (error) {
        console.error("Error fetching folio data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch report data."
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [firestore, toast]);

  const userMap = React.useMemo(() => {
    return new Map(allUsers.map(u => [u.uid, u.name]));
  }, [allUsers]);

  const roomsMap = React.useMemo(() => {
    return new Map(rooms.map(r => [r.id, r]));
  }, [rooms]);

  const processedData = React.useMemo(() => {
    if (isLoading || allBookings.length === 0) return [];

    let filteredBookings = allBookings;

    // Date range filter
    if (dateRange?.from) {
      const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
      filteredBookings = filteredBookings.filter(b => {
        const createdAt = getSafeDate(b.createdAt);
        return createdAt && isWithinInterval(createdAt, interval);
      });
    }

    // Toggle filters
    if (filters.activeCheckin) {
      filteredBookings = filteredBookings.filter(b => b.status === 'Active' || b.status === 'Checked-in');
    }
    if (filters.checkedOutOnly) {
      filteredBookings = filteredBookings.filter(b => b.status === 'Checked-out');
    }
    if (filters.guestBills) {
        const bookingIdsWithBills = new Set((allBills || []).map(b => (b as any).bookingId));
        filteredBookings = filteredBookings.filter(b => bookingIdsWithBills.has(b.id));
    }


    return filteredBookings.map(booking => {
        const roomType = roomsMap.get(booking.roomId)?.name || 'N/A';
        const bookingBills = allBills?.filter(b => (b as any).bookingId === booking.id) || [];

        const guestBillItems = bookingBills.flatMap(bill =>
            bill.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                total: item.price * item.quantity,
                createdByName: bill.createdByName,
                billId: bill.id,
            }))
        );

        const guestBillTotal = guestBillItems.reduce((acc, item) => acc + item.total, 0);
        const bookingRoomFee = booking.totalAmount || 0;

        const bookingReturns = allReturns?.filter(r => (r as any).bookingId === booking.id) || [];
        const totalReturns = bookingReturns.reduce((acc, item) => acc + item.totalRefundAmount, 0);

        const totalCharges = (filters.includeRoomFee ? bookingRoomFee : 0) + guestBillTotal;
        const totalBill = totalCharges - totalReturns;

        const associatedPayments = allPayments?.filter(p => p.bookingId === booking.id) || [];

        let totalPaid = 0;
        const isCheckedIn = booking.status === 'Active' || booking.status === 'Checked-in';

        // Add initial booking payment if it was made
        const bookingPayment = associatedPayments.find(p => p.type === 'Booking');
        if (bookingPayment && filters.includeRoomFee) {
            totalPaid += bookingPayment.amount;
        } else if (isCheckedIn && filters.includeRoomFee) {
            // If checked-in and we are including room fee, consider it paid even if no explicit payment record exists (e.g. for walk-ins)
            totalPaid += bookingRoomFee;
        }

        // Add payments for additional charges
        const otherPaymentsTotal = associatedPayments.filter(p => p.type !== 'Booking').reduce((acc, p) => acc + p.amount, 0);
        totalPaid += otherPaymentsTotal;

        // Build payments array - include implicit room charge payment for checked-in guests
        let allPaymentsList = associatedPayments.map(p => ({
            amount: p.amount,
            staffName: getPaymentStaffName(p),
            paymentMethod: p.paymentMethod,
            type: p.type,
        }));

        // Add room charge payment for checked-in guests without explicit booking payment
        if (isCheckedIn && filters.includeRoomFee && !bookingPayment) {
            allPaymentsList.push({
                amount: bookingRoomFee,
                staffName: booking.createdByName || 'System',
                paymentMethod: booking.paymentMethod || 'N/A',
                type: 'Booking' as const,
            });
        }

        const balanceDue = totalBill - totalPaid;

        const getPaymentStaffName = (payment: Payment) => {
            if (payment.type === 'Booking') {
                return booking.createdByName || 'System';
            }
            const bill = allBills?.find(b => b.paymentId === payment.id);
            return bill?.createdByName || userMap.get(payment.createdByUid || '') || 'System';
        }

        return {
            id: booking.id,
            guestName: booking.guestName,
            phoneNumber: booking.guestPhoneNumber || 'N/A',
            roomNumber: booking.roomNumber || 'N/A',
            roomType: roomType,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            checkedInByName: booking.checkedInByName,
            checkedOutByName: booking.checkedOutByName,
            roomFee: bookingRoomFee,
            guestBill: guestBillItems,
            guestBillTotal: guestBillTotal,
            totalBill: totalBill,
            totalPaid: totalPaid,
            balanceDue: balanceDue,
            status: booking.status,
            payments: allPaymentsList,
            returns: bookingReturns,
            totalReturns,
        };
    });
  }, [isLoading, allBookings, allBills, allPayments, allReturns, roomsMap, dateRange, filters, userMap]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return processedData.slice(startIndex, startIndex + PAGE_SIZE);
  }, [processedData, currentPage]);

  const { reportSummary, totalIncome, totalBalanceDue } = React.useMemo(() => {
    const totalReports = processedData.length;
    const totalRoomFee = processedData.reduce((acc, item) => acc + item.roomFee, 0);
    const totalGuestBill = processedData.reduce((acc, item) => acc + item.guestBillTotal, 0);
    const totalReturns = processedData.reduce((acc, item) => acc + item.totalReturns, 0);

    // Recalculate totals based on the full processed data
    const income = processedData.reduce((acc, item) => acc + item.totalPaid, 0);
    const grandTotal = processedData.reduce((acc, item) => acc + item.totalBill, 0);
    const balanceDue = grandTotal - income;


    return {
        reportSummary: { totalReports, totalRoomFee, totalGuestBill, grandTotal, totalReturns },
        totalIncome: income,
        totalBalanceDue: balanceDue,
    };
  }, [processedData]);

  const totalPages = Math.ceil(processedData.length / PAGE_SIZE);

  const handleFilterChange = (filterName: keyof typeof filters, value: boolean) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (content) {
      setIsPrinting(true);
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Guest Folio Report</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body class="p-8 bg-white text-black">');
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
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not find the report content to download.',
        });
        return;
    }

    setIsExporting(true);
    toast({
        title: 'Generating Image',
        description: 'Your report is being converted to an image. This may take a moment for large reports.',
    });

    try {
        const dataUrl = await htmlToImage.toPng(reportNode, {
            quality: 1.0,
            pixelRatio: 2,
            width: reportNode.scrollWidth,
            height: reportNode.scrollHeight,
        });

        const link = document.createElement('a');
        const today = new Date().toISOString().split('T')[0];
        link.download = `Guest_Folio_Report_${today}.png`;
        link.href = dataUrl;
        link.click();

        toast({
            variant: 'success',
            title: 'Image Downloaded',
            description: 'Your report has been downloaded as a PNG file.',
        });
    } catch (error) {
        console.error("Image generation failed:", error);
        toast({
            variant: 'destructive',
            title: 'Image Generation Failed',
            description: (error as Error).message || 'Could not generate image.',
        });
    } finally {
        setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (!processedData || processedData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There is no data to export for the current filters.',
      });
      return;
    }
    setIsExporting(true);
    toast({
      title: 'Exporting Data',
      description: 'Your report is being prepared for download.',
    });

    try {
      const dataToExport = processedData.map(p => ({
        'Guest Name': p.guestName,
        'Phone Number': p.phoneNumber,
        'Room Number': p.roomNumber,
        'Room Type': p.roomType,
        'Check-in': getSafeDate(p.checkInDate) ? format(getSafeDate(p.checkInDate)!, 'PPpp') : 'N/A',
        'Check-out': getSafeDate(p.checkOutDate) ? format(getSafeDate(p.checkOutDate)!, 'PPpp') : 'N/A',
        'Total Bill': p.totalBill,
        'Total Paid': p.totalPaid,
        'Balance Due': p.balanceDue,
        'Status': p.status,
      }));

      const today = new Date().toISOString().split('T')[0];
      exportToCsv(dataToExport, `guest-folio-report-${today}.csv`);
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

  const isDataReady = !isLoading;
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);

  if (isLoading) {
    return (
       <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
                <BookUser className="h-10 w-10 text-primary" />
                <div>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="mt-2 h-4 w-80" />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-5" /></CardHeader><CardContent><Skeleton className="h-7 w-24 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-5" /></CardHeader><CardContent><Skeleton className="h-7 w-24 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-5" /></CardHeader><CardContent><Skeleton className="h-7 w-24 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
        </div>
        <Card><CardHeader className="border-b"><Skeleton className="h-10 w-full" /></CardHeader><CardContent className="p-0"><div className="p-6"><Skeleton className="h-96 w-full" /></div></CardContent><CardFooter className="flex-col items-stretch gap-4 p-4 border-t"><Skeleton className="h-24 w-full" /><div className="flex items-center justify-end"><Skeleton className="h-9 w-40" /></div></CardFooter></Card>
    </div>
    )
  }

  return (
    <>
      <div
        className="hidden"
      >
        <div ref={printRef} id="guest-folio-print">
          <GuestFolioReport
            data={processedData}
            summary={{...reportSummary}}
            totalBalanceDue={totalBalanceDue}
            settings={settings}
            dateRange={dateRange}
            userProfile={userProfile}
          />
        </div>
      </div>

      <style>{`
        @media print { @page { margin: 0mm !important; }
            body * {
                visibility: hidden !important;
            }
            #guest-folio-print, #guest-folio-print * {
                visibility: visible !important;
            }
            #guest-folio-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background-color: white !important;
                z-index: 9999 !important;
            }
        }
      `}</style>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <BookUser className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Guest Folio &amp; Reports
              </h1>
              <p className="text-muted-foreground">
                A comprehensive financial overview of all guest accounts.
              </p>
            </div>
          </div>
           <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} disabled={isLoading || isPrinting}>
              {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print PDF
            </Button>
            <Button onClick={handleDownloadImage} disabled={isLoading || isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
              Download Image
            </Button>
            <Button onClick={handleExport} disabled={isLoading || isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export to Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
                title="Total Income"
                value={formatCurrency(totalIncome)}
                icon={DollarSign}
                description="Total payments received for the filtered bookings."
                className="border-green-500 text-green-500"
            />
            <StatCard
                title="Total Outstanding Balance Due"
                value={formatCurrency(totalBalanceDue)}
                icon={DollarSign}
                description="The total balance due across all filtered bookings."
                className={totalBalanceDue > 0 ? 'border-destructive text-destructive' : 'border-green-500 text-green-500'}
            />
            <StatCard
                title="Total Returned/Voided"
                value={formatCurrency(reportSummary.totalReturns)}
                icon={Undo2}
                description="Total value of all returned items from bills."
                className="bg-accent text-accent-foreground"
                iconClassName="text-accent-foreground"
            />
        </div>

        <Card className="print:border-0 print:shadow-none">
            <CardHeader className="border-b print:hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                         <div className="flex items-center space-x-2">
                            <Switch id="include-room-fee" checked={filters.includeRoomFee} onCheckedChange={(val) => handleFilterChange('includeRoomFee', val)} />
                            <Label htmlFor="include-room-fee">Include Room Fee in Totals</Label>
                        </div>
                        <Separator orientation="vertical" className="h-6 hidden lg:block" />
                        <div className="flex items-center space-x-2">
                            <Switch id="active-checkin" checked={filters.activeCheckin} onCheckedChange={(val) => handleFilterChange('activeCheckin', val)} />
                            <Label htmlFor="active-checkin">Active Check-ins</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Switch id="checked-out" checked={filters.checkedOutOnly} onCheckedChange={(val) => handleFilterChange('checkedOutOnly', val)} />
                            <Label htmlFor="checked-out">Checked-out Only</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="guest-bills" checked={filters.guestBills} onCheckedChange={(val) => handleFilterChange('guestBills', val)} />
                            <Label htmlFor="guest-bills">With Guest Bills</Label>
                        </div>
                    </div>
                </div>
            </CardHeader>

                <CardContent className="p-0">
                    <GuestFolioTable data={paginatedData} isLoading={!isDataReady} />
                </CardContent>

             {isDataReady && processedData.length > 0 && (
              <CardFooter className="flex-col items-stretch gap-4 p-4 border-t print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                    <div className="space-y-1 rounded-md border p-3">
                        <p className="text-muted-foreground">Total Reports</p>
                        <p className="font-bold text-lg">{reportSummary.totalReports}</p>
                    </div>
                     <div className="space-y-1 rounded-md border p-3">
                        <p className="text-muted-foreground">Total Room Fee</p>
                        <p className="font-bold text-lg">{formatCurrency(reportSummary.totalRoomFee)}</p>
                    </div>
                     <div className="space-y-1 rounded-md border p-3">
                        <p className="text-muted-foreground">Total Guest Bills</p>
                        <p className="font-bold text-lg">{formatCurrency(reportSummary.totalGuestBill)}</p>
                    </div>
                    <div className="space-y-1 rounded-md border p-3">
                        <p className="text-muted-foreground">Total Returned</p>
                        <p className="font-bold text-lg text-yellow-600">{formatCurrency(reportSummary.totalReturns)}</p>
                    </div>
                    <div className="space-y-1 rounded-md border bg-primary/10 text-primary p-3">
                        <p>Grand Total</p>
                        <p className="font-bold text-lg">{formatCurrency(reportSummary.grandTotal)}</p>
                    </div>
                     <div className="space-y-1 rounded-md border p-3">
                        <p className="text-muted-foreground">Outstanding Balance</p>
                        <p className="font-bold text-lg text-destructive">{formatCurrency(totalBalanceDue)}</p>
                    </div>
                </div>

                <div className="flex items-center justify-end">
                    <PaginationControls
                        canPrev={currentPage > 1}
                        canNext={currentPage < totalPages}
                        onPrev={() => setCurrentPage(p => p - 1)}
                        onNext={() => setCurrentPage(p => p + 1)}
                    />
                </div>
              </CardFooter>
            )}
        </Card>
      </div>
    </>
  );
}

export default withAuth(GuestFolioPage, PagePermission.VIEW_GUEST_FOLIO);



