
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBookings } from '@/hooks/use-bookings';
import { useBookingActions } from '@/components/bookings/use-booking-actions';
import { BookingFormFields, createBookingSchema, type BookingFormValues } from '@/components/bookings/booking-form-fields';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { useFirestore } from '@/firebase';
import { doc, collection, writeBatch, serverTimestamp, getDocs, query, where, limit, setDoc, increment } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { useSettings } from '@/contexts/settings-context';
import { differenceInDays, isWithinInterval, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { getSafeDate, uploadImage } from '@/lib/helpers';
import { useRouter } from 'next/navigation';
import { Form } from '@/components/ui/form';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

function CreateBookingPage() {
    const { rooms, allBookings } = useBookings();
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();
    const { user, userProfile } = useUser();
    const firestore = useFirestore();
    const { settings } = useSettings();
    const router = useRouter();

    const allowSameDay = settings?.allowSameDayBooking ?? false;
    const expirationSeconds = settings?.expirationSeconds ?? 0;
    const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;

    const onSuccess = () => {
        toast({
            variant: 'success',
            title: 'Reservation Created!',
            description: `The new reservation has been created successfully.`,
        });
        router.push('/bookings');
    };

    const { handleBookingSuccess } = useBookingActions({ rooms, onSuccess });

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(createBookingSchema(allBookings || [], allowSameDay)),
        defaultValues: {
            guestName: '',
            guestEmail: '',
            guestPhoneNumber: '',
            numberOfGuests: 1,
            bookingType: 'reservation',
        },
    });

    const onSubmit = async (data: BookingFormValues) => {
        if (!firestore || !user || !userProfile) return;
        setIsSaving(true);
        try {
            let guestPhotoUrl = data.guestPhotoUrl;
            if (data.guestPhoto) {
                toast({ title: 'Uploading Guest Photo...' });
                const guestName = data.guestName.replace(/\s+/g, '_');
                const newName = `guest-${guestName}_${Date.now()}`;
                guestPhotoUrl = await uploadImage(data.guestPhoto, imgbbApiKey, newName, expirationSeconds);
            }

            const { roomName, nightlyRate, totalAmount } = (() => {
                const roomType = rooms?.find(r => r.id === data.roomId);
                if (data.checkInDate && data.checkOutDate && roomType) {
                    let nights = differenceInDays(data.checkOutDate, data.checkInDate);
                    if (isSameDay(data.checkInDate, data.checkOutDate)) {
                        nights = allowSameDay ? 0 : 1;
                    } else if (nights < 0) {
                        nights = 0;
                    }
                    const initialAmount = (nights === 0 && allowSameDay) ? roomType.price : nights * (roomType.price || 0);

                    let finalAmount = initialAmount;
                    if (data.discountValue && data.discountValue > 0) {
                        finalAmount = data.discountType === 'percentage'
                            ? initialAmount - (initialAmount * data.discountValue / 100)
                            : initialAmount - data.discountValue;
                    }
                    return { roomName: roomType.name, nightlyRate: roomType.price, totalAmount: finalAmount };
                }
                return { roomName: 'N/A', nightlyRate: 0, totalAmount: 0 };
            })();

            const newBookingRef = doc(collection(firestore, 'bookings'));
            const newBookingId = newBookingRef.id;

            const { guestPhoto, ...restOfData } = data;

            const newBookingData = {
                id: newBookingId,
                bookingId: newBookingId,
                ...restOfData,
                guestPhotoURL: guestPhotoUrl || null,
                checkInDate: Timestamp.fromDate(data.checkInDate),
                checkOutDate: Timestamp.fromDate(data.checkOutDate),
                status: 'Reserved',
                amount: totalAmount,
                totalAmount: totalAmount,
                paymentMethod: data.paymentMethod || null,
                createdAt: serverTimestamp(),
                createdByUid: user.uid,
                createdByName: userProfile.name,
                source: 'staff',
                discountType: data.discountValue ? data.discountType : null,
                discountValue: data.discountValue || null,
                discountReason: data.discountReason || null,
            };

            await setDoc(newBookingRef, newBookingData);

            handleBookingSuccess();

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const formId = "create-booking-page-form";

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/bookings">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create New Booking</h1>
                    <p className="text-muted-foreground">Fill in the details below to create a new reservation or check-in.</p>
                </div>
            </div>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 border rounded-lg bg-card">
                    <BookingFormFields
                        formId={formId}
                        form={form}
                        availableRooms={rooms || []}
                        allBookings={allBookings || []}
                        isRoomPreselected={false}
                    />
                     <div className="flex justify-end mt-6">
                        <Button type="submit" loading={isSaving}>
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            Create Booking
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}

export default withAuth(CreateBookingPage, PagePermission.CREATE_BOOKING);
