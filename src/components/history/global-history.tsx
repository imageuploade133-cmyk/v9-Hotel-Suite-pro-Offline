
'use client';

import React from 'react';
import { Download, Printer, Loader2, User, ChevronLeft, ChevronRight, History, ConciergeBell, Bot } from 'lucide-react';
import type { Payment, Booking, UserProfile, StockAuditLog, Bill } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, query, Timestamp, where, orderBy, getDocs, limit, startAfter, endBefore, limitToLast, QueryDocumentSnapshot, DocumentData, QueryConstraint, collectionGroup, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { DateRangePicker } from '../ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader } from '../ui/card';
import { exportToCsv } from '@/lib/csv-export';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { HistoryList } from './history-list';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { CancellationInvoiceDialog } from '../bookings/cancellation-invoice-dialog';
import { getSafeDate } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import { useWorkingHrsColumns } from '@/components/staff-working-hrs/columns';
import { DataTable } from '../ui/data-table';
import { EmptyState } from '../ui/empty-state';
import { AiChat } from '@/components/ai/ai-chat';
import { searchAuditLog } from '@/ai/flows/search-audit-log';
import { BillReceiptDialog } from './bill-receipt-dialog';


const PAGE_SIZE = 15;

type BookingStatusType = 'checkins' | 'checkouts' | 'reservations' | 'cancellations' | 'bills';

const TAB_CONFIG: Record<BookingStatusType, { statuses?: string[], userField?: string, dateField: string, collection: 'bookings' | 'bills' | 'globalAuditLog', changeType?: string }> = {
    checkins: { statuses: ['Active', 'Checked-in', 'Checked-out'], userField: 'createdByUid', dateField: 'checkInDate', collection: 'bookings' },
    checkouts: { statuses: ['Checked-out'], userField: 'checkedOutByUid', dateField: 'actualCheckOutDate', collection: 'bookings' },
    reservations: { statuses: ['Booked', 'Reserved', 'Checked-in', 'Checked-out', 'Cancelled'], userField: 'createdByUid', dateField: 'createdAt', collection: 'bookings' },
    cancellations: { statuses: ['Cancelled', 'Refunded'], userField: 'cancelledByUid', dateField: 'cancelledAt', collection: 'bookings' },
    bills: { dateField: 'createdAt', collection: 'bills', userField: 'createdBy' },
};


interface GlobalHistoryProps {
  onReassign: (booking: Booking) => void;
  reloadCounter: number;
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
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}


