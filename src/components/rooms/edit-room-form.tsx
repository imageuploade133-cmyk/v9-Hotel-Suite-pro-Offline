
'use client';

import * as React from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { BottomSheet } from '../ui/bottom-sheet';
import { RoomFormFields, roomSchema, type RoomFormValues } from './room-form-fields';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import type { Room } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getSafeDate, uploadImage } from '@/lib/helpers';
import { setHours, setMinutes, endOfDay } from 'date-fns';
import { useSettings } from '@/contexts/settings-context';
import { Form } from '../ui/form';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const endOfPromotionDay = (date: Date, checkoutTime: string): Date => {
  try {
    const [hours, minutes] = checkoutTime.split(':').map(Number);
    return setMinutes(setHours(date, hours), minutes);
  } catch {
    return endOfDay(date); // Fallback to end of day if time is invalid
  }
};


interface EditRoomFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onSuccess: () => void;
}

export function EditRoomForm({ open, onOpenChange, room, onSuccess }: EditRoomFormProps) {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const checkoutTime = settings?.checkoutTime || '11:00';
  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: room.name,
      price: room.price,
      capacity: room.capacity || 1,
      totalRooms: room.totalRooms,
      facilities: room.facilities || [],
      images: room.images || [],
      newImageFiles: [],
      roomNumbers: room.roomNumbers?.join(', ') || '',
      promoPrice: room.promoPrice || undefined,
      promoType: room.promoType || 'fixed',
      promoDates: (room.promoStartDate && room.promoEndDate) ? {
          from: getSafeDate(room.promoStartDate)!,
          to: getSafeDate(room.promoEndDate)!,
      } : undefined
    }
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: room.name,
        price: room.price,
        capacity: room.capacity || 1,
        totalRooms: room.totalRooms,
        facilities: room.facilities || [],
        images: room.images || [],
        newImageFiles: [],
        roomNumbers: room.roomNumbers?.join(', ') || '',
        promoPrice: room.promoPrice || undefined,
        promoType: room.promoType || 'fixed',
        promoDates: (room.promoStartDate && room.promoEndDate) ? {
            from: getSafeDate(room.promoStartDate)!,
            to: getSafeDate(room.promoEndDate)!,
        } : undefined
      });
    }
  }, [open, room, form]);

  const onSubmit = async (data: RoomFormValues) => {
    if (!firestore) return;
    setIsLoading(true);

    try {
      let uploadedImageUrls = data.images || [];
      if (data.newImageFiles && data.newImageFiles.length > 0) {
        toast({ title: 'Uploading Images...' });
        const uploadPromises = data.newImageFiles.map(file => {
          const newName = `room-${data.name.replace(/\s+/g, '_')}-${Date.now()}`;
          return uploadImage(file, imgbbApiKey, newName, expirationSeconds);
        });
        const urls = await Promise.all(uploadPromises);
        uploadedImageUrls = [...uploadedImageUrls, ...urls];
      }

      const roomRef = doc(firestore, 'rooms', room.id);
      await updateDoc(roomRef, {
        name: data.name,
        price: data.price,
        capacity: data.capacity,
        totalRooms: data.totalRooms,
        facilities: data.facilities || [],
        images: uploadedImageUrls,
        roomNumbers: data.roomNumbers?.split(',').map(n => n.trim()).filter(Boolean) || [],
        promoPrice: data.promoPrice || null,
        promoType: data.promoPrice ? data.promoType : null,
        promoStartDate: data.promoDates?.from ? Timestamp.fromDate(data.promoDates.from) : null,
        promoEndDate: data.promoDates?.to ? Timestamp.fromDate(endOfPromotionDay(data.promoDates.to, checkoutTime)) : null,
      });

      toast({ variant: 'success', title: 'Room Updated' });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const formId = `edit-room-form-${room.id}`;
  const dialogTitle = `Edit Room: ${room.name}`;
  const dialogDescription = "Update the details for this room.";

  const FormContent = (
     <Form {...form}>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RoomFormFields form={form} isEditMode={true} />
        </form>
    </Form>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <div className="p-4 flex flex-col h-full">
            <div className="mb-4">
                <h2 className="text-lg font-semibold">{dialogTitle}</h2>
                <p className="text-sm text-muted-foreground">{dialogDescription}</p>
            </div>
            <ScrollArea className="-mx-4 flex-1">
                <div className="px-4">
                    {FormContent}
                </div>
            </ScrollArea>
            <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
                <Button type="submit" form={formId} loading={isLoading} disabled={isLoading || !form.formState.isDirty}>Save Changes</Button>
            </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6"><div className="pr-1">{FormContent}</div></ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button type="submit" form={formId} loading={isLoading} disabled={isLoading || !form.formState.isDirty}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
