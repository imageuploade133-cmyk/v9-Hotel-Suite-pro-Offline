
'use client';

import * as React from 'react';
import { useBooking } from './booking-provider';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Room, BookingType, Customer, BookingFormField } from '@/lib/types';
import { BookingConfirmationContent } from './BookingConfirmationDialog';
import { BookingFormFields, createBookingSchema, type BookingFormValues } from './BookingFormFields';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { ScrollArea } from '../ui/scroll-area';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '../ui/form';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { useSettings } from '@/contexts/settings-context';
import { uploadImage } from '@/lib/helpers';
import { Accommodations } from './Accommodations';
import { set, format } from 'date-fns';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

export function BookingDialog() {
  const { isOpen, closeBooking, room, dateRange: contextDateRange, availableRooms } = useBooking();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [confirmationData, setConfirmationData] = React.useState<any>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { settings } = useSettings();
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(room);

  const bookingFormFieldsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookingFormFields'));
  }, [firestore]);
  const { data: customFieldsData } = useCollection<BookingFormField>(bookingFormFieldsQuery);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(createBookingSchema(customFieldsData || [])),
    defaultValues: {
      guestName: '',
      guestEmail: '',
      guestPhoneNumber: '',
      numberOfGuests: 1,
      dateRange: { from: undefined, to: undefined }
    }
  });

  React.useEffect(() => {
    if(room) {
      setSelectedRoom(room);
    }
  }, [room])

  React.useEffect(() => {
    if (isOpen && !confirmationData) {
      if(room) setSelectedRoom(room);
        form.reset({
            guestName: '',
            guestEmail: '',
            guestPhoneNumber: '',
            numberOfGuests: 1,
            dateRange: contextDateRange || { from: undefined, to: undefined }
        });
    }
  }, [isOpen, confirmationData, contextDateRange, form, room]);

  const onSubmit = async (values: BookingFormValues) => {
    if (!values.dateRange.from || !values.dateRange.to || !selectedRoom) return;

    setIsProcessing(true);

    const bookingId = `WEB-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    setConfirmationData({
        ...values,
        bookingId: bookingId,
        roomName: selectedRoom.name,
        nightlyRate: selectedRoom.price || 0,
        totalAmount: selectedRoom.price, // Will be recalculated
    });

    setIsProcessing(false);
  };

  const handleFinalConfirm = async () => {
    if (!firestore || !confirmationData || !selectedRoom) return;

    setIsProcessing(true);

    const { roomName, nightlyRate, dateRange, guestPhoto, ...guestDetails } = confirmationData;

    try {
        let guestPhotoURL = null;
        if (guestPhoto) {
            toast({ title: 'Uploading Photo...' });
            const photoName = `guest-photo-${Date.now()}`;
            guestPhotoURL = await uploadImage(guestPhoto, settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY, photoName);
        }

        const sanitizedCustomFields = Object.entries(guestDetails.customFields || {}).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, any>);


        const docRef = await addDoc(collection(firestore, 'bookings'), {
            ...guestDetails,
            customFields: sanitizedCustomFields,
            guestPhotoURL: guestPhotoURL,
            roomId: selectedRoom?.id,
            roomNumber: 'N/A', // Assigned at check-in
            status: 'Reserved', // Marked as paid because guest confirmed payment
            amount: nightlyRate,
            totalAmount: nightlyRate,
            createdAt: serverTimestamp(),
            source: 'website',
            paymentMethod: 'Bank Transfer',
            checkInDate: dateRange.from,
            checkOutDate: dateRange.to
        });

        // Send WhatsApp notification if enabled
        if (settings?.enableReservationAlerts && settings.reservationAlertPhoneNumber) {
            const message = `
*New Website Reservation!*

*Guest:* ${guestDetails.guestName}
*Room:* ${roomName}
*Check-in:* ${format(dateRange.from, 'PPP')}
*Check-out:* ${format(dateRange.to, 'PPP')}
*Booking ID:* ${confirmationData.bookingId}

Please confirm payment in the dashboard.
            `.trim();

            await sendWhatsAppMessage({
                phone: settings.reservationAlertPhoneNumber,
                message: message,
            });
        }

        toast({
          title: "Reservation Request Sent!",
          description: `Your booking ID is ${confirmationData.bookingId}. We've received your request and will confirm via email shortly.`,
          duration: 10000,
        });

        handleClose();
        router.push(`/booking-confirmation/${docRef.id}`);

    } catch(e: any) {
        console.error("Booking failed:", e);
        toast({
            variant: 'destructive',
            title: 'Booking Failed',
            description: e.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setConfirmationData(null);
    setSelectedRoom(null);
    closeBooking();
  }

  const formId = `booking-form-${room?.id || 'new'}`;

  const dialogTitle = confirmationData ? "Confirm Your Reservation" : selectedRoom ? `Book Your Stay: ${selectedRoom.name}` : "Check Room Availability";
  const dialogDescription = confirmationData ? "Review your booking details below. Click 'Confirm Reservation' to finalize your request." : selectedRoom ? "Complete your reservation details below. We can't wait to host you!" : "Select an available room to proceed.";

  return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()} shouldScaleBackground>
        <DrawerContent className="h-[95vh] outline-none">
            <DrawerHeader className="text-left">
                <DrawerTitle>{dialogTitle}</DrawerTitle>
                <DrawerDescription>{dialogDescription}</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              {confirmationData ? (
                  <div className="px-4 flex-1">
                      <BookingConfirmationContent
                          bookingData={confirmationData}
                          onBack={() => setConfirmationData(null)}
                          onConfirm={handleFinalConfirm}
                          isProcessing={isProcessing}
                      />
                  </div>
              ) : selectedRoom ? (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                        <div className="px-4 flex-1">
                            <BookingFormFields form={form} room={selectedRoom} />
                        </div>
                        <DrawerFooter className="pt-4 border-t sticky bottom-0 bg-background z-10">
                            <Button type="submit" loading={isProcessing}>
                                Continue
                            </Button>
                            <DrawerClose asChild>
                                <Button variant="ghost" disabled={isProcessing} type="button">Cancel</Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </form>
                </Form>
              ) : (
                <div className="px-4 flex-1">
                    <Accommodations data={availableRooms || undefined} />
                </div>
              )}
            </div>
        </DrawerContent>
      </Drawer>
  );
}
