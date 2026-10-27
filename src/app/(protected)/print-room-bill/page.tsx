
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
  limit,
  startAfter,
  endBefore,
  limitToLast,
  type QueryConstraint,
  type DocumentData,
  type QueryDocumentSnapshot,
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
  Bed,
  ConciergeBell,
  ShoppingCart,
  Scissors,
  WashingMachine,
  Search,
  History,
  User,
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';

import type { Payment, Booking, Room, Bill, StockReturn, UserProfile, StockSale, SalonService, LaundryOrder, Order, GymMembershipPlan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { exportToCsv } from '@/lib/csv-export';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { isWithinInterval, startOfDay, endOfDay, format, subDays, startOfToday, endOfToday } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { StatCard } from '@/components/ui/stat-card';
import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Logo } from '@/components/logo';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { SalonReceiptDialog } from '@/components/salon/salon-receipt-dialog';
import { LaundryReceiptDialog } from '@/components/laundry/laundry-receipt-dialog';
import { UnpaidInvoiceDialog } from '@/components/bookings/unpaid-invoice-dialog';
import { KitchenOrderReceiptDialog } from '@/components/kitchen/kitchen-order-receipt-dialog';
import { GuestFolioDialog } from '@/components/bookings/guest-folio-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { BillReceiptDialog } from '@/components/history/bill-receipt-dialog';

const PAGE_SIZE = 15;

const sourceConfig: Record<string, { icon: React.ElementType, collection?: string }> = {
  'Room Charges': { icon: Bed, collection: 'bookings' },
  'Restaurant Bills': { icon: ConciergeBell, collection: 'orders' },
  'Other Service Bills': { icon: ConciergeBell, collection: 'bills' },
  'Point of Sale': { icon: ShoppingCart, collection: 'stockSales' },
  'Salon Services': { icon: Scissors, collection: 'salonServices' },
  'Laundry Orders': { icon: WashingMachine, collection: 'laundry' },
};

type BillableItem = (Booking | Bill | StockSale | SalonService | LaundryOrder | Order | StockReturn) & {
  type: BillSource;
  isPaid: boolean;
  payment?: Payment | null;
  booking?: Booking | null;
  date: Date;
};


type BillSource = 'All' | 'Room Charges' | 'Restaurant Bills' | 'Other Service Bills' | 'Point of Sale' | 'Salon Services' | 'Laundry Orders';


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

