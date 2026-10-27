
'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  Timestamp,
  writeBatch,
  doc,
  limit,
  getDocs,
  serverTimestamp,
  orderBy,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  increment,
  onSnapshot,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { format, startOfToday, endOfToday, startOfTomorrow, endOfTomorrow, setHours, setMinutes, parse, isToday } from 'date-fns';
import {
  CalendarClock,
  Bed,
  Search,
  Volume2,
  VolumeX,
  Phone,
  Save,
  MoreHorizontal,
  Edit,
  Printer,
  CircleX,
  LogIn,
  Globe,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';

import type { Booking, Room, Payment } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/settings-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getSafeDate } from '@/lib/helpers';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ReservationCard } from '@/components/reservations/reservation-card';
import { LoadingSkeleton, PaginationControls } from '@/components/reservations/reservation-helpers';
import { DataTable } from '@/components/ui/data-table';
import { useReservationColumns } from '@/components/reservations/columns';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { useBookingActions } from '@/components/bookings/use-booking-actions';
import { BookingDialogs } from '@/components/bookings/booking-dialogs';
import { useBookings } from '@/hooks/use-bookings';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const PAGE_SIZE = 8;
type FilterType = 'all' | 'today' | 'tomorrow';
type SourceFilterType = 'all' | 'staff' | 'website';


function ReservationsPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { settings, refreshSettings } = useSettings();
  const { user, userProfile } = useUser();
  const checkoutTime = settings?.checkoutTime || '11:00';

  const [filter, setFilter] = React.useState<FilterType>((searchParams.get('filter') as FilterType) || 'all');
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilterType>('all');
  const [searchTerm, setSearchTerm] = React.useState(searchParams.get('search') || '');
  const [notificationNumbers, setNotificationNumbers] = React.useState('');
  const [isSavingPhoneNumber, setIsSavingPhoneNumber] = React.useState(false);

  const [newWebsiteBookings, setNewWebsiteBookings] = React.useState<Booking[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);

  const [reloadCounter, setReloadCounter] = React.useState(0);

  const { toast } = useToast();
  const { rooms } = useBookings();

  const [isSoundMuted, setIsSoundMuted] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const initialLoadTimestamp = React.useRef(new Date());

  const [actionsBooking, setActionsBooking] = React.useState<Booking | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [cancelConfirmText, setCancelConfirmText] = React.useState('');
  const CONFIRM_CANCEL_TEXT = "CANCEL";


  const {
    actionState,
    setActionState,
    handleBookingSuccess,
    confirmCheckout,
    handleCheckIn,
    paymentForReceipt,
    confirmCancel,
    handleAddBill,
    handlePayBills,
    handleConfirmMarkAsPaid,
    handleToggleCollectPayment,
    handleReprintInvoice,
    handleEdit,
  } = useBookingActions({
    rooms: rooms,
    onSuccess: () => setReloadCounter(c => c + 1),
  });

  const handleViewDetails = (booking: Booking) => {
    setActionState(prev => ({ ...prev, detailsBooking: booking }));
  };

  const userCurrency = settings?.currency || 'USD';
  const columns = useReservationColumns({ onViewDetails: handleViewDetails, currency: userCurrency });

  React.useEffect(() => {
    if (settings?.reservationAlertPhoneNumber) {
        setNotificationNumbers(settings.reservationAlertPhoneNumber);
    }
  }, [settings]);

  const handleSavePhoneNumber = async () => {
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    setIsSavingPhoneNumber(true);
    try {
        const settingsDocRef = doc(firestore, 'settings', 'global');
        await setDoc(settingsDocRef, { reservationAlertPhoneNumber: notificationNumbers }, { merge: true });
        toast({
            title: 'Phone Numbers Saved',
            description: 'The global alert numbers have been updated.',
            variant: 'success'
        });
        refreshSettings();
    } catch (error) {
        toast({ title: 'Error', description: 'Could not save phone numbers.', variant: 'destructive'});
    } finally {
        setIsSavingPhoneNumber(false);
    }
  };


  React.useEffect(() => {
    if (settings?.enableNotificationSound) {
      audioRef.current = new Audio(settings.notificationSoundUrl || 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_16cc9a1f7d.mp3');
    }
  }, [settings?.enableNotificationSound, settings?.notificationSoundUrl]);

  React.useEffect(() => {
    if (!firestore || !user) return;

    const q = query(
      collection(firestore, 'bookings'),
      where('status', 'in', ['Booked', 'Reserved']),
      where('source', '==', 'website'),
      where('createdAt', '>=', Timestamp.fromDate(initialLoadTimestamp.current))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let hasNewChanges = false;
      const addedBookings: Booking[] = [];

      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            hasNewChanges = true;
            const newBooking = { id: change.doc.id, ...change.doc.data() } as Booking;
            addedBookings.push(newBooking);

            const message = `
*New Website Reservation!*

*Guest:* ${newBooking.guestName}
*Room:* ${newBooking.roomNumber || 'N/A'}
*Check-in:* ${format(getSafeDate(newBooking.checkInDate)!, 'PP')}
*Check-out:* ${format(getSafeDate(newBooking.checkOutDate)!, 'PP')}
*Booking ID:* ${newBooking.bookingId}

Please confirm payment in the dashboard.
            `.trim();

            const alertNumbers = settings?.reservationAlertPhoneNumber?.split(',').map(n => n.trim()).filter(Boolean) || [];

            let description = `${newBooking.guestName} has made a new reservation.`;
            if (alertNumbers.length > 0) {
              description += ` An alert was sent to configured number(s).`;
            }

            toast({
              title: 'New Website Reservation!',
              description: description,
            });

            if (audioRef.current && !isSoundMuted) {
              audioRef.current.play().catch(e => console.error("Audio play failed:", e));
            }

            if (alertNumbers.length > 0) {
              await sendWhatsAppMessage({
                phone: alertNumbers,
                message: message,
              });
            }
        }
      });

      if (hasNewChanges) {
          setNewWebsiteBookings(prev => {
              const newBookingIds = new Set(addedBookings.map(b => b.id));
              const uniquePrev = prev.filter(b => !newBookingIds.has(b.id));
              return [...addedBookings, ...uniquePrev].sort((a, b) => getSafeDate(b.createdAt)!.getTime() - getSafeDate(a.createdAt)!.getTime());
          });
          setReloadCounter(c => c + 1); // Reload main list as well
      }

    }, (error) => {
        console.warn("Could not attach listener for website bookings, possibly due to missing index.", error.message);
    });

    return () => unsubscribe();
  }, [firestore, user, isSoundMuted, toast, settings]);


  const fetchBookings = React.useCallback(
    async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
      if (!firestore) return;

      setIsLoading(true);

      let constraints = [];
      if (filter === 'today') {
          constraints.push(where('checkInDate', '>=', startOfToday()));
          constraints.push(where('checkInDate', '<=', endOfToday()));
      } else if (filter === 'tomorrow') {
          constraints.push(where('checkInDate', '>=', startOfTomorrow()));
          constraints.push(where('checkInDate', '<=', endOfTomorrow()));
      }

      if (sourceFilter !== 'all') {
        constraints.push(where('source', '==', sourceFilter));
      }


      const baseQuery = query(
        collection(firestore, 'bookings'),
        where('status', 'in', ['Booked', 'Reserved']),
        ...constraints,
        orderBy('checkInDate', 'asc')
      );

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

        if (!snapshot.empty) {
          let data = snapshot.docs.map(
            doc =>
              ({
                id: doc.id,
                ...doc.data(),
                checkInDate: (doc.data().checkInDate as Timestamp).toDate(),
                checkOutDate: (doc.data().checkOutDate as Timestamp).toDate(),
              } as Booking)
          );

          if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            data = data.filter(booking =>
                booking.guestName.toLowerCase().includes(lowercasedTerm) ||
                (booking.roomNumber && booking.roomNumber.toLowerCase().includes(lowercasedTerm)) ||
                (booking.guestEmail && booking.guestEmail.toLowerCase().includes(lowercasedTerm)) ||
                (booking.bookingId && booking.bookingId.toLowerCase().includes(lowercasedTerm))
            );
          }

          setBookings(data);

          const newFirst = snapshot.docs[0];
          const newLast = snapshot.docs[snapshot.docs.length - 1];
          setFirstVisible(newFirst);
          setLastVisible(newLast);

          const nextQuery = query(baseQuery, startAfter(newLast), limit(1));
          const nextSnapshot = await getDocs(nextQuery);
          setHasMore(!nextSnapshot.empty);

          if(direction === 'next') setPage(p => p + 1);
          if(direction === 'prev' && page > 1) setPage(p => p - 1);
          if(isInitialOrReload) setPage(1);

        } else {
           if (isInitialOrReload) {
              setBookings([]);
          }
          setHasMore(false);
          if (direction === 'prev' && page > 1) {
            fetchBookings('initial');
          }
        }
      } catch (error) {
        console.error("Error fetching reservations: ", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch active reservations.'
        });
      } finally {
        setIsLoading(false);
      }
    },
    [firestore, lastVisible, firstVisible, toast, filter, searchTerm, sourceFilter]
  );

  React.useEffect(() => {
    fetchBookings('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadCounter, filter, searchTerm, sourceFilter]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchTerm) {
      params.set('search', searchTerm);
    } else {
      params.delete('search');
    }
    if (filter !== 'all') {
      params.set('filter', filter);
    } else {
      params.delete('filter');
    }
    router.replace(`${window.location.pathname}?${params.toString()}`);
  }, [searchTerm, filter, router]);


  const handleNextPage = () => {
    if (!hasMore) return;
    fetchBookings('next');
  };

  const handlePrevPage = () => {
    if (page <= 1) return;
    fetchBookings('prev');
  };

  const handleModalClose = () => {
    setActionsBooking(null);
    setShowCancelConfirm(false);
    setCancelConfirmText('');
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <CalendarClock className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Upcoming Reservations
              </h1>
              <p className="text-muted-foreground">
                A real-time overview of all paid and unpaid reservations.
              </p>
            </div>
          </div>
           <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsSoundMuted(prev => !prev)}>
                {isSoundMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
                <span className="ml-2">{isSoundMuted ? 'Unmute Alerts' : 'Mute Alerts'}</span>
            </Button>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Search by guest, room, or ID..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
           </div>
        </div>

        {newWebsiteBookings.length > 0 && (
          <>
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 animate-in fade-in-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-300">
                  <Globe className="h-5 w-5" />
                  New Website Reservations
                </CardTitle>
                <CardDescription>
                  These bookings just came in from your website. Please review and confirm payment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {newWebsiteBookings.map(booking => (
                    <ReservationCard
                      key={booking.id}
                      booking={booking}
                      checkoutTime={checkoutTime}
                      onCheckIn={(booking) => setActionState({ ...actionState, bookingToCheckIn: booking })}
                      onOpenActions={setActionsBooking}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Separator />
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilterType)}>
              <TabsList>
                <TabsTrigger value="all">All Sources</TabsTrigger>
                <TabsTrigger value="staff">Staff</TabsTrigger>
                <TabsTrigger value="website">Website</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative flex-grow sm:flex-grow-0 sm:w-auto flex items-center gap-2">
                <div className="relative flex-1">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Textarea
                        placeholder="Get alerts on WhatsApp (comma-separated)..."
                        className="pl-10"
                        value={notificationNumbers}
                        onChange={(e) => setNotificationNumbers(e.target.value)}
                        rows={1}
                    />
                </div>
                <Button size="sm" onClick={handleSavePhoneNumber} loading={isSavingPhoneNumber}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                </Button>
            </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Reservations List</CardTitle>
            <CardDescription>
              A detailed list of all upcoming reservations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={bookings} isLoading={isLoading} />
          </CardContent>
        </Card>


        {isLoading ? (
          <LoadingSkeleton />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={Bed}
            title="No Upcoming Reservations"
            description={`There are no reservations for the selected filter: "${filter}".`}
            className="min-h-[50vh]"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bookings.map(booking => (
               <Card key={booking.id} className="flex flex-col">
                <ReservationCard
                    booking={booking}
                    checkoutTime={checkoutTime}
                    onCheckIn={(booking) => setActionState({ ...actionState, bookingToCheckIn: booking })}
                    onOpenActions={setActionsBooking}
                />
               </Card>
            ))}
          </div>
        )}

        {!isLoading && bookings.length > 0 && (
            <div className="mt-4 flex items-center justify-end">
                <PaginationControls
                canPrev={page > 1}
                canNext={hasMore}
                onPrev={handlePrevPage}
                onNext={handleNextPage}
                />
            </div>
        )}
      </div>
       <BookingDialogs
        actionState={actionState}
        setActionState={setActionState}
        handleBookingSuccess={handleBookingSuccess}
        confirmCheckout={confirmCheckout}
        handleCheckIn={handleCheckIn}
        paymentForReceipt={paymentForReceipt}
        confirmCancel={confirmCancel}
        handleAddBill={handleAddBill}
        handlePayBills={handlePayBills}
        handleConfirmMarkAsPaid={handleConfirmMarkAsPaid}
        reloadBookings={() => setReloadCounter(c => c + 1)}
      />

       <Dialog open={!!actionsBooking} onOpenChange={handleModalClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showCancelConfirm ? 'Confirm Cancellation' : `Actions for ${actionsBooking?.guestName}`}</DialogTitle>
            {!showCancelConfirm && <DialogDescription>Room {actionsBooking?.roomNumber}</DialogDescription>}
          </DialogHeader>

          {!showCancelConfirm ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  handleReprintInvoice(actionsBooking);
                  handleModalClose();
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Reprint Receipt/Invoice
              </Button>
               <Button onClick={() => { setActionState(prev => ({...prev, bookingToCheckIn: actionsBooking})); handleModalClose(); }}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Check In Guest
              </Button>
              <Button
                  variant="outline"
                  onClick={() => {
                      handleEdit(actionsBooking!);
                      handleModalClose();
                  }}
                  >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Reservation
              </Button>
               <Button
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
              >
                <CircleX className="mr-2 h-4 w-4" />
                Cancel Reservation
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <DialogDescription>
                  This action cannot be undone. This will cancel the reservation for <span className="font-bold">{actionsBooking?.guestName}</span>. Please confirm.
              </DialogDescription>
              <div>
                <Label htmlFor="cancel-confirm" className="text-destructive font-semibold">Type "{CONFIRM_CANCEL_TEXT}" to confirm.</Label>
                <Input
                  id="cancel-confirm"
                  value={cancelConfirmText}
                  onChange={(e) => setCancelConfirmText(e.target.value)}
                  autoComplete="off"
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {!showCancelConfirm ? (
              <Button variant="ghost" onClick={handleModalClose}>Close</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowCancelConfirm(false)} disabled={actionState.isCancelling}>Go Back</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                      confirmCancel(actionsBooking!);
                      handleModalClose();
                    }
                  }
                  disabled={cancelConfirmText !== CONFIRM_CANCEL_TEXT || actionState.isCancelling}
                  loading={actionState.isCancelling}
                >
                  Confirm Cancellation
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(ReservationsPage, PagePermission.VIEW_BOOKINGS_PAGE);