export function GlobalHistory({ onReassign, reloadCounter }: GlobalHistoryProps) {
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false);
  const [isCancellationInvoiceOpen, setIsCancellationInvoiceOpen] = React.useState(false);
  const [billToPrint, setBillToPrint] = React.useState<Bill | null>(null);

  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('all');
  const [activeTab, setActiveTab] = React.useState<BookingStatusType>('checkins');
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);

  const [history, setHistory] = React.useState<(Booking | Bill)[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [paginatedHistory, setPaginatedHistory] = React.useState<(Booking | Bill)[]>([]);

  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();

  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('name'));
  }, [firestore]);
  const { data: staffMembers, isLoading: areStaffLoading } = useCollection<UserProfile>(usersQuery);

  const userMap = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    if (staffMembers) {
        staffMembers.forEach(user => map.set(user.uid, user));
    }
    return map;
  }, [staffMembers]);


  const baseQuery = React.useMemo(() => {
    if (!firestore) return null;

    const config = TAB_CONFIG[activeTab];
    let constraints: QueryConstraint[] = [];

    // Date filtering
    if (dateRange?.from) constraints.push(where(config.dateField, '>=', Timestamp.fromDate(dateRange.from)));
    if (dateRange?.to) constraints.push(where(config.dateField, '<=', Timestamp.fromDate(dateRange.to)));

    // Staff filtering
    if (selectedStaffId !== 'all' && config.userField) {
        constraints.push(where(config.userField, '==', selectedStaffId));
    }

    // Status/Type filtering
    if (config.statuses) {
        let statuses = config.statuses;
        if (activeTab === 'checkins' && showOnlyActive) statuses = ['Active', 'Checked-in'];
        if (activeTab === 'reservations' && showOnlyActive) statuses = ['Booked', 'Reserved'];
        constraints.push(where('status', 'in', statuses));
    }

    // Ordering
    constraints.push(orderBy(config.dateField, 'desc'));

    const collectionRef = config.collection === 'bills'
        ? collectionGroup(firestore, 'bills')
        : collection(firestore, config.collection);

    return query(collectionRef, ...constraints);
  }, [firestore, activeTab, dateRange, selectedStaffId, showOnlyActive]);


  React.useEffect(() => {
    if (!baseQuery) return;

    setIsLoading(true);

    const unsubscribe = onSnapshot(baseQuery, async (snapshot) => {
      let data: (Booking | Bill)[];

      if (activeTab === 'bills') {
        const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
        const bookingIds = Array.from(new Set(bills.map(b => (b as any).bookingId).filter(Boolean)));

        if (bookingIds.length > 0) {
          const bookingsMap = new Map<string, Booking>();
          const bookingsQuery = query(collection(firestore!, 'bookings'), where('__name__', 'in', bookingIds));
          const bookingsSnapshot = await getDocs(bookingsQuery);
          bookingsSnapshot.forEach(doc => bookingsMap.set(doc.id, { id: doc.id, ...doc.data() } as Booking));

          data = bills.map(bill => ({
            ...bill,
            booking: bookingsMap.get((bill as any).bookingId),
          }));
        } else {
          data = bills;
        }
      } else {
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      }

      setHistory(data);
      setIsLoading(false);
      setCurrentPage(1); // Reset to first page on new data
    }, (error) => {
      console.error("Error fetching history:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch history records.' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [baseQuery, activeTab, firestore, toast]);

  React.useEffect(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    setPaginatedHistory(history.slice(start, end));
  }, [history, currentPage]);

  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const canNextPage = currentPage < totalPages;
  const canPrevPage = currentPage > 1;

  const handleNextPage = () => { if (canNextPage) setCurrentPage(p => p + 1); };
  const handlePrevPage = () => { if (canPrevPage) setCurrentPage(p => p - 1); };

  const handleReassignAndClose = (booking: Booking) => { setIsDetailsOpen(false); onReassign(booking); };

  const handlePrint = () => {
    setIsPrinting(true);
    // Wait for React to render, then for browser to paint, then for images to load
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Check if any images are still loading
        const images = document.querySelectorAll('.printable-area img, [data-print-content] img');
        const loadingImages = Array.from(images).filter((img) => !(img as HTMLImageElement).complete);

        if (loadingImages.length === 0) {
          // All images loaded, safe to print
          window.print();
          setIsPrinting(false);
        } else {
          // Wait for images to load
          let loadedCount = 0;
          const onImageLoad = () => {
            loadedCount++;
            if (loadedCount >= loadingImages.length) {
              window.print();
              setIsPrinting(false);
            }
          };

          loadingImages.forEach((img) => {
            if ((img as HTMLImageElement).complete) {
              onImageLoad();
            } else {
              img.addEventListener('load', onImageLoad, { once: true });
              img.addEventListener('error', onImageLoad, { once: true });
            }
          });

          // Fallback: print anyway after 2 seconds even if images haven't loaded
          setTimeout(() => {
            setIsPrinting(false);
            window.print();
          }, 2000);
        }
      });
    });
  };

  const handleExport = () => {
    if (!history || history.length === 0) {
      toast({ variant: 'destructive', title: 'No Data to Export' });
      return;
    }
    setIsExporting(true);
    toast({ title: 'Exporting Data', description: `Your ${activeTab} history is being prepared for download.` });

    try {
        const dataToExport = history.map(p => {
          const booking = p as Booking;
          return {
            'Booking ID': booking.id,
            'Guest Name': booking.guestName,
            'Guest Email': booking.guestEmail,
            'Room Number': booking.roomNumber,
            'Check-in Date': getSafeDate(booking.checkInDate)?.toISOString(),
            'Check-out Date': getSafeDate(booking.checkOutDate)?.toISOString(),
            'Actual Check-out Date': getSafeDate(booking.actualCheckOutDate)?.toISOString() || '',
            'Amount': booking.totalAmount,
            'Payment Method': booking.paymentMethod,
            'Created By': booking.createdByName || 'N/A',
            'Checked Out By': booking.checkedOutByName || 'N/A',
            'Cancelled By': booking.cancelledByName || 'N/A',
            'Status': booking.status,
          }
        });

      const today = new Date().toISOString().split('T')[0];
      exportToCsv(dataToExport, `${activeTab}-history-${today}.csv`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const paymentForReceipt: Payment | null = React.useMemo(() => {
    if (!selectedBooking) return null;
    return {
      id: selectedBooking.id,
      guestName: selectedBooking.guestName,
      guestEmail: selectedBooking.guestEmail,
      guestPhotoURL: selectedBooking.guestPhotoURL,
      roomNumber: selectedBooking.roomNumber!,
      amount: selectedBooking.totalAmount || 0,
      paymentMethod: selectedBooking.paymentMethod || 'On-site',
      status: 'Active',
      transactionDate: getSafeDate(selectedBooking.checkInDate)!,
      bookingDetails: selectedBooking,
      createdByUid: selectedBooking.createdByUid!,
      createdByName: selectedBooking.createdByName,
    };
  }, [selectedBooking]);

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
  };

  const handleReprintReceipt = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsReceiptOpen(true);
  };

  const handleReprintCancellation = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsCancellationInvoiceOpen(true);
  };

  const isDataLoading = isLoading || areStaffLoading;

  return (
    <>
        <Card className="print:border-0 print:shadow-none">
            <CardHeader className="border-b print:hidden">
                 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BookingStatusType)}>
                    <TabsList>
                        <TabsTrigger value="checkins">Check-ins</TabsTrigger>
                        <TabsTrigger value="checkouts">Checkouts</TabsTrigger>
                        <TabsTrigger value="reservations">Reservations</TabsTrigger>
                        <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
                        <TabsTrigger value="bills">Bills</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        <Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={areStaffLoading}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <SelectValue placeholder="Filter by staff..." />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Staff</SelectItem>
                                {staffMembers?.map(staff => (
                                    <SelectItem key={staff.id} value={staff.uid}>{staff.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {(activeTab === 'checkins' || activeTab === 'reservations') && (
                            <div className="flex items-center space-x-2">
                                <Switch id="my-active-only" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
                                <Label htmlFor="my-active-only">Show Active Only</Label>
                            </div>
                        )}
                    </div>
                     <div className="flex w-full shrink-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={isLoading || isPrinting}>
                                    {isPrinting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Printer className="mr-2 h-4 w-4" />
                                    )}
                                    Print / PDF
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /><span>Print</span></DropdownMenuItem>
                                <DropdownMenuItem onClick={handlePrint}><Download className="mr-2 h-4 w-4" /><span>Download as PDF</span></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={handleExport} disabled={isLoading || isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            {isExporting ? 'Exporting...' : 'Export CSV'}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <style>{`@media print { @page { margin: 0mm !important; } body * { visibility: hidden; } #my-print-section, #my-print-section * { visibility: visible; } #my-print-section { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none; } }`}</style>
                <div id="my-print-section">
                    <div className="p-6 hidden print:block">
                        <h1 className="text-2xl font-bold capitalize">{activeTab} History Report</h1>
                        {selectedStaffId !== 'all' && <p className="text-muted-foreground">Filtered by staff: {staffMembers?.find(s => s.uid === selectedStaffId)?.name}</p>}
                    </div>
                    <HistoryList
                        history={paginatedHistory}
                        isLoading={isDataLoading || !userProfile}
                        isPrintView={isPrinting}
                        onViewDetails={handleViewDetails}
                        onReprintReceipt={handleReprintReceipt}
                        onReprintCancellation={handleReprintCancellation}
                        onReprintBill={setBillToPrint}
                        activeTab={activeTab as any}
                        userMap={userMap}
                    />
                </div>
                 {!isDataLoading && history.length > 0 && (
                    <div className="mt-auto flex items-center justify-end px-4 py-4 border-t">
                        <PaginationControls
                        canPrev={canPrevPage}
                        canNext={canNextPage}
                        onPrev={handlePrevPage}
                        onNext={handleNextPage}
                        />
                    </div>
                )}
            </CardContent>
        </Card>

      {selectedBooking && (
        <>
          <BookingDetailsDialog
            booking={selectedBooking}
            open={isDetailsOpen}
            onOpenChange={() => setIsDetailsOpen(false)}
            onReassign={handleReassignAndClose}
          />
          <ReprintReceiptDialog
            payment={paymentForReceipt}
            isOpen={isReceiptOpen}
            onClose={() => setIsReceiptOpen(false)}
          />
          <CancellationInvoiceDialog
            isOpen={isCancellationInvoiceOpen}
            onClose={() => setIsCancellationInvoiceOpen(false)}
            booking={selectedBooking}
          />
        </>
      )}

      <BillReceiptDialog
        isOpen={!!billToPrint}
        onClose={() => setBillToPrint(null)}
        bill={billToPrint}
      />
    </>
  );
}
