
'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
  writeBatch,
  getDoc,
  getDocs,
  limit,
  collectionGroup,
} from 'firebase/firestore';
import {
  ChefHat,
  ChevronDown,
  Loader2,
  FileText,
  Printer,
  Image as ImageIcon,
  VolumeX,
  Volume2
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSettings } from '@/contexts/settings-context';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
} from '@/components/ui/dialog';
import { KitchenOrderReceiptDialog } from '@/components/kitchen/kitchen-order-receipt-dialog';
import { StatCard } from '@/components/ui/stat-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { Order, BillItem, Booking, Bill, Payment, Room } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { exportToCsv } from '@/lib/csv-export';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Bed } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { OrderCard } from '@/components/kitchen/order-card';
import { LoadingSkeleton } from '@/components/kitchen/kitchen-helpers';
import Image from 'next/image';
import { KitchenHistoryTable } from '@/components/kitchen/kitchen-history-table';


const PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 15;


export function RoomOrders({ rooms }: { rooms: Room[] }) {
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const enableNotificationSound = settings?.enableNotificationSound ?? true;
  const notificationSoundUrl = settings?.notificationSoundUrl || 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_16cc9a1f7d.mp3';

  const [isOpen, setIsOpen] = React.useState(false);
  const [allOrders, setAllOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const printRef = React.useRef<HTMLDivElement>(null);

  const [isSoundMuted, setIsSoundMuted] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);


  const [orderToUpdate, setOrderToUpdate] = React.useState<{order: Order, newStatus: 'Preparing' | 'Completed'} | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = React.useState(false);
  const [orderToPrint, setOrderToPrint] = React.useState<Order | null>(null);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [imageToView, setImageToView] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [orderToBill, setOrderToBill] = React.useState<Order | null>(null);
  const [bookingForBill, setBookingForBill] = React.useState<Booking | null>(null);
  const [ambiguousBookings, setAmbiguousBookings] = React.useState<Booking[]>([]);
  const [selectedBookingIdForBill, setSelectedBookingIdForBill] = React.useState<string | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = React.useState(false);
  const [manualRoomNumber, setManualRoomNumber] = React.useState('');

  const [activePage, setActivePage] = React.useState(1);
  const [completedPage, setCompletedPage] = React.useState(1);


  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  React.useEffect(() => {
    if (enableNotificationSound && !audioRef.current) {
        audioRef.current = new Audio(notificationSoundUrl);
        audioRef.current.loop = true;
    }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [enableNotificationSound, notificationSoundUrl]);

  const { data: allBills } = useCollection<Bill>(
    React.useMemo(() => firestore ? query(collectionGroup(firestore, 'bills')) : null, [firestore])
  );

  const pendingOrders = React.useMemo(() => allOrders.filter(o => o.status === 'Pending'), [allOrders]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const shouldPlay = pendingOrders.length > 0 && !isSoundMuted && enableNotificationSound;

    if (shouldPlay && audio.paused) {
      audio.play().catch(e => console.error("Sound play failed:", e));
    } else if (!shouldPlay && !audio.paused) {
      audio.pause();
    }
  }, [pendingOrders, isSoundMuted, enableNotificationSound]);


  React.useEffect(() => {
    if (!firestore) return;
    setIsLoading(true);

    const ordersQuery = query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'));

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setAllOrders(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching recent orders:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch recent orders.' });
      setIsLoading(false);
    });

    return () => {
        unsubOrders();
    };
  }, [firestore, toast]);

  React.useEffect(() => {
    if (!firestore || !orderToBill) {
      setBookingForBill(null);
      setAmbiguousBookings(null);
      return;
    };

    if (orderToBill.bookingId) {
      setIsLoadingBooking(true);
      const bookingRef = doc(firestore, 'bookings', orderToBill.bookingId);
      getDoc(bookingRef).then(docSnap => {
        if (docSnap.exists() && (docSnap.data().status === 'Active' || docSnap.data().status === 'Checked-in')) {
          setBookingForBill({ id: docSnap.id, ...docSnap.data() } as Booking);
        } else {
          setBookingForBill(null);
        }
      }).finally(() => setIsLoadingBooking(false));
    } else {
        setIsLoadingBooking(false);
        setBookingForBill(null);
    }
  }, [firestore, orderToBill]);

 const {
    activeOrders,
    paginatedActiveOrders,
    activeTotalPages,
  } = React.useMemo(() => {

    const filteredOrders = allOrders.filter(order => {
        let searchMatch = true;
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            searchMatch = (
                (order.orderNumber && String(order.orderNumber).includes(lowerCaseSearch)) ||
                order.roomNumber.toLowerCase().includes(lowerCaseSearch) ||
                (order.guestName && order.guestName.toLowerCase().includes(lowerCaseSearch)) ||
                (order.phoneNumber && order.phoneNumber.toLowerCase().includes(lowerCaseSearch))
            );
        }
        return searchMatch;
    });

    const active = filteredOrders.filter(o => o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Billed');

    // Active pagination
    const activeStartIndex = (activePage - 1) * PAGE_SIZE;
    const activeEndIndex = activeStartIndex + PAGE_SIZE;
    const paginatedActive = active.slice(activeStartIndex, activeEndIndex);
    const activePages = Math.ceil(active.length / PAGE_SIZE);

    return {
      activeOrders: active,
      paginatedActiveOrders: paginatedActive,
      activeTotalPages: activePages,
    };
  }, [allOrders, searchTerm, dateRange, activePage]);



   const handleAddBill = (order: Order) => {
    setOrderToBill(order);
    setManualRoomNumber(order.roomNumber);
    setAmbiguousBookings(null);
    setSelectedBookingIdForBill(null);
  };

   const handleAddBillToRoom = async () => {
    if (!firestore || !user || !userProfile || !orderToBill) return;

    setIsUpdatingOrder(true);
    let finalBookingId: string | undefined = bookingForBill?.id;

    if (selectedBookingIdForBill) {
        finalBookingId = selectedBookingIdForBill;
    } else if (!finalBookingId && manualRoomNumber) {
        const roomQuery = query(
            collection(firestore, 'bookings'),
            where('roomNumber', '==', manualRoomNumber),
            where('status', 'in', ['Active', 'Checked-in']),
        );
        const roomSnapshot = await getDocs(roomQuery);

        if (roomSnapshot.empty) {
            toast({
                variant: 'destructive',
                title: 'No Active Guest',
                description: `Could not find an active guest in Room ${manualRoomNumber}. Please verify the room number.`
            });
            setIsUpdatingOrder(false);
            return;
        } else if (roomSnapshot.size > 1) {
            const foundBookings = roomSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
            setAmbiguousBookings(foundBookings);
            setIsUpdatingOrder(false);
            return;
        } else {
            finalBookingId = roomSnapshot.docs[0].id;
        }
    }

    if (!finalBookingId) {
        toast({ variant: 'destructive', title: 'No Guest Selected', description: 'Please select a guest to bill.' });
        setIsUpdatingOrder(false);
        return;
    }

    const batch = writeBatch(firestore);

    const billItems: BillItem[] = orderToBill.items.map(item => ({
        id: `order-${orderToBill.orderNumber}-${item.id}`,
        name: `${item.name}`,
        price: item.price,
        quantity: item.quantity,
        paid: false,
        images: null,
        isService: false,
        billId: '',
    }));

    const newBillRef = doc(collection(firestore, `bookings/${finalBookingId}/bills`));
    batch.set(newBillRef, {
        items: billItems,
        total: orderToBill.totalPrice,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: userProfile.name,
        paid: false,
        bookingId: finalBookingId,
    });

    const orderRef = doc(firestore, 'orders', orderToBill.id);
    batch.update(orderRef, {
      status: 'Billed',
      billedAt: serverTimestamp(),
      billedByUid: user.uid,
      billedByName: userProfile.name
    });


    try {
        await batch.commit();
        let toastDescription = `The charge of ${formatCurrency(orderToBill.totalPrice)} has been added to the guest's bill for Room ${manualRoomNumber}.`;
        toast({
            variant: 'success',
            title: `Bill Added to Room`,
            description: toastDescription,
            duration: 8000,
        });
    } catch (error) {
        console.error("Error adding bill:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add bill to room.' });
    } finally {
        setOrderToBill(null);
        setManualRoomNumber('');
        setIsUpdatingOrder(false);
        setAmbiguousBookings(null);
        setSelectedBookingIdForBill(null);
    }
  }

  const roomTypeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(roomType => {
      roomType.roomNumbers?.forEach(roomNumber => {
        map.set(roomNumber, roomType.name);
      });
    });
    return map;
  }, [rooms]);

  return (
    <>
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
          className="w-full rounded-lg border bg-card p-4 shadow-sm"
          style={{
              backgroundColor: 'hsl(var(--room-orders-tab-background))',
              color: 'hsl(var(--room-orders-tab-foreground))'
          }}
      >
        <CollapsibleTrigger asChild>
          <div className="flex-1 cursor-pointer flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ChefHat className="h-6 w-6" style={{ color: 'hsl(var(--primary))' }} />
              <div>
                <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                  Room Service &amp; Orders
                  {activeOrders.length > 0 && (
                      <Badge className="blinking-red-badge">{activeOrders.length}</Badge>
                  )}
                </h3>
                <p className="text-sm opacity-80">
                  A real-time overview of all incoming food and beverage orders from guests.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                 <Button variant="outline" onClick={(e) => { e.stopPropagation(); setIsSoundMuted(prev => !prev); }}>
                  {isSoundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  <span className="ml-2">{isSoundMuted ? 'Unmute' : 'Mute'}</span>
                </Button>
                <Button>
                  {isOpen ? 'Hide Orders' : 'View Orders'}
                  <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </Button>
            </div>
          </div>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="p-4">
            <Tabs defaultValue="active" className="w-full">
                <TabsList>
                    <TabsTrigger value="active">Active Orders</TabsTrigger>
                    <TabsTrigger value="history">Order History</TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="mt-4">
                    {isLoading ? (
                    <LoadingSkeleton />
                    ) : (
                        activeOrders.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title="No Active Guest Orders"
                                description="New orders from guest menus will appear here in real-time."
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {activeOrders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onPrint={setOrderToPrint}
                                    formatCurrency={formatCurrency}
                                    roomType={roomTypeMap.get(order.roomNumber)}
                                    onAddBill={handleAddBill}
                                    onViewImage={setImageToView}
                                    allBills={allBills || []}
                                />
                                ))}
                            </div>
                        )
                    )}
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                    <KitchenHistoryTable onPrintReceipt={setOrderToPrint} allBills={allBills || []} />
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>

      <AlertDialog open={!!orderToBill} onOpenChange={(open) => !open && setOrderToBill(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Add Bill to Room {orderToBill?.roomNumber}?</AlertDialogTitle>
                <AlertDialogDescription>
                    Please confirm the guest details before adding the bill of{' '}
                    <span className="font-bold">{formatCurrency(orderToBill?.totalPrice || 0)}</span> to their room.
                </AlertDialogDescription>
            </AlertDialogHeader>
            {isLoadingBooking ? (
                <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : bookingForBill ? (
                <div className="p-4 rounded-md border bg-muted flex items-center gap-4">
                     <Avatar className="h-14 w-14">
                        <AvatarImage src={bookingForBill.guestPhotoURL} />
                        <AvatarFallback>{getInitials(bookingForBill.guestName)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-bold">{bookingForBill.guestName}</p>
                        <p className="text-sm text-muted-foreground">{bookingForBill.guestEmail}</p>
                        <Badge variant="success" className="mt-1">Active Check-in</Badge>
                    </div>
                </div>
            ) : (
                 <div className="p-4 rounded-md border bg-destructive/10 text-destructive space-y-4">
                    <div>
                        <p className="font-bold">Warning: Could not automatically find an active booking for Room {orderToBill?.roomNumber}.</p>
                        <p className="text-sm">The guest may have checked out. Please verify the room number before proceeding.</p>
                    </div>
                    {ambiguousBookings ? (
                         <div className="space-y-2 text-black dark:text-white">
                            <Label>Multiple active guests found. Please select one:</Label>
                            <Select onValueChange={setSelectedBookingIdForBill}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a guest..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ambiguousBookings.map(b => (
                                        <SelectItem key={b.id} value={b.id}>
                                            <div className="flex items-center gap-2">
                                                <Bed className="h-4 w-4"/>
                                                <span>{b.guestName} (Room {b.roomNumber} - {roomTypeMap.get(b.roomNumber) || 'N/A'})</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="manual-room-number" className="text-black dark:text-white">Enter Correct Room Number</Label>
                            <Input
                                id="manual-room-number"
                                value={manualRoomNumber}
                                onChange={(e) => setManualRoomNumber(e.target.value)}
                                placeholder="e.g., 101"
                                className="bg-white"
                            />
                        </div>
                    )}
                 </div>
            )}
             <AlertDialogFooter>
                <AlertDialogCancel disabled={isUpdatingOrder}>Cancel</AlertDialogCancel>
                <Button
                onClick={handleAddBillToRoom}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isUpdatingOrder || (!bookingForBill && !manualRoomNumber && !selectedBookingIdForBill)}
                >
                {isUpdatingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm &amp; Add Bill
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KitchenOrderReceiptDialog
        isOpen={!!orderToPrint}
        onClose={() => setOrderToPrint(null)}
        order={orderToPrint}
      />
      <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitleComponent>Item Image</DialogTitleComponent>
          </DialogHeader>
          {imageToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageToView}
                alt="Order item image"
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