function InvoiceContent({
  items,
  formatCurrency,
  onPrint,
}: {
  items: BillableItem[];
  formatCurrency: (amount: number) => string;
  onPrint: (item: BillableItem) => void;
}) {
  const getCategoryIcon = (category: string) => {
    return sourceConfig[category]?.icon || ConciergeBell;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Room</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Charges</TableHead>
          <TableHead className="text-right">Payments</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24 no-print"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => {
          const itemCharge = (item as any).totalPrice || (item as any).totalAmount || (item as any).total || 0;
          const itemPayment = (item.isPaid) ? itemCharge : 0;
          const Icon = getCategoryIcon(item.type);
          const bookingStatus = (item as any).booking?.status;
          const isActiveCheckin = bookingStatus === 'Active' || bookingStatus === 'Checked-in';

          return (
            <TableRow key={`${item.id}-${index}`}>
              <TableCell>
                  <div className="flex items-center gap-2">
                      {(item as any).booking?.guestName || (item as any).customerName || 'N/A'}
                      {isActiveCheckin && <Badge variant="success">Active</Badge>}
                  </div>
              </TableCell>
              <TableCell>{(item as any).booking?.roomNumber || 'N/A'}</TableCell>
              <TableCell>{format(item.date, 'PPp')}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.type}
                </div>
              </TableCell>
              <TableCell className="font-semibold text-right">{formatCurrency(itemCharge)}</TableCell>
              <TableCell className="font-semibold text-right text-green-600">{formatCurrency(itemPayment)}</TableCell>
              <TableCell>
                {item.isPaid ? (
                  <Badge variant="success">Paid</Badge>
                ) : (
                  <Badge variant="warning">Unpaid</Badge>
                )}
              </TableCell>
              <TableCell className="text-right no-print">
                <Button size="sm" variant="outline" onClick={() => onPrint(item)}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}


function PrintRoomBillPage() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const userCurrency = settings?.currency || 'USD';
  const printRef = React.useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = React.useState(true);

  const [allBillableItems, setAllBillableItems] = React.useState<BillableItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<BillSource>('All');
  const [searchTerm, setSearchTerm] = React.useState('');

  const [itemToPrint, setItemToPrint] = React.useState<BillableItem | null>(null);
  const [saleToPrint, setSaleToPrint] = React.useState<StockSale | null>(null);
  const [salonOrderToPrint, setSalonOrderToPrint] = React.useState<SalonService | null>(null);
  const [laundryOrderToPrint, setLaundryOrderToPrint] = React.useState<LaundryOrder | null>(null);
  const [billToPrint, setBillToPrint] = React.useState<Bill | null>(null);

  const [isGuestFolioOpen, setIsGuestFolioOpen] = React.useState(false);

  const [allBills, setAllBills] = React.useState<Bill[]>([]);
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [allBookings, setAllBookings] = React.useState<Booking[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [allGymPlans, setAllGymPlans] = React.useState<GymMembershipPlan[]>([]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);

  const fetchData = React.useCallback(() => {
    if (!firestore) return;
    setIsLoading(true);

    Promise.all([
      getDocs(query(collection(firestore, 'bookings'), orderBy('createdAt', 'desc'))),
      getDocs(query(collectionGroup(firestore, 'bills'))),
      getDocs(query(collection(firestore, 'stockSales'))),
      getDocs(query(collection(firestore, 'salonServices'))),
      getDocs(query(collection(firestore, 'laundry'))),
      getDocs(query(collection(firestore, 'orders'))),
      getDocs(query(collection(firestore, 'stockReturns'))),
      getDocs(query(collection(firestore, 'payments'))),
      getDocs(query(collection(firestore, 'users'))),
      getDocs(query(collection(firestore, 'gymMembershipPlans'))),
    ]).then(([bookingsSnap, billsSnap, stockSalesSnap, salonServicesSnap, laundryOrdersSnap, kitchenOrdersSnap, returnsSnap, paymentsSnap, usersSnap, gymPlansSnap]) => {

      const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      setAllBookings(bookings);
      const bills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bill));
      setAllBills(bills);
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
      setAllPayments(payments);
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
      setAllUsers(users);
      const gymPlans = gymPlansSnap.docs.map(d => ({ id: d.id, ...d.data() } as GymMembershipPlan));
      setAllGymPlans(gymPlans);

      const bookingsMap = new Map<string, Booking>(bookings.map(b => [b.id, b]));

      let items: BillableItem[] = [];

      bookings.forEach(b => {
          if (b.totalAmount) {
              const bookingStatus = b.status;
              const isPaid = (bookingStatus === 'Active' || bookingStatus === 'Checked-in' || bookingStatus === 'Checked-out' || bookingStatus === 'Reserved');
              items.push({ ...b, type: 'Room Charges', date: getSafeDate(b.createdAt)!, isPaid, booking: b });
          }
      });
      stockSalesSnap.forEach(s => items.push({ ...s.data(), id: s.id, type: 'Point of Sale' as BillSource, isPaid: s.data().paymentStatus === 'Paid', date: getSafeDate(s.data().soldAt)!, booking: bookingsMap.get(s.data().bookingId) }));
      salonServicesSnap.forEach(s => items.push({ ...s.data(), id: s.id, type: 'Salon Services' as BillSource, isPaid: s.data().paymentStatus === 'Paid', date: getSafeDate(s.data().createdAt)!, booking: bookingsMap.get(s.data().bookingId) }));
      laundryOrdersSnap.forEach(o => {
        const bill = bills.find(b => b.items.some(i => i.id.startsWith(`laundry-${o.data().orderNumber}`)));
        items.push({ ...o.data(), id: o.id, type: 'Laundry Orders' as BillSource, isPaid: bill?.paid ?? false, date: getSafeDate(o.data().createdAt)!, booking: bookingsMap.get(o.data().bookingId) });
      });
      kitchenOrdersSnap.forEach(o => {
        const bill = bills.find(b => b.items.some(i => i.id.startsWith(`order-${o.data().orderNumber}`)));
        items.push({ ...o.data(), id: o.id, type: 'Restaurant Bills' as BillSource, isPaid: bill?.paid ?? false, date: getSafeDate(o.data().createdAt)!, booking: bookingsMap.get(o.data().bookingId) });
      });
      bills.forEach(b => {
        const isServiceCharge = !b.items.some(i => i.id.startsWith('order-') || i.id.startsWith('laundry-'));
        if (isServiceCharge) {
          items.push({ ...b, type: 'Other Service Bills', isPaid: b.paid, date: getSafeDate(b.createdAt)!, booking: bookingsMap.get((b as any).bookingId) });
        }
      });

      setAllBillableItems(items.sort((a,b) => b.date.getTime() - a.date.getTime()));

    }).catch(error => {
      console.error("Error fetching billable items:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load billing history.' });
    }).finally(() => {
      setIsLoading(false);
    });
  }, [firestore, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = React.useMemo(() => {
    let items = [...allBillableItems];

    if (dateRange?.from) {
      const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) };
      items = items.filter(i => {
        const itemDate = i.date;
        return itemDate && isWithinInterval(itemDate, interval);
      });
    }

    if (activeTab !== 'All') {
      items = items.filter(i => i.type === activeTab);
    }

    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        items = items.filter(item => {
          const guestName = (item as any).booking?.guestName || (item as any).customerName || '';
          const roomNumber = (item as any).booking?.roomNumber || '';
          return guestName.toLowerCase().includes(lowerCaseSearch) || roomNumber.toString().toLowerCase().includes(lowerCaseSearch);
        });
    }

    return items;
  }, [allBillableItems, dateRange, activeTab, searchTerm]);

  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);

  const handlePrint = (item: BillableItem) => {
    if (item.type === 'Point of Sale') {
      setSaleToPrint(item as StockSale);
    } else if (item.type === 'Room Charges') {
      setItemToPrint(item);
    } else if (item.type === 'Salon Services') {
      setSalonOrderToPrint(item as SalonService);
    } else if (item.type === 'Laundry Orders') {
      setLaundryOrderToPrint(item as LaundryOrder);
    } else if (item.type === 'Restaurant Bills') {
        setItemToPrint(item);
    } else { // Other Service Bills
      setBillToPrint(item as Bill);
    }
  };

  const paymentForReceipt: Payment | null = React.useMemo(() => {
    if (!itemToPrint || itemToPrint.type !== 'Room Charges') return null;
    const booking = itemToPrint as Booking;
    return {
      id: booking.bookingId || booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhotoURL: booking.guestPhotoURL,
      roomNumber: booking.roomNumber!,
      amount: booking.totalAmount || 0,
      paymentMethod: booking.paymentMethod || 'On-site',
      status: booking.status,
      transactionDate: getSafeDate(booking.createdAt)!,
      bookingDetails: booking,
    };
  }, [itemToPrint]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <BookUser className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Print Daily Bills
              </h1>
              <p className="text-muted-foreground">
                Find and print individual bills for any guest transaction.
              </p>
            </div>
          </div>
           <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsGuestFolioOpen(true)}>
                    <User className="mr-2 h-4 w-4"/>
                    Generate Guest Folio
                </Button>
            </div>
        </div>

        <Card className="print:border-0 print:shadow-none">
            <CardHeader className="border-b print:hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Select value={activeTab} onValueChange={(value) => {setActiveTab(value as BillSource); setCurrentPage(1);}}>
                          <SelectTrigger className="w-full sm:w-[240px]">
                            <SelectValue placeholder="Select a bill source..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">All Bill Types</SelectItem>
                            {Object.entries(sourceConfig).map(([name, config]) => (
                              <SelectItem key={name} value={name}>
                                <div className="flex items-center gap-2">
                                  <config.icon className="h-4 w-4 text-muted-foreground" />
                                  {name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        <div className="flex items-center gap-2">
                           <Button onClick={() => setDateRange({ from: startOfToday(), to: endOfToday() })}>Today</Button>
                           <Button onClick={() => {
                                const yesterday = subDays(new Date(), 1);
                                setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
                           }}>Yesterday</Button>
                        </div>
                    </div>
                    <div className="relative w-full sm:w-auto sm:min-w-[250px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by guest or room..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : paginatedItems.length > 0 ? (
                <InvoiceContent items={paginatedItems} formatCurrency={formatCurrency} onPrint={handlePrint} />
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={BookUser}
                    title="No Bills Found"
                    description="No billable items match your current filters."
                  />
                </div>
              )}
            </CardContent>

             {!isLoading && filteredItems.length > 0 && (
              <CardFooter className="flex items-center justify-end px-4 py-4 border-t print:hidden">
                <PaginationControls
                    canPrev={currentPage > 1}
                    canNext={currentPage < totalPages}
                    onPrev={() => setCurrentPage(p => p - 1)}
                    onNext={() => setCurrentPage(p => p + 1)}
                />
              </CardFooter>
            )}
        </Card>
      </div>

       <GuestFolioDialog
        isOpen={isGuestFolioOpen}
        onClose={() => setIsGuestFolioOpen(false)}
        allBookings={allBookings || []}
        allBills={allBills || []}
        allPayments={allPayments || []}
        isLoading={isLoading}
        onBillPrinted={fetchData}
      />
      {paymentForReceipt && (
        <ReprintReceiptDialog
            isOpen={!!itemToPrint && itemToPrint.type === 'Room Charges'}
            onClose={() => setItemToPrint(null)}
            payment={paymentForReceipt}
            allUsers={allUsers || []}
        />
      )}
      <StockSaleReceiptDialog
        isOpen={!!saleToPrint}
        onClose={() => setSaleToPrint(null)}
        sale={saleToPrint}
        allUsers={allUsers || []}
      />
      <SalonReceiptDialog
        isOpen={!!salonOrderToPrint}
        onClose={() => setSalonOrderToPrint(null)}
        order={salonOrderToPrint}
        allUsers={allUsers || []}
      />
      <LaundryReceiptDialog
        isOpen={!!laundryOrderToPrint}
        onClose={() => setLaundryOrderToPrint(null)}
        order={laundryOrderToPrint}
        allBills={allBills || []}
      />
       {(itemToPrint?.type === 'Restaurant Bills') && (
        <KitchenOrderReceiptDialog
            isOpen={!!itemToPrint}
            onClose={() => setItemToPrint(null)}
            order={itemToPrint as Order}
            allBills={allBills || []}
        />
       )}
        {billToPrint && (
            <BillReceiptDialog
                isOpen={!!billToPrint}
                onClose={() => setBillToPrint(null)}
                bill={billToPrint as Bill}
            />
        )}
    </>
  );
}

export default withAuth(PrintRoomBillPage, PagePermission.VIEW_ACCOUNTING_PAGE);
