
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch,
  doc,
  increment,
  serverTimestamp,
  getDocs,
  getDoc,
  collectionGroup,
  updateDoc,
  setDoc,
  limit,
} from 'firebase/firestore';
import type { Booking, Room, BookingType, Payment, Bill, BillItem, Order, HeldSale, Customer } from '@/lib/types';
import {
  useFirestore,
} from '@/firebase';
import {
  setHours,
  setMinutes,
  setSeconds,
} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { getSafeDate } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import { useRouter } from 'next/navigation';


export const useBookingActions = ({ rooms, onSuccess = () => {} }: { rooms: Room[] | null, onSuccess?: () => void }) => {
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const router = useRouter();

  const [actionState, setActionState] = React.useState({
    isNewBookingOpen: false,
    initialDateRange: undefined as { from: Date; to: Date } | undefined,
    initialBookingType: 'reservation' as BookingType,
    walkInRoom: null as Room | null,
    detailsBooking: null as Booking | null,
    bookingToCheckout: null as Booking | null,
    bookingToCheckIn: null as Booking | null,
    bookingToCancel: null as Booking | null,
    reassignBooking: null as Booking | null,
    cancellationInvoiceBooking: null as Booking | null,
    bookingToReprint: null as Booking | null,
    bookingToAddBill: null as Booking | null,
    bookingToViewBill: null as Booking | null,
    bookingToPayBills: null as Booking | null,
    bookingToMarkAsPaid: null as Booking | null,
    bookingToEdit: null as Booking | null,
    isCancelling: false,
    isGuestFolioOpen: false,
  });

  const checkoutTime = settings?.checkoutTime || '11:00';
  const formatCurrency = (value: number) => {
    if (!settings?.currency) return value.toString();
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: settings.currency,
    }).format(value);
  };

  const handleBookingSuccess = (newBooking?: Booking) => {
    onSuccess();
    setActionState(prev => ({ ...prev, isNewBookingOpen: false, walkInRoom: null, reassignBooking: null }));
    if (newBooking) {
      setActionState(prev => ({ ...prev, bookingToReprint: newBooking }));
    }
  }

  const handleReassign = (booking: Booking) => {
    setActionState(prev => ({ ...prev, detailsBooking: null, reassignBooking: booking }));
  };

  const handleWalkIn = (room: Room) => {
    setActionState(prev => ({ ...prev, initialBookingType: 'checkin', walkInRoom: room }));
  };

  const handleReprintInvoice = (booking: Booking) => {
    setActionState(prev => ({ ...prev, bookingToReprint: booking }));
  };

  const handleEdit = (booking: Booking) => {
    setActionState(prev => ({ ...prev, bookingToEdit: booking }));
  };

  const handleCheckIn = async (booking: Booking, paymentMethod?: string, amount?: number, roomNumber?: string) => {
    if (!firestore || !user || !userProfile) return;
    const isPaidReservation = booking.status === 'Reserved';

    const finalRoomNumber = roomNumber || booking.roomNumber;
    if (!finalRoomNumber || finalRoomNumber === 'N/A') {
        toast({ variant: 'destructive', title: 'Error', description: 'A room number must be assigned to check in.'});
        throw new Error("Room number is missing.");
    }

    const batch = writeBatch(firestore);
    const bookingRef = doc(firestore, 'bookings', booking.id);

    const bookingUpdateData: Partial<Booking> = {
      status: 'Active',
      checkedInByUid: user.uid,
      checkedInByName: userProfile.name,
      checkInDate: Timestamp.now(),
      roomNumber: finalRoomNumber,
      discountType: booking.discountType || null,
      discountValue: booking.discountValue || null,
      discountReason: booking.discountReason || null,
    };

    let paymentRecordForReceipt: Payment | null = null;

    if (!isPaidReservation && paymentMethod && amount) {
        bookingUpdateData.paymentMethod = paymentMethod as any;
        bookingUpdateData.totalAmount = amount;

        const paymentRef = doc(collection(firestore, 'payments'));
        const paymentData: Partial<Payment> = {
            id: paymentRef.id,
            bookingId: booking.id,
            guestName: booking.guestName,
            guestEmail: booking.guestEmail || null,
            roomNumber: finalRoomNumber,
            amount: amount,
            paymentMethod: paymentMethod as any,
            status: 'Paid',
            transactionDate: new Date(),
            bookingDetails: {
              ...booking,
              ...bookingUpdateData,
              discountType: booking.discountType || null,
              discountValue: booking.discountValue || null,
              discountReason: booking.discountReason || null,
            },
            type: 'Booking',
            createdByUid: user.uid,
            createdByName: userProfile.name,
        };
        batch.set(paymentRef, paymentData);
        paymentRecordForReceipt = paymentData as Payment;
    }

    batch.update(bookingRef, bookingUpdateData);

    const roomRef = doc(firestore, 'rooms', booking.roomId);
    batch.update(roomRef, {
        [`individualRoomStatus.${finalRoomNumber}`]: 'Occupied',
        availableRooms: increment(-1),
        bookedRooms: increment(1)
    });

     // Customer registration logic
    if (booking.guestEmail) {
        const customersRef = collection(firestore, 'customers');
        const q = query(customersRef, where('email', '==', booking.guestEmail), limit(1));
        const customerSnapshot = await getDocs(q);

        let customerId: string;

        if (customerSnapshot.empty) {
            // Create new customer
            const newCustomerRef = doc(collection(firestore, 'customers'));
            customerId = newCustomerRef.id;
            batch.set(newCustomerRef, {
                id: customerId,
                name: booking.guestName,
                email: booking.guestEmail,
                phoneNumber: booking.guestPhoneNumber || null,
                photoURL: booking.guestPhotoURL || null,
                createdAt: serverTimestamp(),
                lastVisit: booking.checkOutDate,
                totalBookings: 1,
                bookingIds: [booking.id],
            });
        } else {
            // Update existing customer
            const existingCustomerDoc = customerSnapshot.docs[0];
            customerId = existingCustomerDoc.id;
            const customerRef = doc(firestore, 'customers', customerId);
            const bookingIds = (existingCustomerDoc.data().bookingIds || []).concat(booking.id);
            batch.update(customerRef, {
                lastVisit: booking.checkOutDate,
                totalBookings: increment(1),
                bookingIds: Array.from(new Set(bookingIds)), // Ensure unique booking IDs
            });
        }
         batch.update(bookingRef, { customerId: customerId });
    }

    try {
      await batch.commit();

      const toastDescription = `${booking.guestName} has checked into Room ${finalRoomNumber}.`;

      toast({
        variant: 'success',
        title: 'Check-in Successful',
        description: toastDescription,
      });

      const finalBookingForReceipt = { ...booking, ...bookingUpdateData, checkInDate: new Date() } as Booking;

      setActionState(prev => ({
        ...prev,
        bookingToReprint: paymentRecordForReceipt ? { ...paymentRecordForReceipt.bookingDetails } : finalBookingForReceipt,
        bookingToCheckIn: null
      }));

      onSuccess();

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to check in.' });
      console.error('Check-in error:', error);
      throw error;
    }
  };

  const handleCheckout = async (booking: Booking) => {
    if (!firestore || !user || !userProfile || !booking.roomNumber || booking.roomNumber === 'N/A') {
      toast({ variant: 'destructive', title: 'Invalid Booking', description: 'Cannot check out a booking without a valid room number.'});
      return;
    }

    const unpaidBillsQuery = query(collection(firestore, `bookings/${booking.id}/bills`), where('paid', '==', false));
    const unpaidBillsSnapshot = await getDocs(unpaidBillsQuery);
    if (!unpaidBillsSnapshot.empty) {
      toast({
        variant: 'destructive',
        title: 'Checkout Blocked',
        description: `This guest has ${unpaidBillsSnapshot.size} unpaid bill(s). Please settle all payments before checking out.`,
        duration: 8000,
      });
      return;
    }

    setActionState(prev => ({ ...prev, bookingToCheckout: booking }));
  };

  const confirmCheckout = async (booking: Booking, staffName: string, notes?: string) => {
    if (!firestore || !user || !userProfile || !booking.roomNumber || booking.roomNumber === 'N/A') {
        throw new Error("Missing required data for checkout.");
    }

    const batch = writeBatch(firestore);
    const actualCheckOutDate = new Date();

    const bookingRef = doc(firestore, 'bookings', booking.id);
    const updateData: Partial<Booking> = {
      status: 'Checked-out',
      actualCheckOutDate: Timestamp.fromDate(actualCheckOutDate),
      checkoutNotes: notes || '',
      checkedOutByUid: user.uid,
      checkedOutByName: staffName,
    };
    batch.update(bookingRef, updateData);

    const roomRef = doc(firestore, 'rooms', booking.roomId);
    batch.update(roomRef, {
      [`individualRoomStatus.${booking.roomNumber}`]: 'Cleaning in Progress',
      bookedRooms: increment(-1),
    });

    const cleaningQueueRef = doc(collection(firestore, 'cleaning-queue'));
    batch.set(cleaningQueueRef, {
      roomId: booking.roomId,
      roomNumber: booking.roomNumber,
      lastGuestName: booking.guestName,
      lastGuestPhotoURL: booking.guestPhotoURL,
      bookingId: booking.id,
      checkedOutAt: Timestamp.fromDate(actualCheckOutDate),
      lastGuestBookingDetails: { ...booking, ...updateData, actualCheckOutDate }
    });

    try {
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Check-out Successful',
        description: `${booking.guestName} has been checked out. Room ${booking.roomNumber} is now in the cleaning queue.`,
      });

      const updatedBooking = { ...booking, ...updateData, actualCheckOutDate: actualCheckOutDate } as Booking;
      setActionState(prev => ({...prev, bookingToCheckout: null, bookingToReprint: updatedBooking }));
      onSuccess();
    } catch (error) {
      console.error('Check-out error:', error);
      throw error;
    }
  };

  const handleCancel = (booking: Booking) => {
    setActionState(prev => ({ ...prev, bookingToCancel: booking }));
  };

  const confirmCancel = async (bookingToCancel: Booking) => {
    if (!firestore || !user || !userProfile) return;

    if (['Active', 'Checked-in'].includes(bookingToCancel.status)) {
      const unpaidBillsQuery = query(collection(firestore, `bookings/${bookingToCancel.id}/bills`), where('paid', '==', false));
      const unpaidBillsSnapshot = await getDocs(unpaidBillsQuery);
      if (!unpaidBillsSnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Cancellation Blocked',
          description: `This guest has ${unpaidBillsSnapshot.size} unpaid bill(s). Please settle all payments before cancelling.`,
          duration: 8000,
        });
        setActionState(prev => ({...prev, bookingToCancel: null}));
        return;
      }
    }

    setActionState(prev => ({ ...prev, isCancelling: true }));
    const batch = writeBatch(firestore);
    const bookingRef = doc(firestore, 'bookings', bookingToCancel.id);

    if (bookingToCancel.status === 'Reserved') {
        batch.update(bookingRef, { status: 'Refunded', cancelledByUid: user.uid, cancelledByName: userProfile.name, cancelledAt: serverTimestamp(), refundedAt: serverTimestamp() });
        toast({ variant: 'success', title: 'Booking Cancelled & Refunded', description: `The pre-paid reservation for ${bookingToCancel.guestName} has been cancelled and refunded.` });
        setActionState(prev => ({...prev, cancellationInvoiceBooking: bookingToCancel}));
    } else if (['Active', 'Checked-in'].includes(bookingToCancel.status) && bookingToCancel.roomNumber && bookingToCancel.roomNumber !== 'N/A') {
        batch.update(bookingRef, { status: 'Refunded', cancelledByUid: user.uid, cancelledByName: userProfile.name, cancelledAt: serverTimestamp(), refundedAt: serverTimestamp() });
        const roomRef = doc(firestore, 'rooms', bookingToCancel.roomId);
        batch.update(roomRef, { bookedRooms: increment(-1), availableRooms: increment(1), [`individualRoomStatus.${bookingToCancel.roomNumber}`]: 'Vacant' });
        toast({ variant: 'success', title: 'Booking Cancelled & Refunded', description: `The booking for ${bookingToCancel.guestName} has been cancelled and refunded.` });
        setActionState(prev => ({...prev, cancellationInvoiceBooking: bookingToCancel}));
    } else { // Unpaid reservation ('Booked')
        batch.update(bookingRef, { status: 'Cancelled', cancelledByUid: user.uid, cancelledByName: userProfile.name, cancelledAt: serverTimestamp() });
        toast({ variant: 'success', title: 'Unpaid Reservation Cancelled', description: `The reservation for ${bookingToCancel.guestName} has been cancelled.` });
    }

    try {
      await batch.commit();
      router.push('/reservations');
      onSuccess();
    } catch (error: any) {
       toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to cancel booking.' });
       console.error('Cancellation error:', error);
       throw error;
    } finally {
      setActionState(prev => ({ ...prev, isCancelling: false, bookingToCancel: null }));
    }
  };

  const handleAddBill = async (booking: Booking, items: BillItem[], total: number) => {
    if (!firestore || !user || !userProfile) return;

    const batch = writeBatch(firestore);

    const billRef = doc(collection(firestore, `bookings/${booking.id}/bills`));
    batch.set(billRef, { items: items.map(item => ({ ...item, billId: billRef.id })), total, bookingId: booking.id, createdAt: serverTimestamp(), createdBy: user.uid, createdByName: userProfile.name || 'Unknown', paid: false });

    const restaurantItems = items.filter(item => !item.isService && !item.id.startsWith('laundry-'));
    if (restaurantItems.length > 0) {
        const orderRef = doc(collection(firestore, 'orders'));
        const orderNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const kitchenOrderData: Partial<Order> = { orderNumber, bookingId: booking.id, guestName: booking.guestName, roomNumber: booking.roomNumber, phoneNumber: booking.guestPhoneNumber || 'N/A', items: restaurantItems, totalPrice: restaurantItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), status: 'Pending', source: 'staff', createdAt: serverTimestamp() };
        batch.set(orderRef, kitchenOrderData);
    }

    // Add logic to also create a HeldSale
    const holdSaleRef = doc(collection(firestore, 'heldSales'));
    const holdSaleData: Partial<HeldSale> = {
      id: holdSaleRef.id,
      name: `Billed to ${booking.guestName} - Room ${booking.roomNumber}`,
      heldAt: serverTimestamp() as any,
      cart: items.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          sellQuantity: i.quantity,
          isService: i.isService,
          // These might not be available but are part of UnifiedItem
          quantity: 0,
          category: 'Billed Items',
          sourceType: i.isService ? 'Service' : 'Stock'
      })),
      customer: { id: booking.id, name: booking.guestName },
      heldByUid: user.uid,
      heldByName: userProfile.name,
      printStatus: 'pending',
    };
    batch.set(holdSaleRef, holdSaleData);

    try {
        await batch.commit();
        toast({ variant: 'success', title: 'Bill Updated', description: `Successfully added charge to the bill for Room ${booking.roomNumber}. ${restaurantItems.length > 0 ? 'Order sent to kitchen.' : ''} An on-hold sale has been created for tracking.` });
        setActionState(prev => ({...prev, bookingToAddBill: null}));
        onSuccess();
    } catch (error) {
        console.error('Error adding bill/order:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add items to the bill or send order to kitchen.' });
    }
  };

  const handlePayBills = async (booking: Booking, paymentMethod: string, paidItems: BillItem[], customAmount?: number) => {
    if (!firestore || !userProfile || !user) return;

    const batch = writeBatch(firestore);
    const paymentRef = doc(collection(firestore, 'payments'));
    const amountToPay = customAmount ?? paidItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const now = new Date();

    const sanitizedBookingDetails = { ...booking, checkInDate: booking.checkInDate || null, checkOutDate: booking.checkOutDate || null, actualCheckOutDate: booking.actualCheckOutDate || null };

    const paymentData: Partial<Payment> = { id: paymentRef.id, bookingId: booking.id, guestName: booking.guestName, guestEmail: booking.guestEmail || null, roomNumber: booking.roomNumber, amount: amountToPay, paymentMethod: paymentMethod as any, status: 'Paid', transactionDate: now, bookingDetails: sanitizedBookingDetails, createdByUid: user.uid, createdByName: userProfile.name, ...(customAmount ? {type: 'Additional Charges'} : { type: 'Additional Charges', items: paidItems.map(({ billId, ...item }) => item) }) };
    batch.set(paymentRef, paymentData);

    if (!customAmount) {
      for (const item of paidItems) {
          const billRef = doc(firestore, `bookings/${booking.id}/bills/${item.billId}`);
          const billDoc = await getDoc(billRef);

          if (billDoc.exists()) {
            const billData = billDoc.data() as Bill;
            const updatedItems = billData.items.map(i => i.id === item.id ? { ...i, paid: true, paymentId: paymentRef.id } : i);
            batch.update(billRef, { items: updatedItems });

            const allPaid = updatedItems.every(i => i.paid);
            if (allPaid) {
              batch.update(billRef, { paid: true, paymentId: paymentRef.id, paymentMethod, paidAt: Timestamp.fromDate(now) });
            }
          }
      }
    }

    try {
      await batch.commit();
      toast({ variant: 'success', title: 'Payment Successful', description: `Successfully processed payment of ${formatCurrency(amountToPay)}.` });
      onSuccess();
    } catch (error) {
      console.error("Error paying bills: ", error);
      toast({ variant: 'destructive', title: 'Payment Failed', description: 'Could not process payment.' });
      throw error;
    } finally {
      setActionState(prev => ({ ...prev, bookingToPayBills: null }));
    }
  };

  const handleToggleCollectPayment = async (booking: Booking, collect: boolean) => {
    if (!firestore) return;
    const bookingRef = doc(firestore, 'bookings', booking.id);
    try {
        await updateDoc(bookingRef, { collectPayment: collect });
        toast({ variant: 'success', title: 'Updated', description: `Payment collection for ${booking.guestName} is now ${collect ? 'ON' : 'OFF'}.` });
        onSuccess();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update payment status.'})
    }
  };

  const handleConfirmMarkAsPaid = async (booking: Booking, paymentMethod: string) => {
    if (!firestore || !user || !userProfile) return;

    const batch = writeBatch(firestore);
    const bookingRef = doc(firestore, 'bookings', booking.id);

    const totalAmount = booking.totalAmount || 0;
    const hasPayment = totalAmount > 0;

    const bookingUpdateData: Partial<Booking> = {
        status: 'Reserved',
        paymentMethod: hasPayment ? (paymentMethod as any) : null
    };
    batch.update(bookingRef, bookingUpdateData);

    if (hasPayment) {
        const paymentRef = doc(collection(firestore, 'payments'));
        const paymentData: Partial<Payment> = {
            id: paymentRef.id,
            bookingId: booking.id,
            guestName: booking.guestName,
            guestEmail: booking.guestEmail || null,
            roomNumber: booking.roomNumber,
            amount: totalAmount,
            paymentMethod: paymentMethod as any,
            status: 'Paid',
            transactionDate: new Date(),
            bookingDetails: { ...booking, ...bookingUpdateData },
            type: 'Booking',
            createdByUid: user.uid,
            createdByName: userProfile.name,
        };
        batch.set(paymentRef, paymentData);
    }

    try {
        await batch.commit();
        toast({
            variant: 'success',
            title: 'Reservation Paid',
            description: `The reservation for ${booking.guestName} has been marked as paid.`
        });
        onSuccess();
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to mark reservation as paid.'
        });
        console.error('Mark as paid error:', error);
        throw error;
    } finally {
        setActionState(prev => ({...prev, bookingToMarkAsPaid: null}));
    }
  };

  const handleUpdateRoomStatus = async (room: { id: string, roomNumber: string }, status: string) => {
    if (!firestore) return;

    const batch = writeBatch(firestore);
    const roomTypeRef = doc(firestore, 'rooms', room.id);

    try {
        const roomTypeDoc = await getDoc(roomTypeRef);
        if (!roomTypeDoc.exists()) throw new Error("Room type not found");
        const roomTypeData = roomTypeDoc.data();
        const wasVacant = !roomTypeData.individualRoomStatus?.[room.roomNumber];

        const updates: { [key: string]: any } = { [`individualRoomStatus.${room.roomNumber}`]: status === 'Vacant' ? null : status };

        if (status === 'Vacant' && !wasVacant) {
            updates.availableRooms = increment(1);
            if (roomTypeData.bookedRooms > 0) updates.bookedRooms = increment(-1);
        } else if (status !== 'Vacant' && wasVacant) {
            if (roomTypeData.availableRooms > 0) updates.availableRooms = increment(-1);
            updates.bookedRooms = increment(1);
        }

        batch.update(roomTypeRef, updates);

        const cleaningQuery = query(collection(firestore, 'cleaning-queue'), where('roomNumber', '==', room.roomNumber), limit(1));
        const cleaningSnapshot = await getDocs(cleaningQuery);
        cleaningSnapshot.forEach(doc => batch.delete(doc.ref));

        const maintenanceQuery = query(collection(firestore, 'maintenance-queue'), where('roomNumber', '==', room.roomNumber), limit(1));
        const maintenanceSnapshot = await getDocs(maintenanceQuery);
        maintenanceSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        toast({ variant: 'success', title: 'Status Updated', description: `Room ${room.roomNumber} is now marked as "${status}".` });
        onSuccess();

    } catch (error) {
        console.error('Update status error:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
        throw error;
    }
  };

  const paymentForReceipt: Payment | null = React.useMemo(() => {
    const { bookingToReprint } = actionState;
    if (!bookingToReprint) return null;
    const isCheckedOut = bookingToReprint.status === 'Checked-out';

    return {
      id: bookingToReprint.bookingId || bookingToReprint.id,
      guestName: bookingToReprint.guestName,
      guestEmail: bookingToReprint.guestEmail || null,
      guestPhotoURL: bookingToReprint.guestPhotoURL,
      roomNumber: bookingToReprint.roomNumber!,
      amount: bookingToReprint.totalAmount || 0,
      paymentMethod: (bookingToReprint as any).paymentMethod as any || 'On-site',
      status: bookingToReprint.status as string,
      transactionDate: getSafeDate(bookingToReprint.checkInDate) || new Date(),
      bookingDetails: bookingToReprint,
      createdByUid: isCheckedOut ? bookingToReprint.checkedOutByUid! : bookingToReprint.createdByUid!,
      createdByName: isCheckedOut ? bookingToReprint.checkedOutByName : bookingToReprint.createdByName,
    };
  }, [actionState.bookingToReprint]);

  return {
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
    confirmCheckout,
    confirmCancel,
    handleBookingSuccess,
    paymentForReceipt,
    handleReprintInvoice,
    handleEdit,
  };
};





