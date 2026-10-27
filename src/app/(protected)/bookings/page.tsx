
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  CalendarPlus,
  History,
  AlarmClockOff,
  ChevronDown,
  DollarSign,
  Undo2,
  ShoppingCart,
  Printer,
  CircleX,
  Edit,
  Image as ImageIcon,
} from 'lucide-react';
import type { Booking, Room, BookingType, Bill, StockSale } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { cn } from '@/lib/utils';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { isToday } from 'date-fns';

import { useBookings } from '@/hooks/use-bookings';
import { useBookingActions } from '@/components/bookings/use-booking-actions';
import { BookingDialogs } from '@/components/bookings/booking-dialogs';
import { StatCards } from '@/components/bookings/stat-cards';
import { BookingCalendar } from '@/components/bookings/booking-calendar';
import { RoomOrders } from '@/components/bookings/room-orders';
import { BookingsTabs } from '@/components/bookings/bookings-tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { MyHistoryDialog } from '@/components/history/my-history-dialog';
import { DueCheckoutsDialog } from '@/components/dashboard/due-checkouts-dialog';
import type { DateRange } from 'react-day-picker';
import { StatCard } from '@/components/ui/stat-card';
import { getSafeDate } from '@/lib/helpers';
import { HotelPos } from '@/components/pos/hotel-pos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from 'next/image';


