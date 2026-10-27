
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';
import type { Room, Booking, BookingType } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, doc, writeBatch, Timestamp, serverTimestamp, getDocs, where, limit, setDoc, increment, updateDoc, addDoc, query } from 'firebase/firestore';
import { differenceInDays, isSameDay } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { getSafeDate, uploadImage } from '@/lib/helpers';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BottomSheet } from '../ui/bottom-sheet';
import { BookingFormFields, createBookingSchema, type BookingFormValues } from './booking-form-fields';
import { useBookings } from '@/hooks/use-bookings';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { format } from 'date-fns';


interface WalkInDialogProps {
  isOpen: boolean;
  room: Room | null;
  onClose: () => void;
  availableRooms?: Room[];
  templateBooking?: Booking | null;
  onSuccess: (newBooking?: Booking) => void;
  initialDateRange?: DateRange;
  initialBookingType?: BookingType;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';


export function WalkInDialog({
  isOpen,
  room,
  onClose,
  availableRooms,
  templateBooking,
  onSuccess,
  initialDateRange,
  initialBookingType,
}: WalkInDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { allBookings } = useBookings();
  const { settings } = useSettings();
  const allowSameDay = settings?.allowSameDayBooking ?? false;

  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;


  const form = useForm<BookingFormValues>({
    resolver: zodResolver(createBookingSchema(allBookings, allowSameDay)),
    defaultValues: {
      guestName: '',
      guestEmail: '',
      guestPhoneNumber: '',
      numberOfGuests: 1,
      bookingType: 'checkin',
      isExpectingGuests: false,
      paymentMethod: '',
      roomId: undefined,
      roomNumber: undefined,
      checkInDate: undefined,
      checkOutDate: undefined,
      discountValue: undefined,
      discountReason: '',
      customFields: {},
      guestPhoto: undefined,
      guestPhotoUrl: '',
    },
  });

   React.useEffect(() => {
    if (isOpen) {
      if (templateBooking) {
        form.reset({
          ...templateBooking,
          bookingType: 'reservation',
          checkInDate: getSafeDate(templateBooking.checkInDate)!,
          checkOutDate: getSafeDate(templateBooking.checkOutDate)!,
          roomId: room?.id,
          roomNumber: (room as any)?.roomNumber,
        });
      } else {
        form.reset({
          guestName: '', guestEmail: '', guestPhoneNumber: '',
          numberOfGuests: 1, bookingType: initialBookingType || 'checkin',
          checkInDate: initialDateRange?.from,
          checkOutDate: initialDateRange?.to,
          roomId: room?.id,
          roomNumber: (room as any)?.roomNumber,
          paymentMethod: '',
          discountValue: undefined,
          discountReason: '',
          customFields: {},
          guestPhoto: undefined,
          guestPhotoUrl: '',
        });
      }
    }
  }, [isOpen, room, templateBooking, initialDateRange, initialBookingType, form]);

  const onSubmit = async (data: BookingFormValues) => {
    if (!firestore || !user || !userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'User or database not available.' });
        return;
    }

    if (!data.roomId || !data.roomNumber) {
        form.setError("roomNumber", { type: "manual", message: "Please select a room type and number before proceeding." });
        return;
    }

