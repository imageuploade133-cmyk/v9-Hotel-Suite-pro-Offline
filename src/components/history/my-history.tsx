
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
import { BillReceiptDialog } from './bill-receipt-dialog';


const PAGE_SIZE = 15;

type HistoryTabType = 'checkins' | 'checkouts' | 'reservations' | 'cancellations' | 'logins';

const TAB_CONFIG: Record<HistoryTabType, { statuses?: string[], userField: string, dateField: string, collection: 'bookings' | 'globalAuditLog', changeType?: string }> = {
    checkins: { statuses: ['Active', 'Checked-in', 'Checked-out'], userField: 'createdByUid', dateField: 'checkInDate', collection: 'bookings' },
    checkouts: { statuses: ['Checked-out'], userField: 'checkedOutByUid', dateField: 'actualCheckOutDate', collection: 'bookings' },
    reservations: { statuses: ['Booked', 'Reserved', 'Checked-in', 'Checked-out', 'Cancelled'], userField: 'createdByUid', dateField: 'createdAt', collection: 'bookings' },
    cancellations: { statuses: ['Cancelled', 'Refunded'], userField: 'cancelledByUid', dateField: 'cancelledAt', collection: 'bookings' },
    logins: { userField: 'userId', dateField: 'timestamp', collection: 'globalAuditLog', changeType: 'Login' },
};


