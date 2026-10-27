
'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DayPicker, DateRange } from 'react-day-picker';
import type { Room, Booking, AdditionalGuest, BookingType, Customer, BookingFormField } from '@/lib/types';
import {
  Loader2,
  User,
  Phone,
  Mail,
  Home,
  Users,
  Upload,
  X,
  PlusCircle,
  Trash2,
  CreditCard,
  BedDouble,
  Camera,
  CalendarCheck,
  Wallet,
  CalendarPlus,
  Hash,
  DollarSign,
  LogOut,
  Info,
  CalendarIcon,
  Percent,
} from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, query, doc, writeBatch, Timestamp, serverTimestamp, getDocs, where, limit, setDoc, increment, updateDoc } from 'firebase/firestore';
import Image from 'next/image';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { isToday, isWithinInterval, startOfDay, isSameDay, format, setHours, setMinutes, setSeconds, isBefore, addDays as dateFnsAddDays, differenceInDays, endOfDay, eachDayOfInterval } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { useDayPicker, type DayProps } from 'react-day-picker';
import { CustomerSearch } from '../customers/customer-search';
import { StayDatesPicker } from './stay-dates-picker';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Textarea } from '../ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CameraCapture } from '../CameraCapture';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BottomSheet } from '../ui/bottom-sheet';

export const createBookingSchema = (allBookings?: Booking[] | null, allowSameDay = false, customFields: BookingFormField[] = []) => {
    const customFieldSchema = customFields.reduce((schema, field) => {
        if (field.isRequired) {
            return schema.extend({
                [field.name]: z.string().min(1, `${field.name} is required.`),
            });
        }
        return schema.extend({
            [field.name]: z.string().optional(),
        });
    }, z.object({}));

    return z.object({
        id: z.string().optional(), // For edit mode
        roomId: z.string().optional(),
        roomNumber: z.string().min(1, 'A room number must be selected.'),
        bookingType: z.enum(['reservation', 'checkin', 'reservation-and-pay']).default('reservation'),
        guestName: z.string().min(1, 'Guest name is required.'),
        guestPhoneNumber: z.string().optional(),
        guestEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
        guestAddress: z.string().optional(),
        guestPhotoUrl: z.string().optional(),
        numberOfGuests: z.coerce.number().min(1, 'At least one guest is required.'),
        paymentMethod: z.string().optional(),
        isExpectingGuests: z.boolean().default(false),
        checkInDate: z.date({ required_error: 'Check-in date is required' }),
        checkOutDate: z.date({ required_error: 'Check-out date is required' }),
        guestPhoto: z.instanceof(File).optional(),
        customFields: customFieldSchema.optional(),
        discountType: z.enum(['percentage', 'amount']).optional(),
        discountValue: z.coerce.number().optional(),
        discountReason: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        // Make paymentMethod required for checkin and reservation-and-pay
        if ((data.bookingType === 'checkin' || data.bookingType === 'reservation-and-pay') && !data.paymentMethod) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['paymentMethod'],
                message: 'Payment method is required for this booking type.',
            });
        }

        const today = startOfDay(new Date());

        if (data.checkInDate && isBefore(data.checkInDate, today) && !isSameDay(data.checkInDate, today)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['checkInDate'],
                message: "Check-in date cannot be in the past.",
            });
        }

        if (data.checkOutDate && isBefore(data.checkOutDate, today)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['checkOutDate'],
                message: "Check-out date cannot be in the past.",
            });
        }

        if (data.checkInDate && data.checkOutDate) {
            if (isSameDay(data.checkInDate, data.checkOutDate) && !allowSameDay) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["checkOutDate"],
                    message: "Check-out cannot be on the same day as check-in.",
                });
            }
            if (isBefore(data.checkOutDate, data.checkInDate)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["checkOutDate"],
                    message: "Check-out date must be after the check-in date.",
                });
            }

            // Check for booking conflicts
            if (data.roomNumber && allBookings) {
                const range = { start: startOfDay(data.checkInDate), end: startOfDay(data.checkOutDate) };

                const conflictingBooking = allBookings.find(booking => {
                    if (booking.roomNumber !== data.roomNumber || (data.id && booking.id === data.id)) return false;

                    const bookingStart = startOfDay(getSafeDate(booking.checkInDate)!);
                    const bookingEnd = startOfDay(getSafeDate(booking.checkOutDate)!);

                    // Check if the new booking range overlaps with an existing booking range
                    const hasDateOverlap = range.start < bookingEnd && range.end > bookingStart;

                    if (!hasDateOverlap) return false;

                    // For check-in: only conflict with active/checked-in bookings
                    if (data.bookingType === 'checkin') {
                        return booking.status === 'Active' || booking.status === 'Checked-in';
                    }

                    // For reservations: conflict with any confirmed booking (active, checked-in, reserved, booked)
                    // This prevents duplicate reservations on the same room and dates
                    return booking.status === 'Active' || booking.status === 'Checked-in' ||
                           booking.status === 'Reserved' || booking.status === 'Booked';
                });

                if (conflictingBooking) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['checkOutDate'],
                        message: `This room is already ${conflictingBooking.status === 'Reserved' || conflictingBooking.status === 'Booked' ? 'reserved' : 'occupied'} for the selected dates (${conflictingBooking.guestName}).`,
                    });
                }
            }
        }
    });
};