    setIsSaving(true);
    try {
        let guestPhotoUrl = data.guestPhotoUrl;
        if (data.guestPhoto) {
            toast({ title: 'Uploading Guest Photo...' });
            const newName = `guest-${data.guestName.replace(/\s+/g, '_')}_${Date.now()}`;
            guestPhotoUrl = await uploadImage(data.guestPhoto, imgbbApiKey, newName, expirationSeconds);
        }

        const selectedRoomType = availableRooms?.find(r => r.id === data.roomId);
        if (!selectedRoomType) throw new Error("Selected room type not found");

        let nights = 0;
        if (data.checkInDate && data.checkOutDate) {
            const diff = differenceInDays(data.checkOutDate, data.checkInDate);
            nights = (diff === 0 && isSameDay(data.checkInDate, data.checkOutDate)) ? 1 : diff;
        }

        let finalAmount = nights * selectedRoomType.price;
        if (data.discountValue) {
            finalAmount = data.discountType === 'percentage'
                ? finalAmount - (finalAmount * data.discountValue / 100)
                : finalAmount - data.discountValue;
        }

        const batch = writeBatch(firestore);

        const { guestPhoto, ...restOfData } = data;

        const bookingCoreData = {
          ...restOfData,
          guestPhotoURL: guestPhotoUrl || null,
          checkInDate: Timestamp.fromDate(data.checkInDate),
          checkOutDate: Timestamp.fromDate(data.checkOutDate),
          totalAmount: finalAmount,
          discountType: data.discountType || null,
          discountValue: data.discountValue || null,
          discountReason: data.discountReason || null,
        };

        let newBooking: Booking | null = null;

        if (isEditMode) { // Editing/reassigning a reservation
            const bookingRef = doc(firestore, 'bookings', templateBooking!.id);
            batch.update(bookingRef, {
                ...bookingCoreData,
                updatedAt: serverTimestamp(),
            });
        } else { // Creating new booking/check-in
            const newBookingRef = doc(collection(firestore, 'bookings'));
            const newBookingId = `BOOK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            const newBookingData = {
                id: newBookingRef.id,
                bookingId: newBookingId,
                ...bookingCoreData,
                status: data.bookingType === 'checkin' ? 'Active' : (data.bookingType === 'reservation-and-pay' ? 'Reserved' : 'Booked'),
                createdAt: serverTimestamp(),
                createdByUid: user.uid,
                createdByName: userProfile.name,
                source: 'staff',
                ...(data.bookingType === 'checkin' && {
                    checkedInAt: serverTimestamp(),
                    checkedInByUid: user.uid,
                    checkedInByName: userProfile.name,
                }),
            };
            batch.set(newBookingRef, newBookingData);

            newBooking = newBookingData as unknown as Booking;

            if (data.bookingType === 'checkin' || data.bookingType === 'reservation-and-pay') {
                const paymentRef = doc(collection(firestore, 'payments'));
                batch.set(paymentRef, {
                    bookingId: newBookingRef.id,
                    amount: finalAmount,
                    paymentMethod: data.paymentMethod,
                    transactionDate: serverTimestamp(),
                    createdByUid: user.uid,
                    createdByName: userProfile.name,
                    status: 'Paid',
                    type: 'Booking'
                });
            }
        }

        await batch.commit();

        if (newBooking && newBooking.source === 'website' && settings?.enableReservationAlerts && settings.reservationAlertPhoneNumber) {
            const message = `
*New Website Reservation!*

*Guest:* ${newBooking.guestName}
*Room:* ${newBooking.roomNumber}
*Check-in:* ${format(getSafeDate(newBooking.checkInDate)!, 'PP')}
*Check-out:* ${format(getSafeDate(newBooking.checkOutDate)!, 'PP')}
*Booking ID:* ${newBooking.bookingId}

Please confirm payment in the dashboard.
            `.trim();

            await sendWhatsAppMessage({
                phone: settings.reservationAlertPhoneNumber,
                message: message,
            });
        }

        toast({ variant: 'success', title: isEditMode ? 'Booking Updated' : 'Booking Created' });
        onSuccess(newBooking || undefined);
        handleClose();

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
        console.error(e);
    } finally {
        setIsSaving(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  }

  const isEditMode = !!templateBooking;
  const isMobile = useIsMobile();

  const formId = `walk-in-form-${room?.id || templateBooking?.id || ''}`;

  const dialogTitle = isEditMode ? 'Reassign Booking' : room ? 'Book / Check-in' : 'New Reservation';
  const dialogDescription = isEditMode ? `Move ${templateBooking?.guestName}'s booking to a new room.` : `For ${room ? `${room.name} - Room ${(room as any).roomNumber}`: 'any available room'}.`;

  const FormContent = (
    <Form {...form}>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <BookingFormFields form={form} availableRooms={availableRooms || []} allBookings={allBookings || []} isRoomPreselected={!!room} formId={formId} />
        </form>
    </Form>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                <div className="pr-1">{FormContent}</div>
            </ScrollArea>
        </Form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form={formId} loading={isSaving} onClick={form.handleSubmit(onSubmit)}>
            {isEditMode ? 'Save Changes' : (form.getValues('bookingType') === 'checkin' ? 'Confirm Check-in' : 'Create Booking')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
