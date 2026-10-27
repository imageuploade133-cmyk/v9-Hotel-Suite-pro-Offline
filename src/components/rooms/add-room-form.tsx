
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
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { RoomFormFields, roomSchema, type RoomFormValues } from './room-form-fields';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { addDoc, collection, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { uploadImage } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import { endOfDay, setHours, setMinutes } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Form } from '../ui/form';


interface AddRoomFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

const endOfPromotionDay = (date: Date, checkoutTime: string): Date => {
  try {
    const [hours, minutes] = checkoutTime.split(':').map(Number);
    return setMinutes(setHours(date, hours), minutes);
  } catch {
    return endOfDay(date); // Fallback to end of day if time is invalid
  }
};


export function AddRoomForm({ open, onOpenChange, onSuccess }: AddRoomFormProps) {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const checkoutTime = settings?.checkoutTime || '11:00';
  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: '',
      price: 0,
      capacity: 1,
      totalRooms: 0,
      facilities: [],
      images: [],
      newImageFiles: [],
      roomNumbers: '',
      promoPrice: undefined,
      promoType: 'fixed',
      promoDates: undefined,
    },
  });

  const onSubmit = async (data: RoomFormValues) => {
    if (!firestore || !userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'User or database not available.' });
      return;
    }

    setIsLoading(true);

    try {
        let uploadedImageUrls: string[] = [];
        if (data.newImageFiles && data.newImageFiles.length > 0) {
            toast({ title: 'Uploading Images...' });
            const uploadPromises = data.newImageFiles.map(file => {
                const newName = `room-${data.name.replace(/\s+/g, '_')}-${Date.now()}`;
                return uploadImage(file, imgbbApiKey, newName, expirationSeconds);
            });
            uploadedImageUrls = await Promise.all(uploadPromises);
        }

        const parsedRoomNumbers = data.roomNumbers?.split(',').map(n => n.trim()).filter(Boolean) || [];

        const newRoomData = {
          name: data.name,
          price: data.price,
          capacity: data.capacity,
          totalRooms: parsedRoomNumbers.length,
          availableRooms: parsedRoomNumbers.length,
          bookedRooms: 0,
          facilities: data.facilities || [],
          images: uploadedImageUrls,
          roomNumbers: parsedRoomNumbers,
          individualRoomStatus: {},
          promoPrice: data.promoPrice || null,
          promoType: data.promoPrice ? data.promoType : null,
          promoStartDate: data.promoDates?.from ? Timestamp.fromDate(data.promoDates.from) : null,
          promoEndDate: data.promoDates?.to ? Timestamp.fromDate(endOfPromotionDay(data.promoDates.to, checkoutTime)) : null,
        };

        const batch = writeBatch(firestore);
        const newRoomRef = doc(collection(firestore, 'rooms'));
        batch.set(newRoomRef, { ...newRoomData, createdAt: serverTimestamp() });

        const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        batch.set(auditLogRef, {
            timestamp: serverTimestamp(),
            userId: userProfile.uid,
            userName: userProfile.name,
            changeType: 'Create',
            entityType: 'Room Type',
            entityId: newRoomRef.id,
            details: `Created new room type: ${data.name} with ${parsedRoomNumbers.length} rooms.`
        });

        await batch.commit();

        toast({ variant: 'success', title: 'Room Added' });
        onSuccess();
        onOpenChange(false);
        form.reset();

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsLoading(false);
    }
  };

  const formId = "add-room-form";

  const FormContent = (
      <Form {...form}>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <RoomFormFields form={form} isEditMode={false} />
        </form>
      </Form>
  )

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <div className="p-4 flex flex-col h-full">
            <DialogHeader className="mb-4">
                <DialogTitle>Add a New Room</DialogTitle>
                <DialogDescription>Fill in the details below to add a new room to your property.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="-mx-4 flex-1">
                <div className="px-4">
                    {FormContent}
                </div>
            </ScrollArea>
            <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
                <Button type="submit" form={formId} loading={isLoading}>
                    Add Room
                </Button>
            </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a New Room</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new room to your property.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <div className="pr-1">{FormContent}</div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button type="submit" form={formId} loading={isLoading}>
                Add Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