export type BookingFormValues = z.infer<ReturnType<typeof createBookingSchema>>;

export function BookingFormFields({
  form,
  availableRooms,
  allBookings,
  isRoomPreselected,
  formId,
}: {
  form: any;
  availableRooms?: Room[];
  allBookings?: Booking[];
  isRoomPreselected: boolean;
  formId: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);

  const { userProfile } = useUser();


  const { toast } = useToast();
  const { settings } = useSettings();
  const firestore = useFirestore();

  const userCurrency = settings?.currency || 'USD';
  const maxFileSize = settings?.maxFileSizeMb ?? 5;
  const allowSameDay = settings?.allowSameDayBooking ?? false;

  const bookingFormFieldsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'bookingFormFields'));
  }, [firestore]);
  const { data: customFieldsData } = useCollection<BookingFormField>(bookingFormFieldsQuery);


  const isExpectingGuests = form.watch('isExpectingGuests');
  const bookingType = form.watch('bookingType');
  const selectedRoomId = form.watch('roomId');
  const selectedRoomNumber = form.watch('roomNumber');
  const checkInDate = form.watch('checkInDate');
  const checkOutDate = form.watch('checkOutDate');
  const discountType = form.watch('discountType');
  const discountValue = form.watch('discountValue');
  const isEditMode = !!form.getValues('id');

  const guestPhoto = form.watch('guestPhoto');
  const guestPhotoUrl = form.watch('guestPhotoUrl');
  const imagePreview = guestPhoto ? URL.createObjectURL(guestPhoto) : guestPhotoUrl;

  const selectedRoomType = React.useMemo(() => {
    return availableRooms?.find(r => r.id === selectedRoomId);
  }, [selectedRoomId, availableRooms]);

  const availableRoomNumbers = React.useMemo(() => {
    if (!selectedRoomType || !selectedRoomType.roomNumbers) return [];

    // Get all room numbers that are NOT vacant (cleaning, maintenance, DND, etc.)
    const nonVacantRoomNumbers = new Set<string>();
    if (selectedRoomType.individualRoomStatus) {
      Object.entries(selectedRoomType.individualRoomStatus).forEach(([roomNumber, status]) => {
        if (status && status.toLowerCase() !== 'vacant') {
          nonVacantRoomNumbers.add(roomNumber);
        }
      });
    }

    // Get rooms with active bookings on the selected dates
    const roomsWithActiveBookings = new Set<string>();
    if (checkInDate && checkOutDate && allBookings) {
      const range = { start: startOfDay(checkInDate), end: startOfDay(checkOutDate) };

      allBookings.forEach(booking => {
        // Only consider active/checked-in bookings and other reserved bookings
        if (booking.status === 'Active' || booking.status === 'Checked-in' || booking.status === 'Reserved' || booking.status === 'Booked') {
          const bookingStart = startOfDay(getSafeDate(booking.checkInDate)!);
          const bookingEnd = startOfDay(getSafeDate(booking.checkOutDate)!);

          // Check if the new booking range overlaps with an existing booking
          if (range.start < bookingEnd && range.end > bookingStart) {
            // For the same room type, mark the room number as having an active booking
            if (booking.roomId === selectedRoomType.id) {
              roomsWithActiveBookings.add(booking.roomNumber);
            }
          }
        }
      });
    }

    // For check-in, only show rooms that are:
    // 1. Vacant (not cleaning, maintenance, DND, etc.)
    // 2. Don't have any active bookings on the selected dates
    if (bookingType === 'checkin' && !isEditMode) {
      return selectedRoomType.roomNumbers.filter(roomNum => {
        const isVacant = !nonVacantRoomNumbers.has(roomNum);
        const hasNoActiveBooking = !roomsWithActiveBookings.has(roomNum);
        return isVacant && hasNoActiveBooking;
      });
    }

    // For reservations, show all rooms but exclude rooms with active/checked-in bookings
    // Reservations can be made even if room is in cleaning/maintenance,
    // but not if there's already a guest checked in
    if ((bookingType === 'reservation' || bookingType === 'reservation-and-pay') && !isEditMode) {
      return selectedRoomType.roomNumbers.filter(roomNum => {
        // Only exclude rooms with active bookings, allow if just cleaning/maintenance
        const hasActiveGuestBooking = (() => {
          if (!checkInDate || !checkOutDate || !allBookings) return false;
          const range = { start: startOfDay(checkInDate), end: startOfDay(checkOutDate) };

          return allBookings.some(booking => {
            if (booking.roomNumber !== roomNum) return false;
            if (booking.roomId !== selectedRoomType.id) return false;
            // Only block if there's an active/checked-in booking (not just reserved)
            if (booking.status !== 'Active' && booking.status !== 'Checked-in') return false;

            const bookingStart = startOfDay(getSafeDate(booking.checkInDate)!);
            const bookingEnd = startOfDay(getSafeDate(booking.checkOutDate)!);
            return range.start < bookingEnd && range.end > bookingStart;
          });
        })();

        return !hasActiveGuestBooking;
      });
    }

    // For edit mode, show all rooms
    return selectedRoomType.roomNumbers;

  }, [selectedRoomType, bookingType, isEditMode, checkInDate, checkOutDate, allBookings]);

  // Clear room selection if dates change and the room becomes unavailable
  React.useEffect(() => {
    if (selectedRoomNumber && checkInDate && checkOutDate && selectedRoomType) {
      const isRoomAvailable = availableRoomNumbers.includes(selectedRoomNumber);
      if (!isRoomAvailable) {
        form.setValue('roomNumber', '', { shouldValidate: true });
        toast({
          variant: 'default',
          title: 'Room Unavailable',
          description: 'The previously selected room is no longer available for the new dates.',
        });
      }
    }
  }, [checkInDate, checkOutDate, bookingType, availableRoomNumbers, selectedRoomNumber, selectedRoomType, form, toast]);

  const { totalNights, totalAmount, promoApplied, originalAmount, discountAmount } = React.useMemo(() => {
    if (checkInDate && checkOutDate && selectedRoomType) {
        let nights = differenceInDays(checkOutDate, checkInDate);

        if (nights === 0 && isSameDay(checkInDate, checkOutDate)) {
          nights = allowSameDay ? 0 : 1;
        } else if (nights < 0) {
          nights = 0;
        } else {
          nights = Math.max(1, nights);
        }

        const promoStartDate = getSafeDate(selectedRoomType.promoStartDate);
        const promoEndDate = getSafeDate(selectedRoomType.promoEndDate);
        const isPromoActive = promoStartDate && promoEndDate ? isWithinInterval(new Date(), { start: startOfDay(promoStartDate), end: endOfDay(promoEndDate) }) : false;

        let pricePerNight = selectedRoomType.price;
        let promo = false;

        if (isPromoActive && selectedRoomType.promoPrice) {
            promo = true;
            if (selectedRoomType.promoType === 'fixed') {
                pricePerNight = selectedRoomType.promoPrice;
            } else { // percentage
                pricePerNight = selectedRoomType.price - (selectedRoomType.price * (selectedRoomType.promoPrice / 100));
            }
        }

        const initialAmount = (nights === 0 && allowSameDay) ? pricePerNight : nights * pricePerNight;

        let finalAmount = initialAmount;
        let appliedDiscount = 0;
        if (discountValue && discountValue > 0) {
            if (discountType === 'percentage') {
                appliedDiscount = (initialAmount * discountValue) / 100;
                finalAmount = initialAmount - appliedDiscount;
            } else { // amount
                appliedDiscount = discountValue;
                finalAmount = initialAmount - discountValue;
            }
        }

        return { totalNights: (nights === 0 && allowSameDay) ? 1 : nights, totalAmount: finalAmount, promoApplied: promo, originalAmount: initialAmount, discountAmount: appliedDiscount };
    }
    return { totalNights: 0, totalAmount: 0, promoApplied: false, originalAmount: 0, discountAmount: 0 };
  }, [checkInDate, checkOutDate, selectedRoomType, allowSameDay, discountType, discountValue]);


  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(value);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'additionalGuests',
  });

  const additionalFileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleAdditionalFileSelect = (files: FileList | null, index: number) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: `${file.name} is larger than the allowed ${maxFileSize}MB.`
        });
        return;
      }
      form.setValue(`additionalGuests.${index}.photo`, file, { shouldDirty: true });
      const currentGuest = form.getValues().additionalGuests[index];
      currentGuest.photoURL = URL.createObjectURL(file);
      form.setValue('additionalGuests', [...form.getValues().additionalGuests]);
    }
  };

  const removeAdditionalImage = (index: number) => {
    form.setValue(`additionalGuests.${index}.photo`, undefined, { shouldDirty: true });
    const currentGuest = form.getValues().additionalGuests[index];
    currentGuest.photoURL = undefined;
    form.setValue('additionalGuests', [...form.getValues().additionalGuests]);
    if (additionalFileInputRefs.current[index]) {
      additionalFileInputRefs.current[index]!.value = '';
    }
  };

  const handleCustomerSelect = (customer: Customer | null) => {
    if (customer) {
        form.setValue('guestName', customer.name, { shouldDirty: true });
        form.setValue('guestEmail', customer.email || '', { shouldDirty: true });
        form.setValue('guestPhoneNumber', customer.phoneNumber || '', { shouldDirty: true });
        form.setValue('guestPhotoUrl', customer.photoURL, { shouldDirty: true });
        form.setValue('guestPhoto', undefined);

        // Pre-fill custom fields
        customFieldsData?.forEach(field => {
            if (field.prefillFromCustomer && customer.customFields?.[field.name]) {
                form.setValue(`customFields.${field.name}`, customer.customFields[field.name], { shouldDirty: true });
            }
        });

    } else {
        form.setValue('guestName', '', { shouldDirty: true });
        form.setValue('guestEmail', '', { shouldDirty: true });
        form.setValue('guestPhoneNumber', '', { shouldDirty: true });
        form.setValue('guestPhotoUrl', '', { shouldDirty: true });
    }
  };


  const paymentMethodsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentMethods'));
  }, [firestore]);
  const { data: paymentMethods } = useCollection(paymentMethodsQuery);

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: `${file.name} is larger than the allowed ${maxFileSize}MB.`,
        });
        return;
      }
      form.setValue('guestPhoto', file, { shouldDirty: true });
      form.setValue('guestPhotoUrl', '', { shouldDirty: true }); // Clear existing URL if a new file is uploaded
    }
  };

  const handleRemoveImage = () => {
    form.setValue('guestPhoto', undefined);
    form.setValue('guestPhotoUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
  };

  const disabledDates = React.useMemo(() => {
    if (!selectedRoomNumber || !allBookings) return [];

    const roomBookings = allBookings.filter(
      booking =>
        booking.roomNumber === selectedRoomNumber &&
        (isEditMode ? booking.id !== form.getValues().id : true) &&
        (booking.status === 'Active' || booking.status === 'Checked-in' || booking.status === 'Booked' || booking.status === 'Reserved')
    );

    let dates: { from: Date; to: Date; status: string }[] = [];
    roomBookings.forEach(booking => {
        const start = getSafeDate(booking.checkInDate)!;
        const end = getSafeDate(booking.checkOutDate)!;
        if (start && end) {
            dates.push({ from: start, to: end, status: booking.status });
        }
    });
    return dates;
  }, [selectedRoomNumber, allBookings, isEditMode, form]);


  const noVacantRooms = selectedRoomType ? selectedRoomType.availableRooms === 0 : false;
  const todayString = new Date().toISOString().split('T')[0];

  return (
    <>
      <div id={formId} className="space-y-4">
        <div className="space-y-2">
            <FormLabel>By</FormLabel>
            <Input value={userProfile?.name || 'Loading...'} disabled />
        </div>
        <CustomerSearch onSelectCustomer={handleCustomerSelect} />
        <Separator />

        <FormField
          control={form.control}
          name="bookingType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Booking Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <FormItem>
                    <FormControl>
                      <RadioGroupItem value="reservation" id="reservation" className="sr-only peer" />
                    </FormControl>
                    <FormLabel
                      htmlFor="reservation"
                      className={cn(
                        "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 cursor-pointer transition-colors",
                        "primary-hover peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-data-[state=checked]:font-semibold"
                      )}
                    >
                      <CalendarCheck className="mb-3 h-6 w-6" />
                      Unpaid Reservation
                    </FormLabel>
                  </FormItem>
                   <FormItem>
                    <FormControl>
                      <RadioGroupItem value="reservation-and-pay" id="reservation-and-pay" className="sr-only peer" />
                    </FormControl>
                    <FormLabel
                      htmlFor="reservation-and-pay"
                       className={cn(
                        "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 cursor-pointer transition-colors",
                        "primary-hover peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-data-[state=checked]:font-semibold"
                      )}
                    >
                      <CalendarPlus className="mb-3 h-6 w-6" />
                      Paid Reservation
                    </FormLabel>
                  </FormItem>
                  <FormItem>

                      <Tooltip>
                        <TooltipTrigger asChild>
                           <div className={cn(noVacantRooms && "cursor-not-allowed")}>
                              <FormControl>
                                <RadioGroupItem value="checkin" id="checkin" className="sr-only peer" disabled={noVacantRooms} />
                              </FormControl>
                              <FormLabel
                                htmlFor="checkin"
                                className={cn(
                                  "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 transition-colors",
                                  noVacantRooms ? "cursor-not-allowed opacity-50" : "cursor-pointer primary-hover",
                                  "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-data-[state=checked]:font-semibold"
                                )}
                              >
                                <Wallet className="mb-3 h-6 w-6" />
                                Check-in Today
                              </FormLabel>
                           </div>
                        </TooltipTrigger>
                        {noVacantRooms && (
                          <TooltipContent>
                            <p>No vacant rooms available for this room type.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>

                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {availableRooms && (
          <FormField
            control={form.control}
            name="roomId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select a Room Type</FormLabel>
                <Select
                  onValueChange={(value) => {
                    // Check if dates are selected first
                    if (!checkInDate || !checkOutDate) {
                      toast({
                        variant: 'destructive',
                        title: 'Select Dates First',
                        description: 'Please select check-in and check-out dates before selecting a room type.',
                      });
                      return;
                    }
                    field.onChange(value);
                  }}
                  defaultValue={field.value}
                  disabled={isRoomPreselected}
                >
                  <FormControl>
                    <SelectTrigger
                      className={(!checkInDate || !checkOutDate) && !isRoomPreselected ? "border-yellow-500 bg-yellow-50/50" : ""}
                    >
                        <div className="flex items-center gap-2">
                           <BedDouble className="h-4 w-4 text-muted-foreground" />
                           <SelectValue placeholder={!checkInDate || !checkOutDate ? "Select dates first" : "Choose a room type"} />
                        </div>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableRooms.map((r) => (
                      <SelectItem
                        key={r.id}
                        value={r.id}
                        disabled={!checkInDate || !checkOutDate}
                        onClick={() => {
                          if (!checkInDate || !checkOutDate) {
                            toast({
                              variant: 'destructive',
                              title: 'Select Dates First',
                              description: 'Please select check-in and check-out dates before selecting a room type.',
                            });
                          }
                        }}
                      >
                        {r.name} ({r.availableRooms || 0} available) -{' '}
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: userCurrency,
                        }).format(r.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!checkInDate || !checkOutDate) && !isRoomPreselected && (
                  <p className="text-sm font-medium text-yellow-600">
                    Please select check-in and check-out dates first.
                  </p>
                )}
                 <FormMessage />
                {form.formState.errors.roomId && !selectedRoomId && (
                  <p className="text-sm font-medium text-destructive">
                    Please select a room type to continue.
                  </p>
                )}
              </FormItem>
            )}
          />
        )}
        {selectedRoomType && (
             <FormField
                control={form.control}
                name="roomNumber"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Select a Room Number</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!checkInDate || !checkOutDate}
                    >
                        <FormControl>
                            <SelectTrigger
                              className={(!checkInDate || !checkOutDate) ? "border-yellow-500 bg-yellow-50/50" : ""}
                            >
                                <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder={
                                  !checkInDate || !checkOutDate
                                    ? "Select dates first"
                                    : availableRoomNumbers.length === 0
                                      ? "No rooms available"
                                      : "Choose a room number"
                                } />
                                </div>
                            </SelectTrigger>
                        </FormControl>
                         <SelectContent>
                           {availableRoomNumbers.length === 0 ? (
                             <SelectItem value="none" disabled>
                               {bookingType === 'checkin'
                                 ? "No vacant rooms available for these dates"
                                 : "No rooms available for these dates"
                               }
                             </SelectItem>
                           ) : (
                             availableRoomNumbers.map((roomNum) => (
                              <SelectItem key={roomNum} value={roomNum}>
                                  Room {roomNum}
                              </SelectItem>
                             ))
                           )}
                        </SelectContent>
                    </Select>
                    {selectedRoomType && (!checkInDate || !checkOutDate) && (
                      <p className="text-sm font-medium text-yellow-600">
                        Please select dates to see available rooms.
                      </p>
                    )}
                    {selectedRoomType && checkInDate && checkOutDate && availableRoomNumbers.length === 0 && (
                      <p className="text-sm font-medium text-destructive">
                        {bookingType === 'checkin'
                          ? "No vacant rooms available for the selected dates. Try a different date range or room type."
                          : "All rooms are reserved/occupied for the selected dates. Try a different date range or room type."
                        }
                      </p>
                    )}
                    <FormMessage />
                </FormItem>
                )}
            />
        )}
       </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Check-in Date</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(e.target.valueAsDate)}
                            min={todayString}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="checkOutDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Check-out Date</FormLabel>
                        <FormControl>
                        <Input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(e.target.valueAsDate)}
                            min={checkInDate ? format(dateFnsAddDays(checkInDate, 1), 'yyyy-MM-dd') : todayString}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        {/* Date Availability Information */}
        {checkInDate && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <h4 className="font-semibold text-sm">Date Availability Information</h4>
            </div>

            {selectedRoomNumber && selectedRoomType ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Room Availability for {format(checkInDate, 'PPP')}:</p>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1">
                      <span className="text-muted-foreground">Selected Room:</span>
                      <span className="ml-2 font-medium">Room {selectedRoomNumber} ({selectedRoomType.name})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1">
                      <span className="text-muted-foreground">Available Rooms:</span>
                      <span className="ml-2 font-medium">{selectedRoomType.availableRooms || 0} of {selectedRoomType.roomNumbers?.length || 0}</span>
                      <span className={cn(
                        "ml-2 text-xs px-2 py-0.5 rounded-full font-medium",
                        selectedRoomType.availableRooms === 0
                          ? "bg-red-100 text-red-700"
                          : selectedRoomType.availableRooms <= (selectedRoomType.roomNumbers?.length || 0) / 3
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      )}>
                        {selectedRoomType.availableRooms === 0
                          ? "Fully Booked"
                          : selectedRoomType.availableRooms <= (selectedRoomType.roomNumbers?.length || 0) / 3
                          ? "Limited Availability"
                          : "Good Availability"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Show existing bookings on this date */}
                {allBookings && allBookings.length > 0 && (() => {
                  const selectedDateBookings = allBookings.filter(booking => {
                    const bookingCheckIn = getSafeDate(booking.checkInDate);
                    const bookingCheckOut = getSafeDate(booking.checkOutDate);
                    if (!bookingCheckIn || !bookingCheckOut) return false;

                    const isSelectedDate = isSameDay(checkInDate, bookingCheckIn) ||
                                          isSameDay(checkInDate, bookingCheckOut) ||
                                          (isWithinInterval(checkInDate, {
                                            start: startOfDay(bookingCheckIn),
                                            end: endOfDay(bookingCheckOut)
                                          }));

                    return isSelectedDate && (
                      booking.status === 'Active' ||
                      booking.status === 'Checked-in' ||
                      booking.status === 'Booked' ||
                      booking.status === 'Reserved'
                    );
                  });

                  if (selectedDateBookings.length === 0) {
                    return (
                      <div className="text-sm text-green-600 flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4" />
                        <span>No bookings found on this date. All rooms are available!</span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Active Guests & Reservations on {format(checkInDate, 'PPP')}:</p>
                      <ScrollArea className="max-h-48">
                        <div className="space-y-2">
                          {selectedDateBookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between p-2 rounded-md bg-background border text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  {booking.guestPhotoURL ? (
                                    <Image
                                      src={booking.guestPhotoURL}
                                      alt={booking.guestName}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <AvatarFallback>{getInitials(booking.guestName)}</AvatarFallback>
                                  )}
                                </Avatar>
                                <div className="space-y-0.5">
                                  <p className="font-medium">{booking.guestName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Room {booking.roomNumber} · {booking.status}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <p>{format(getSafeDate(booking.checkInDate)!, 'MMM dd')}</p>
                                <p>to {format(getSafeDate(booking.checkOutDate)!, 'MMM dd')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="text-xs text-muted-foreground mt-2">
                        {selectedDateBookings.length} booking{selectedDateBookings.length !== 1 ? 's' : ''} active on this date
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Please select a room type and room number to see availability information.
              </div>
            )}
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="link" className="p-0 h-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Discount
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
                <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Discount Type</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4">
                                <FormItem><FormControl><RadioGroupItem value="percentage" /></FormControl><FormLabel className="font-normal ml-2">Percentage (%)</FormLabel></FormItem>
                                <FormItem><FormControl><RadioGroupItem value="amount" /></FormControl><FormLabel className="font-normal ml-2">Fixed Amount</FormLabel></FormItem>
                            </RadioGroup>
                        </FormControl>
                        </FormItem>
                    )}
                />
                <FormField control={form.control} name="discountValue" render={({ field }) => (
                    <FormItem><FormLabel>Discount Value</FormLabel>
                        <div className="relative">
                            {discountType === 'amount' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                            <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} placeholder={discountType === 'percentage' ? 'e.g., 20' : 'e.g., 120'} className={cn(discountType === 'amount' && "pl-10")}/></FormControl>
                            {discountType === 'percentage' && <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="discountReason" render={({ field }) => (
                    <FormItem><FormLabel>Reason for Discount</FormLabel><FormControl><Textarea {...field} value={field.value || ''} placeholder="e.g., Long stay, special offer" /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {totalNights > 0 && (
          <div className="rounded-md border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Nights</span>
                <span className="font-bold">{totalNights}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className={cn(promoApplied || discountAmount > 0 ? "line-through" : "")}>{formatCurrency(originalAmount)}</span>
              </div>
              {promoApplied && <div className="flex items-center justify-between text-sm text-blue-600"><span >Promotion Applied</span><span>-{formatCurrency(originalAmount - totalAmount - discountAmount)}</span></div>}
              {discountAmount > 0 && <div className="flex items-center justify-between text-sm text-blue-600"><span >Discount Applied</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <Separator />
               <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
          </div>
        )}
        <FormField
          control={form.control}
          name="guestName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl>
                  <Input
                    placeholder="e.g., John Doe"
                    className="pl-10"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="guestPhoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="e.g., +1 234 567 890"
                      className="pl-10"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="e.g., john.doe@example.com"
                      className="pl-10"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="numberOfGuests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Guests</FormLabel>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g., 2"
                      className="pl-10"
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {(bookingType === 'checkin' || bookingType === 'reservation-and-pay') && (
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method <span className="text-destructive">*</span></FormLabel>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Select a payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods?.map((method: any) => (
                          <SelectItem key={method.id} value={method.name}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {customFieldsData && customFieldsData.map((field: any) => {
             if (!field.isRequired && !form.formState.isDirty) return null;
             return (
                 <FormField
                    key={field.id}
                    control={form.control}
                    name={`customFields.${field.name}`}
                    render={({ field: formField }) => (
                    <FormItem>
                        <FormLabel>{field.name}{field.isRequired && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl>
                        <Input placeholder={`Enter ${field.name.toLowerCase()}`} {...formField} value={formField.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )
        })}

        <FormField
          control={form.control}
          name="isExpectingGuests"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Expecting other guests?</FormLabel>
              </div>
            </FormItem>
          )}
        />

        {isExpectingGuests && (
          <>
            <Separator />
            <div className="space-y-4">
              <FormLabel>Additional Guests</FormLabel>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="relative flex items-start gap-4 rounded-md border p-3"
                >
                    <div className="flex flex-col items-center gap-2">
                        <Avatar className="h-16 w-16">
                            {form.watch(`additionalGuests.${index}.photoURL`) ? (
                                <Image src={form.watch(`additionalGuests.${index}.photoURL`)} alt="Guest" fill className="object-cover" />
                            ) : (
                                <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                            )}
                        </Avatar>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => additionalFileInputRefs.current[index]?.click()}>
                            <Camera className="mr-2 h-3 w-3" />
                            Upload
                        </Button>
                        <Input
                            type="file"
                            className="hidden"
                            ref={el => additionalFileInputRefs.current[index] = el}
                            onChange={e => handleAdditionalFileSelect(e.target.files, index)}
                        />
                         {form.watch(`additionalGuests.${index}.photoURL`) && (
                             <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => removeAdditionalImage(index)}>
                                <X className="h-4 w-4" />
                            </Button>
                         )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <FormField
                        control={form.control}
                        name={`additionalGuests.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Guest Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`additionalGuests.${index}.phoneNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="Phone Number (Optional)"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', phoneNumber: '' })}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Guest
              </Button>
            </div>
          </>
        )}

        <FormItem>
          <FormLabel>Customer Picture</FormLabel>
          {imagePreview ? (
            <div className="group relative mx-auto h-40 w-40">
              <Image
                src={imagePreview}
                alt="Guest preview"
                fill
                style={{ objectFit: 'cover' }}
                className="rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleRemoveImage}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-input hover:border-primary/50'
              }`}
              {...handleDragEvents}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">
                  Click to upload
                </span>{' '}
                or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG up to {maxFileSize}MB
              </p>
            </div>
          )}
          <FormControl>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              className="hidden"
              onChange={e => handleFileSelect(e.target.files)}
            />
          </FormControl>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setIsCameraOpen(true)}>
            <Camera className="mr-2 h-4 w-4" /> Open Camera
          </Button>
          <FormMessage />
        </FormItem>
      </div>
    <CameraCapture
      open={isCameraOpen}
      onOpenChange={setIsCameraOpen}
      onCapture={(file) => {
        form.setValue('guestPhoto', file, { shouldDirty: true });
        form.setValue('guestPhotoUrl', '', { shouldDirty: true });
      }}
    />
    </>
  );
}