interface MyHistoryProps {
  onViewDetails: (booking: Booking) => void;
  reloadCounter?: number;
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


export function MyHistory({ onViewDetails, reloadCounter }: MyHistoryProps) {
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false);
  const [isCancellationInvoiceOpen, setIsCancellationInvoiceOpen] = React.useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = React.useState(false);


  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [activeTab, setActiveTab] = React.useState<HistoryTabType>('checkins');
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);

  const [history, setHistory] = React.useState<(Booking | StockAuditLog)[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [allStaff, setAllStaff] = React.useState<UserProfile[]>([]);

  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();

  React.useEffect(() => {
    if (!firestore) return;
    const fetchStaff = async () => {
      const usersQuery = query(collection(firestore, 'users'), orderBy('name'));
      const adProfilesQuery = query(collection(firestore, 'AD Profile'));
      const [usersSnapshot, adProfilesSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(adProfilesQuery)]);
      const adProfilesMap = new Map(adProfilesSnapshot.docs.map(doc => [doc.id, doc.data()]));
      const combinedUsers = usersSnapshot.docs.map(doc => {
          const baseProfile = { id: doc.id, ...doc.data() } as UserProfile;
          const adProfile = adProfilesMap.get(doc.id) || {};
          return { ...baseProfile, ...adProfile };
      });
      setAllStaff(combinedUsers);
    };
    fetchStaff();
  }, [firestore]);

  const userMap = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    allStaff.forEach(user => map.set(user.uid, user));
    return map;
  }, [allStaff]);


  const fetchHistory = React.useCallback(async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!firestore || !user?.uid) return;

    setIsLoading(true);

    const config = TAB_CONFIG[activeTab];
    let statuses = config.statuses;

    if (activeTab === 'checkins' && showOnlyActive) {
        statuses = ['Active', 'Checked-in'];
    }
    if (activeTab === 'reservations' && showOnlyActive) {
        statuses = ['Booked', 'Reserved'];
    }

    let constraints: QueryConstraint[] = [];

    constraints.push(where(config.userField, '==', user.uid));
    if (statuses) constraints.push(where('status', 'in', statuses));
    if (config.changeType) constraints.push(where('changeType', '==', config.changeType));

    if (dateRange?.from) constraints.push(where(config.dateField, '>=', Timestamp.fromDate(dateRange.from)));
    if (dateRange?.to) constraints.push(where(config.dateField, '<=', Timestamp.fromDate(dateRange.to)));

    constraints.push(orderBy(config.dateField, 'desc'));

    const baseQuery = query(collection(firestore, config.collection), ...constraints);

    let paginatedQuery;
    const isInitialOrReload = direction === 'initial';

    if (direction === 'next' && lastVisible) {
      paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      paginatedQuery = query(baseQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
      paginatedQuery = query(baseQuery, limit(PAGE_SIZE));
    }

    try {
      const snapshot = await getDocs(paginatedQuery);

      const getSafeDateInternal = (d: any): Date | null => {
        if (!d) return null;
        return (d as Timestamp)?.toDate ? (d as Timestamp).toDate() : new Date(d);
      };

      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            if (config.collection === 'bookings') {
                return {
                    id: doc.id,
                    ...docData,
                    checkInDate: getSafeDateInternal(docData.checkInDate)!,
                    checkOutDate: getSafeDateInternal(docData.checkOutDate)!,
                    actualCheckOutDate: getSafeDateInternal(docData.actualCheckOutDate),
                    createdAt: getSafeDateInternal(docData.createdAt),
                    cancelledAt: getSafeDateInternal(docData.cancelledAt),
                } as Booking;
            }
            return { id: doc.id, ...docData } as StockAuditLog;
        });
        setHistory(data);

        const newFirst = snapshot.docs[0];
        const newLast = snapshot.docs[snapshot.docs.length - 1];
        setFirstVisible(newFirst);
        setLastVisible(newLast);

        // Check for next page
        const nextQuery = query(baseQuery, startAfter(newLast), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        setHasMore(!nextSnapshot.empty);

        if (direction === 'next') setPage(p => p + 1);
        if (direction === 'prev' && page > 1) setPage(p => p - 1);
        if (isInitialOrReload) setPage(1);

      } else {
        if (isInitialOrReload) setHistory([]);
        setHasMore(false);
        if (direction === 'prev' && page > 1) fetchHistory('initial');
      }
    } catch (error) {
      console.error("Error fetching my history: ", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch your history records.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, user?.uid, activeTab, dateRange, lastVisible, firstVisible, toast, showOnlyActive]);

  React.useEffect(() => {
    fetchHistory('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateRange, reloadCounter, showOnlyActive]);

  const handleNextPage = () => { if (!hasMore) return; fetchHistory('next'); };
  const handlePrevPage = () => { if (page <= 1) return; fetchHistory('prev'); };
  const handleReprintReceipt = (booking: Booking) => { setSelectedBooking(booking); setIsReceiptOpen(true); };
  const handleReprintCancellation = (booking: Booking) => { setSelectedBooking(booking); setIsCancellationInvoiceOpen(true); };

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
          if (activeTab === 'logins') {
            const log = p as StockAuditLog;
            return { 'Login Time': getSafeDate(log.timestamp)?.toISOString(), 'User': log.userName };
          }
          const booking = p as Booking;
          return {
            'Booking ID': booking.id,
            'Guest Name': booking.guestName,
            'Room': booking.roomNumber,
            'Check-in': booking.checkInDate?.toString(),
            'Scheduled-out': booking.checkOutDate?.toString(),
            'Status': booking.status,
          };
        });

      const today = new Date().toISOString().split('T')[0];
      exportToCsv(dataToExport, `my-${activeTab}-history-${today}.csv`);
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

  const loginColumns = useWorkingHrsColumns({ settings, userMap });
  const isDataLoading = isLoading;

  return (
    <>
        <Card className="print:border-0 print:shadow-none">
            <CardHeader className="border-b print:hidden">
                 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HistoryTabType)}>
                    <TabsList>
                        <TabsTrigger value="checkins">My Check-ins</TabsTrigger>
                        <TabsTrigger value="checkouts">My Checkouts</TabsTrigger>
                        <TabsTrigger value="reservations">My Reservations</TabsTrigger>
                        <TabsTrigger value="cancellations">My Cancellations</TabsTrigger>
                        <TabsTrigger value="logins">My Logins</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        {(activeTab === 'checkins' || activeTab === 'reservations') && (
                            <div className="flex items-center space-x-2">
                                <Switch id="my-active-only" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
                                <Label htmlFor="my-active-only">Show Active Only</Label>
                            </div>
                        )}
                         <Button variant="outline" onClick={() => setIsAiChatOpen(true)}>
                            <Bot className="mr-2 h-4 w-4" /> Ask AI
                        </Button>
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
                        <h1 className="text-2xl font-bold capitalize">My {activeTab} Report</h1>
                        <p className="text-muted-foreground">Generated by: {user?.displayName}</p>
                        <p className="text-muted-foreground">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                    {activeTab === 'logins' ? (
                       <DataTable
                          columns={loginColumns}
                          data={history as StockAuditLog[]}
                          filterColumn="userName"
                          filterPlaceholder="Search..."
                          isPaginated={false}
                          className="border-0"
                          tableId="my-logins-history"
                          emptyStateIcon={History}
                          emptyStateTitle="No Login Records"
                          emptyStateDescription="Your login history for the selected period will appear here."
                       />
                    ) : (
                      <HistoryList
                          history={history as Booking[]}
                          isLoading={isDataLoading || !userProfile}
                          isPrintView={isPrinting}
                          onViewDetails={onViewDetails}
                          onReprintReceipt={handleReprintReceipt}
                          onReprintCancellation={handleReprintCancellation}
                          activeTab={activeTab as 'checkouts' | 'checkins' | 'reservations' | 'cancellations'}
                          userMap={userMap}
                          onReprintBill={() => {}}
                      />
                    )}
                </div>
                 {!isLoading && history.length > 0 && (
                    <div className="mt-auto flex items-center justify-end px-4 py-4 border-t">
                        <PaginationControls
                        canPrev={page > 1}
                        canNext={hasMore}
                        onPrev={handlePrevPage}
                        onNext={handleNextPage}
                        />
                    </div>
                )}
            </CardContent>
        </Card>

      {selectedBooking && (
        <>
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
       <AiChat
        open={isAiChatOpen}
        onOpenChange={setIsAiChatOpen}
        title="Audit Log AI"
        description="Ask questions about staff activity. For example: 'What did John Doe do yesterday?' or 'Show me all deleted items this week.'"
      />
    </>
  );
}