function BookingsPage() {
  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';

  const {
    allBookings,
    isLoading,
    overdueCheckoutsData,
    todaysIncome,
    totalRefunds,
    myTodaysIncome,
    cleaningQueueData,
    maintenanceQueueData,
    reloadBookings,
    rooms,
  } = useBookings();

  const [filterDateRange, setFilterDateRange] = React.useState<DateRange | undefined>();
  const [isMyHistoryOpen, setIsMyHistoryOpen] = React.useState(false);
  const [isDueCheckoutsOpen, setDueCheckoutsOpen] = React.useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(false);
  const [actionsBooking, setActionsBooking] = React.useState<Booking | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [cancelConfirmText, setCancelConfirmText] = React.useState('');
  const [imageToView, setImageToView] = React.useState<string | null>(null);
  const CONFIRM_CANCEL_TEXT = "CANCEL";

  const {
    actionState,
    setActionState,
    handleCheckIn,
    handleCheckout,
    handleCancel,
    handleAddBill,
    handlePayBills,
    handleToggleCollectPayment,
    handleConfirmMarkAsPaid,
    handleUpdateRoomStatus,
    handleReassign,
    handleWalkIn,
    handleEdit,
    confirmCheckout,
    confirmCancel,
    handleBookingSuccess,
    paymentForReceipt,
    handleReprintInvoice,
  } = useBookingActions({
    rooms,
    onSuccess: reloadBookings,
  });

  const activeBookingsForCalendar = React.useMemo(() => {
    if (!allBookings) return [];
    return allBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Refunded' && b.status !== 'Checked-out');
  }, [allBookings]);

  const handleDateClick = (date: Date | undefined, type: BookingType, room?: Room) => {
      setActionState(prev => ({
          ...prev,
          initialDateRange: date ? { from: date, to: date } : undefined,
          initialBookingType: type,
          walkInRoom: room || null,
          isNewBookingOpen: true
      }));
  };

  const handleRangeSelect = (range: DateRange) => {
     setActionState({ ...actionState, initialDateRange: range, initialBookingType: 'reservation', isNewBookingOpen: true });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);
  }

  const handleModalClose = () => {
    setActionsBooking(null);
    setShowCancelConfirm(false);
    setCancelConfirmText('');
  }


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Room Status & Bookings
            </h2>
            <p className="text-muted-foreground">
              Manage and view the status of all hotel rooms.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <DateRangePicker date={filterDateRange} onDateChange={setFilterDateRange} />
             <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    onClick={() => setDueCheckoutsOpen(true)}
                    disabled={isLoading}
                    className={cn((overdueCheckoutsData?.length || 0) > 0 && 'bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20 hover:text-destructive animate-pulse')}
                >
                    <AlarmClockOff className="mr-2" />
                    Overdue Checkouts {(overdueCheckoutsData?.length || 0) > 0 && `(${(overdueCheckoutsData?.length)})`}
                </Button>
                <Button variant="outline" onClick={() => setIsMyHistoryOpen(true)} disabled={isLoading}>
                    <History className="mr-2" /> My History
                </Button>
                <Button onClick={() => handleDateClick(undefined, 'reservation')} disabled={isLoading}>
                  <CalendarPlus className="mr-2" /> New Booking
                </Button>
             </div>
          </div>
        </div>

        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <StatCards
                allBookingsData={allBookings}
                rooms={rooms}
                cleaningQueueData={cleaningQueueData}
                maintenanceQueueData={maintenanceQueueData}
                dateRange={filterDateRange}
                overdueCheckoutsCount={overdueCheckoutsData?.length || 0}
                todaysIncome={todaysIncome}
                totalRefunds={totalRefunds}
                myTodaysIncome={myTodaysIncome}
            />
            <div className="mt-4 flex items-center justify-center">
                <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    {isStatsExpanded ? 'Show Less' : 'Show More Stats'}
                    <ChevronDown
                    className={cn(
                        'ml-2 h-4 w-4 transition-transform',
                        isStatsExpanded && 'rotate-180'
                    )}
                    />
                </Button>
                </CollapsibleTrigger>
            </div>
        </Collapsible>

        <Tabs defaultValue="bookings" className="w-full">
          <TabsList>
            <TabsTrigger value="bookings">Bookings & Rooms</TabsTrigger>
            <TabsTrigger value="hotel-pos">Hotel Point of Sale</TabsTrigger>
          </TabsList>
          <TabsContent value="bookings">
              <div className="flex flex-col gap-6 mt-4">
                  <BookingCalendar
                    bookings={activeBookingsForCalendar}
                    onDateClick={handleDateClick}
                    onRangeSelect={handleRangeSelect}
                  />

                  <RoomOrders rooms={rooms || []} />

                  <BookingsTabs
                    rooms={rooms}
                    allBookingsData={allBookings}
                    cleaningQueueData={cleaningQueueData}
                    maintenanceQueueData={maintenanceQueueData}
                    isLoading={isLoading}
                    setDetailsBooking={(booking: Booking) => setActionState({ ...actionState, detailsBooking: booking })}
                    setWalkInRoom={handleWalkIn}
                    onCheckIn={(booking: Booking) => setActionState({ ...actionState, bookingToCheckIn: booking })}
                    onCheckOut={handleCheckout}
                    onCancel={handleCancel}
                    onAddBill={(booking: Booking) => setActionState({ ...actionState, bookingToAddBill: booking })}
                    onViewBill={(booking: Booking) => setActionState({ ...actionState, bookingToViewBill: booking })}
                    onPayBills={(booking: Booking) => setActionState({ ...actionState, bookingToPayBills: booking })}
                    onUpdateRoomStatus={handleUpdateRoomStatus}
                    onRenew={() => {}}
                    onMarkAsPaid={(booking: Booking) => setActionState({ ...actionState, bookingToMarkAsPaid: booking })}
                    onToggleCollectPayment={handleToggleCollectPayment}
                    onReprintInvoice={handleReprintInvoice}
                    onEdit={handleEdit}
                    onOpenActions={(booking: Booking) => setActionsBooking(booking)}
                    onViewImage={setImageToView}
                  />
              </div>
          </TabsContent>
           <TabsContent value="hotel-pos">
              <HotelPos onSaleAction={reloadBookings} context="hotel" />
           </TabsContent>
        </Tabs>
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
        reloadBookings={reloadBookings}
        onViewImage={setImageToView}
        settings={settings}
      />

      <MyHistoryDialog
        isOpen={isMyHistoryOpen}
        onClose={() => setIsMyHistoryOpen(false)}
        onViewDetails={(booking: Booking) => setActionState({ ...actionState, detailsBooking: booking })}
      />
       <DueCheckoutsDialog
        isOpen={isDueCheckoutsOpen}
        onClose={() => setDueCheckoutsOpen(false)}
        onCheckedOut={reloadBookings}
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
              <Button
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
              >
                <CircleX className="mr-2 h-4 w-4" />
                Cancel Booking
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
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <DialogDescription>
                  This action cannot be undone. This will cancel the booking for <span className="font-bold">{actionsBooking?.guestName}</span>. Please confirm.
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
      <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Guest Photo</DialogTitle>
          </DialogHeader>
          {imageToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageToView}
                alt="Guest Photo"
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

export default withAuth(BookingsPage, PagePermission.VIEW_BOOKINGS_PAGE);
