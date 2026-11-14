
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
import { commitLocalFirstMutations, pushLanMutation } from '@/lib/lan-sync/sync-helper';
import { logAuditEvent } from '@/lib/audit-log';


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
    const existingBookingPayments = await getDocs(query(
      collection(firestore, 'payments'),
      where('bookingId', '==', booking.id)
    ));
    const confirmedBookingPayment = existingBookingPayments.docs.find(paymentDoc => {
      const payment = paymentDoc.data() as Payment;
      return payment.status === 'Paid' && payment.type === 'Booking' && Number(payment.amount || 0) > 0;
    });
    const isPaidReservation = !!confirmedBookingPayment;

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

    if (confirmedBookingPayment) {
        const confirmedPaymentData = confirmedBookingPayment.data() as Payment;
        bookingUpdateData.paymentId = confirmedBookingPayment.id;
        if (!booking.paymentMethod && confirmedPaymentData.paymentMethod) {
            bookingUpdateData.paymentMethod = confirmedPaymentData.paymentMethod;
        }
    }

    if (!isPaidReservation) {
        if (!paymentMethod || !Number.isFinite(amount) || Number(amount) <= 0) {
          toast({ variant: 'destructive', title: 'Payment Required', description: 'Select a payment method and enter a valid reservation payment before checking in.' });
          throw new Error('A valid payment is required to check in this unpaid reservation.');
        }
        bookingUpdateData.paymentMethod = paymentMethod as any;
        bookingUpdateData.totalAmount = amount;

        const paymentRef = doc(firestore, 'payments', `booking-payment-${booking.id}`);
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
              paymentId: paymentRef.id,
              discountType: booking.discountType || null,
              discountValue: booking.discountValue || null,
              discountReason: booking.discountReason || null,
            },
            type: 'Booking',
            createdByUid: user.uid,
            createdByName: userProfile.name,
        };
        batch.set(paymentRef, paymentData);
        bookingUpdateData.paymentId = paymentRef.id;
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
      void logAuditEvent(firestore, {
        action: 'Check-in', module: 'Bookings', entityType: 'Booking',
        entityId: booking.id, entityName: booking.guestName,
        userId: user.uid, userName: userProfile.name || user.email || 'Unknown user',
        userEmail: userProfile.email || user.email || '', userRole: userProfile.role || '',
        description: `Checked in ${booking.guestName} to room ${finalRoomNumber}`,
        changes: [{ field: 'status', before: booking.status, after: 'Active' }, { field: 'roomNumber', before: booking.roomNumber, after: finalRoomNumber }],
        details: { paymentMethod: paymentMethod || null, amount: amount || 0 },
        collectionName: 'bookings', documentId: booking.id,
      });

      // Broadcast check-in and room occupancy update to all Wi-Fi terminals via SSE
      pushLanMutation('bookings', booking.id, 'update', {
        ...booking,
        ...bookingUpdateData,
        checkInDate: new Date().toISOString(),
      });
      pushLanMutation('rooms', booking.roomId, 'update', {
        [`individualRoomStatus.${finalRoomNumber}`]: 'Occupied',
      });
      if (paymentRecordForReceipt) {
        pushLanMutation('payments', paymentRecordForReceipt.id, 'set', paymentRecordForReceipt as any);
      }

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
      const roomSnapshot = rooms?.find((item) => item.id === booking.roomId);
      const localRoomUpdate = {
        [`individualRoomStatus.${booking.roomNumber}`]: 'Cleaning in Progress',
        ...(roomSnapshot ? {
          bookedRooms: Math.max(0, Number(roomSnapshot.bookedRooms || 0) - 1),
          availableRooms: Number(roomSnapshot.availableRooms || 0),
        } : {}),
        updatedAt: actualCheckOutDate.toISOString(),
      };
      const localBookingUpdate = {
        ...booking,
        ...updateData,
        actualCheckOutDate: actualCheckOutDate.toISOString(),
      };
      const localCleaningQueue = {
        id: cleaningQueueRef.id,
        roomId: booking.roomId,
        roomNumber: booking.roomNumber,
        lastGuestName: booking.guestName,
        lastGuestPhotoURL: booking.guestPhotoURL || null,
        bookingId: booking.id,
        checkedOutAt: actualCheckOutDate.toISOString(),
        lastGuestBookingDetails: localBookingUpdate,
      };
      await commitLocalFirstMutations([
        { collectionName: 'bookings', docId: booking.id, action: 'update', data: localBookingUpdate as any },
        { collectionName: 'rooms', docId: booking.roomId, action: 'update', data: localRoomUpdate },
        { collectionName: 'cleaning-queue', docId: cleaningQueueRef.id, action: 'set', data: localCleaningQueue },
      ], `booking-checkout:${booking.id}:${actualCheckOutDate.getTime()}`, () => batch.commit());

      void logAuditEvent(firestore, {
        action: 'Check-out', module: 'Bookings', entityType: 'Booking',
        entityId: booking.id, entityName: booking.guestName,
        userId: user.uid, userName: userProfile.name || user.email || 'Unknown user',
        userEmail: userProfile.email || user.email || '', userRole: userProfile.role || '',
        description: `Checked out ${booking.guestName} from room ${booking.roomNumber}`,
        changes: [{ field: 'status', before: booking.status, after: 'Checked-out' }],
        details: { roomNumber: booking.roomNumber, staffName, notes: notes || '', checkedOutAt: actualCheckOutDate.toISOString() },
        collectionName: 'bookings', documentId: booking.id,
      });
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
      const cancelledAt = new Date().toISOString();
      const newStatus = bookingToCancel.status === 'Reserved' || ['Active', 'Checked-in'].includes(bookingToCancel.status) ? 'Refunded' : 'Cancelled';
      const localMutations: Array<{ collectionName: string; docId: string; action: 'update'; data: Record<string, unknown> }> = [{
        collectionName: 'bookings',
        docId: bookingToCancel.id,
        action: 'update',
        data: {
          status: newStatus,
          cancelledByUid: user.uid,
          cancelledByName: userProfile.name,
          cancelledAt,
          refundedAt: newStatus === 'Refunded' ? cancelledAt : null,
          updatedAt: cancelledAt,
        },
      }];
      if (['Active', 'Checked-in'].includes(bookingToCancel.status) && bookingToCancel.roomNumber && bookingToCancel.roomNumber !== 'N/A') {
        const roomSnapshot = rooms?.find((item) => item.id === bookingToCancel.roomId);
        localMutations.push({
          collectionName: 'rooms',
          docId: bookingToCancel.roomId,
          action: 'update',
          data: {
            [`individualRoomStatus.${bookingToCancel.roomNumber}`]: 'Vacant',
            ...(roomSnapshot ? {
              bookedRooms: Math.max(0, Number(roomSnapshot.bookedRooms || 0) - 1),
              availableRooms: Number(roomSnapshot.availableRooms || 0) + 1,
            } : {}),
            updatedAt: cancelledAt,
          },
        });
      }
      await commitLocalFirstMutations(
        localMutations,
        `booking-cancel:${bookingToCancel.id}:${cancelledAt}`,
        () => batch.commit()
      );

      void logAuditEvent(firestore, {
        action: 'Cancel', module: 'Reservations', entityType: 'Booking',
        entityId: bookingToCancel.id, entityName: bookingToCancel.guestName,
        userId: user.uid, userName: userProfile.name || user.email || 'Unknown user',
        userEmail: userProfile.email || user.email || '', userRole: userProfile.role || '',
        description: `${newStatus === 'Refunded' ? 'Cancelled and refunded' : 'Cancelled'} booking for ${bookingToCancel.guestName}`,
        changes: [{ field: 'status', before: bookingToCancel.status, after: newStatus }],
        details: { roomNumber: bookingToCancel.roomNumber || '', reason: (bookingToCancel as any).cancellationReason || '' },
        collectionName: 'bookings', documentId: bookingToCancel.id,
      });
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
    if (!firestore || !user || !userProfile) throw new Error('Your session is not ready. Please sign in again and retry.');
    if (!Array.isArray(items) || items.length === 0 || !Number.isFinite(total) || total <= 0 || items.some(item => !Number.isFinite(item.price) || item.price <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      throw new Error('The bill contains invalid items or amounts. Review the cart and try again.');
    }

    const batch = writeBatch(firestore);

    const billRef = doc(collection(firestore, `bookings/${booking.id}/bills`));
    const createdAt = new Date();
    const billData = { items: items.map(item => ({ ...item, billId: billRef.id })), total, bookingId: booking.id, createdAt: serverTimestamp(), createdBy: user.uid, createdByName: userProfile.name || 'Unknown', paid: false };
    batch.set(billRef, billData);

    const restaurantItems = items.filter(item => !item.isService && !item.id.startsWith('laundry-'));
    let createdOrderRef: any = null;
    let createdKitchenOrderData: any = null;
    if (restaurantItems.length > 0) {
        const orderRef = doc(collection(firestore, 'orders'));
        const orderNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const kitchenOrderData: Partial<Order> = { orderNumber, bookingId: booking.id, guestName: booking.guestName, roomNumber: booking.roomNumber, phoneNumber: booking.guestPhoneNumber || 'N/A', items: restaurantItems, totalPrice: restaurantItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), status: 'Pending', source: 'staff', createdAt: serverTimestamp() };
        batch.set(orderRef, kitchenOrderData);
        createdOrderRef = orderRef;
        createdKitchenOrderData = kitchenOrderData;
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
        const localMutations: Array<{ collectionName: string; docId: string; action: 'set'; data: Record<string, unknown> }> = [
          { collectionName: `bookings/${booking.id}/bills`, docId: billRef.id, action: 'set', data: { ...billData, createdAt: createdAt.toISOString() } as any },
          { collectionName: 'heldSales', docId: holdSaleRef.id, action: 'set', data: { ...holdSaleData, heldAt: createdAt.toISOString() } as any },
        ];
        if (createdOrderRef && createdKitchenOrderData) {
          localMutations.push({ collectionName: 'orders', docId: createdOrderRef.id, action: 'set', data: { ...createdKitchenOrderData, id: createdOrderRef.id, createdAt: createdAt.toISOString() } as any });
        }
        await commitLocalFirstMutations(localMutations, `guest-bill-add:${billRef.id}`, () => batch.commit());

        void logAuditEvent(firestore, {
          action: 'Bill', module: 'Bookings', entityType: 'Guest Bill',
          entityId: billRef.id, entityName: `Room ${booking.roomNumber} - ${booking.guestName}`,
          userId: user.uid, userName: userProfile.name || user.email || 'Unknown user',
          userEmail: userProfile.email || user.email || '', userRole: userProfile.role || '',
          description: `Added ${items.length} bill item(s) totalling ${total} for ${booking.guestName}`,
          details: { bookingId: booking.id, roomNumber: booking.roomNumber, total, items: items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })) },
          collectionName: `bookings/${booking.id}/bills`, documentId: billRef.id,
        });
        toast({ variant: 'success', title: 'Bill Updated', description: `Successfully added charge to the bill for Room ${booking.roomNumber}. ${restaurantItems.length > 0 ? 'Order sent to kitchen.' : ''} An on-hold sale has been created for tracking.` });
        setActionState(prev => ({...prev, bookingToAddBill: null}));
        onSuccess();
    } catch (error) {
        console.error('Error adding bill/order:', error);
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to add items to the bill or send order to kitchen.' });
        throw error;
    }
  };

  const handlePayBills = async (booking: Booking, paymentMethod: string, paidItems: BillItem[], customAmount?: number) => {
    if (!firestore || !userProfile || !user) throw new Error('Your session is not ready. Please sign in again and retry.');
    const billsSnapshot = await getDocs(query(collection(firestore, 'bookings/' + booking.id + '/bills'), orderBy('createdAt', 'asc')));
    const currentBills = billsSnapshot.docs.map(snapshot => ({ id: snapshot.id, ref: snapshot.ref, data: snapshot.data() as Bill }));
    const getPaid = (bill: Bill) => Number(bill.paidAmount) || (bill.paid ? Number(bill.total || 0) : 0);
    const validatedPaidItems = customAmount === undefined ? paidItems.map(requestedItem => {
      const bill = currentBills.find(entry => entry.id === requestedItem.billId);
      const storedItem = bill?.data.items.find(item => item.id === requestedItem.id);
      if (!bill || !storedItem || storedItem.paid || requestedItem.quantity !== storedItem.quantity || requestedItem.price !== storedItem.price) {
        throw new Error('A selected bill item has changed or is already paid. Refresh the bill and try again.');
      }
      return { ...storedItem, billId: bill.id };
    }) : [];
    if (customAmount === undefined && validatedPaidItems.length !== paidItems.length) throw new Error('The selected bill items could not be verified.');
    const outstanding = currentBills.reduce((sum, entry) => sum + Math.max(0, Number(entry.data.total || 0) - getPaid(entry.data)), 0);
    const amountToPay = customAmount !== undefined ? customAmount : validatedPaidItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!Number.isFinite(amountToPay) || amountToPay <= 0 || amountToPay > outstanding + 0.005) {
      throw new Error('Payment amount is invalid or exceeds the current outstanding bill balance. Refresh and try again.');
    }
    const now = new Date();
    const batch = writeBatch(firestore);
    const paymentRef = doc(collection(firestore, 'payments'));
    const sanitizedBookingDetails = { ...booking, checkInDate: booking.checkInDate || null, checkOutDate: booking.checkOutDate || null, actualCheckOutDate: booking.actualCheckOutDate || null };
    const paymentData: Partial<Payment> = { id: paymentRef.id, bookingId: booking.id, guestName: booking.guestName, guestEmail: booking.guestEmail || null, roomNumber: booking.roomNumber, amount: amountToPay, paymentMethod: paymentMethod as any, status: 'Paid', transactionDate: now, bookingDetails: sanitizedBookingDetails, createdByUid: user.uid, createdByName: userProfile.name, type: 'Additional Charges', ...(customAmount === undefined ? { items: validatedPaidItems.map(({ billId, ...item }) => item) } : { notes: 'Custom amount allocated against outstanding guest bills' }) };
    batch.set(paymentRef, paymentData);
    const localMutations: Array<{ collectionName: string; docId: string; action: 'set' | 'update'; data: Record<string, unknown> }> = [
      { collectionName: 'payments', docId: paymentRef.id, action: 'set', data: paymentData as any },
    ];
    if (customAmount !== undefined) {
      let remaining = amountToPay;
      for (const entry of currentBills) {
        if (remaining <= 0.005) break;
        const alreadyPaid = getPaid(entry.data);
        const due = Math.max(0, Number(entry.data.total || 0) - alreadyPaid);
        if (due <= 0) continue;
        const allocation = Math.min(due, remaining);
        const nextPaid = Math.min(Number(entry.data.total || 0), alreadyPaid + allocation);
        const fullyPaid = nextPaid >= Number(entry.data.total || 0) - 0.005;
        const nextItems = fullyPaid ? entry.data.items.map(item => ({ ...item, paid: true, paymentId: paymentRef.id })) : entry.data.items;
        batch.update(entry.ref, { paidAmount: nextPaid, paid: fullyPaid, ...(fullyPaid ? { items: nextItems, paymentId: paymentRef.id, paymentMethod, paidAt: Timestamp.fromDate(now) } : {}) });
        localMutations.push({ collectionName: 'bookings/' + booking.id + '/bills', docId: entry.id, action: 'update', data: { paidAmount: nextPaid, paid: fullyPaid, ...(fullyPaid ? { items: nextItems, paymentId: paymentRef.id, paymentMethod, paidAt: now.toISOString() } : {}) } });
        remaining -= allocation;
      }
      if (remaining > 0.005) throw new Error('The bill balance changed while processing. Refresh and retry.');
    } else {
      const selectedByBill = new Map<string, BillItem[]>();
      for (const item of validatedPaidItems) selectedByBill.set(item.billId, [...(selectedByBill.get(item.billId) || []), item]);
      for (const [billId, items] of selectedByBill) {
        const entry = currentBills.find(candidate => candidate.id === billId);
        if (!entry) throw new Error('A selected bill could not be found. Refresh and try again.');
        const itemIds = new Set(items.map(item => item.id));
        const nextItems = entry.data.items.map(item => itemIds.has(item.id) ? { ...item, paid: true, paymentId: paymentRef.id } : item);
        const nextPaid = Math.min(Number(entry.data.total || 0), getPaid(entry.data) + items.reduce((sum, item) => sum + item.price * item.quantity, 0));
        const fullyPaid = nextItems.every(item => item.paid) || nextPaid >= Number(entry.data.total || 0) - 0.005;
        batch.update(entry.ref, { items: fullyPaid ? nextItems.map(item => ({ ...item, paid: true, paymentId: paymentRef.id })) : nextItems, paidAmount: nextPaid, ...(fullyPaid ? { paid: true, paymentId: paymentRef.id, paymentMethod, paidAt: Timestamp.fromDate(now) } : {}) });
        localMutations.push({ collectionName: 'bookings/' + booking.id + '/bills', docId: entry.id, action: 'update', data: { items: fullyPaid ? nextItems.map(item => ({ ...item, paid: true, paymentId: paymentRef.id })) : nextItems, paidAmount: nextPaid, ...(fullyPaid ? { paid: true, paymentId: paymentRef.id, paymentMethod, paidAt: now.toISOString() } : {}) } });
      }
    }
    try {
      await commitLocalFirstMutations(localMutations, 'guest-bill-payment:' + paymentRef.id, () => batch.commit());
      void logAuditEvent(firestore, {
        action: 'Payment', module: 'Payments', entityType: 'Guest Bill Payment',
        entityId: paymentRef.id, entityName: booking.guestName,
        userId: user.uid, userName: userProfile.name || user.email || 'Unknown user',
        userEmail: userProfile.email || user.email || '', userRole: userProfile.role || '',
        description: `Recorded bill payment of ${amountToPay} for ${booking.guestName}`,
        details: { bookingId: booking.id, paymentMethod, amount: amountToPay, billIds: currentBills.map(entry => entry.id) },
        collectionName: 'payments', documentId: paymentRef.id,
      });
      toast({ variant: 'success', title: 'Payment Successful', description: 'Successfully processed payment of ' + formatCurrency(amountToPay) + '.' });
      onSuccess();
    } catch (error) {
      console.error('Error paying bills: ', error);
      toast({ variant: 'destructive', title: 'Payment Failed', description: error instanceof Error ? error.message : 'Could not process payment.' });
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
        pushLanMutation('bookings', booking.id, 'update', { collectPayment: collect });
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

    const totalAmount = Number(booking.totalAmount || booking.amount || 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        toast({ variant: 'destructive', title: 'Cannot Mark as Paid', description: 'This reservation has no valid amount. Update the reservation amount before recording payment.' });
        return;
    }

    const existingPaymentsSnapshot = await getDocs(query(
        collection(firestore, 'payments'),
        where('bookingId', '==', booking.id)
    ));
    const existingPayment = existingPaymentsSnapshot.docs.find(paymentDoc => {
        const payment = paymentDoc.data() as Payment;
        return payment.status === 'Paid' && payment.type === 'Booking' && Number(payment.amount || 0) > 0;
    });

    const bookingUpdateData: Partial<Booking> = {
        status: 'Reserved',
        paymentMethod: existingPayment?.data().paymentMethod || (paymentMethod as any),
        paymentId: existingPayment?.id || undefined,
    };
    const paymentRef = existingPayment
        ? doc(firestore, 'payments', existingPayment.id)
        : doc(firestore, 'payments', `booking-payment-${booking.id}`);
    let paymentData: any = existingPayment?.data() || null;
    if (!existingPayment) {
        paymentData = {
            id: paymentRef.id,
            bookingId: booking.id,
            guestName: booking.guestName,
            guestEmail: booking.guestEmail || null,
            roomNumber: booking.roomNumber,
            amount: totalAmount,
            paymentMethod: paymentMethod as any,
            status: 'Paid',
            transactionDate: new Date(),
            bookingDetails: { ...booking, ...bookingUpdateData, paymentId: paymentRef.id },
            type: 'Booking',
            createdByUid: user.uid,
            createdByName: userProfile.name,
        };
        batch.set(paymentRef, paymentData);
        bookingUpdateData.paymentId = paymentRef.id;
    }
    batch.update(bookingRef, bookingUpdateData);

    try {
        const updatedAt = new Date().toISOString();
        const localMutations: Array<{ collectionName: string; docId: string; action: 'set' | 'update'; data: Record<string, unknown> }> = [{
            collectionName: 'bookings',
            docId: booking.id,
            action: 'update' as const,
            data: {
                status: 'Reserved',
                paymentMethod: bookingUpdateData.paymentMethod || paymentMethod,
                paymentId: bookingUpdateData.paymentId || existingPayment?.id || null,
                updatedAt,
            },
        }];
        if (!existingPayment && paymentRef && paymentData) {
            localMutations.push({
                collectionName: 'payments',
                docId: paymentRef.id,
                action: 'set',
                data: { ...paymentData, id: paymentRef.id } as any,
            });
        }
        await commitLocalFirstMutations(
            localMutations,
            `booking-mark-paid:${booking.id}:${updatedAt}`,
            () => batch.commit()
        );

        void logAuditEvent(firestore, {
          action: 'Payment', module: 'Payments', entityType: 'Booking Payment',
          entityId: booking.id, entityName: booking.guestName,
          userId: user.uid, userName: userProfile.name || user.email || 'Unknown user',
          userEmail: userProfile.email || user.email || '', userRole: userProfile.role || '',
          description: `Marked reservation for ${booking.guestName} as paid`,
          changes: [{ field: 'paymentStatus', before: booking.paymentStatus || 'Unpaid', after: 'Paid' }],
          details: { amount: totalAmount, paymentMethod },
          collectionName: 'payments', documentId: booking.id,
        });
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

        pushLanMutation('rooms', room.id, 'update', {
          [`individualRoomStatus.${room.roomNumber}`]: status === 'Vacant' ? null : status,
        });

        void logAuditEvent(firestore, {
          action: 'Status Change', module: 'Housekeeping', entityType: 'Room',
          entityId: room.id, entityName: room.roomNumber,
          userId: user?.uid || userProfile?.uid || userProfile?.id || '',
          userName: userProfile?.name || user?.email || 'Unknown user',
          userEmail: userProfile?.email || user?.email || '', userRole: userProfile?.role || '',
          description: `Changed room ${room.roomNumber} status to ${status}`,
          changes: [{ field: 'status', before: room.status, after: status }],
          collectionName: 'rooms', documentId: room.id,
        });
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





