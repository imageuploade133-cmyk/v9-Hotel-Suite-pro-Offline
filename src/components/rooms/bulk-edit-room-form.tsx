'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { doc, writeBatch, collection, query } from 'firebase/firestore';
import type { Room } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomSheet } from '../ui/bottom-sheet';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const singleRoomSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Room name is required.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  facilities: z.array(z.string()).optional(),
  totalRooms: z.coerce.number().min(1, 'Total rooms must be at least 1'),
  roomNumbers: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const bulkEditSchema = z.object({
  rooms: z.array(singleRoomSchema),
});

export type BulkEditFormValues = z.infer<typeof bulkEditSchema>;

interface BulkEditRoomFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  onSuccess: () => void;
}

function RoomSubForm({ control, index, remove, room }: { control: any, index: number, remove: (index: number) => void, room: Room }) {
  const firestore = useFirestore();

  const roomFacilitiesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomFacilities'));
  }, [firestore]);
  const { data: roomFacilities } = useCollection(roomFacilitiesQuery);

  return (
    <div className="space-y-4 p-4 border rounded-lg relative bg-background/50">
      <h3 className="font-semibold">{room.name}</h3>
        <Controller
            control={control}
            name={`rooms.${index}.name`}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Room Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Deluxe Suite" /></FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <div className="grid grid-cols-2 gap-4">
             <Controller
                control={control}
                name={`rooms.${index}.price`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl><Input type="number" {...field} placeholder="e.g. 150" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <Controller
                control={control}
                name={`rooms.${index}.totalRooms`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Total Rooms</FormLabel>
                        <FormControl><Input type="number" {...field} placeholder="e.g. 10" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        {roomFacilities && roomFacilities.length > 0 && (
             <Controller
                control={control}
                name={`rooms.${index}.facilities`}
                render={({ field: facilitiesField }) => (
                    <FormItem>
                        <Separator />
                        <div className="pt-2">
                           <FormLabel className="text-base">Facilities</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                        {(roomFacilities as any[]).map((item) => (
                            <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                <Checkbox
                                    checked={facilitiesField.value?.includes(item.name)}
                                    onCheckedChange={(checked) => {
                                    return checked
                                        ? facilitiesField.onChange([...(facilitiesField.value || []), item.name])
                                        : facilitiesField.onChange(
                                            facilitiesField.value?.filter(value => value !== item.name)
                                        )
                                    }}
                                />
                                </FormControl>
                                <FormLabel className="font-normal">{item.name}</FormLabel>
                            </FormItem>
                        ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
             />
        )}
        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
        </Button>
    </div>
  )
}

function BulkEditFormFields({ onOpenChange, formId, rooms, setIsSaving, onSuccess }: {onOpenChange: (open: boolean) => void, formId: string, rooms: Room[], setIsSaving: (isSaving: boolean) => void, onSuccess: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();

    const form = useForm<BulkEditFormValues>({
        resolver: zodResolver(bulkEditSchema),
        defaultValues: {
          rooms: rooms.map(r => ({ ...r, roomNumbers: r.roomNumbers?.join(', ') || ''})),
        },
      });

    const { fields, remove } = useFieldArray({
        control: form.control,
        name: "rooms",
    });

    React.useEffect(() => {
        form.reset({ rooms: rooms.map(r => ({...r, roomNumbers: r.roomNumbers?.join(', ') || '' })) });
    }, [rooms, form]);

    const handleFormSubmit = async (values: BulkEditFormValues) => {
        if (!firestore) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not update rooms.' });
          return;
        }

        if (values.rooms.length === 0) {
            toast({ title: 'No rooms to update', description: 'All rooms were removed from the list.' });
            onOpenChange(false);
            return;
        }

        setIsSaving(true);
        try {
          const batch = writeBatch(firestore);
          values.rooms.forEach((room) => {
            const roomRef = doc(firestore, 'rooms', room.id);
            const { id, ...roomData } = room;

            const parsedRoomNumbers = roomData.roomNumbers?.split(',').map(n => n.trim()).filter(Boolean) || [];

            batch.update(roomRef, {
                ...roomData,
                roomNumbers: parsedRoomNumbers,
            });
          });
          await batch.commit();

          toast({
            variant: 'success',
            title: 'Room Types Updated',
            description: `${values.rooms.length} room type(s) have been successfully updated.`,
          });
          onSuccess();
          onOpenChange(false);
          form.reset();
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error updating rooms',
            description: error.message || 'An unexpected error occurred.',
          });
        } finally {
          setIsSaving(false);
        }
    };

    return (
        <Form {...form}>
            <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                {fields.map((field, index) => (
                    <RoomSubForm key={field.id} control={form.control} index={index} remove={remove} room={rooms[index]}/>
                ))}
            </form>
        </Form>
    )
}

export function BulkEditRoomForm({ open, onOpenChange, rooms, onSuccess }: BulkEditRoomFormProps) {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = React.useState(false);
  const formId = `bulk-edit-form-${rooms.map(r => r.id).join('-')}`;

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <div className="p-4 flex flex-col h-full">
            <div className="mb-4">
                <h2 className="text-lg font-semibold">Bulk Edit {rooms.length} Rooms</h2>
                <p className="text-sm text-muted-foreground">
                    Edit details for each room below.
                </p>
            </div>
             <ScrollArea className="flex-1 -mx-4">
                <div className="px-4 space-y-4">
                  <BulkEditFormFields onOpenChange={onOpenChange} formId={formId} rooms={rooms} setIsSaving={setIsSaving} onSuccess={onSuccess}/>
                </div>
            </ScrollArea>
            <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                    Cancel
                </Button>
                <Button type="submit" form={formId} loading={isSaving}>
                    Save All Changes
                </Button>
            </div>
        </div>
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Edit {rooms.length} Rooms</DialogTitle>
          <DialogDescription>
            Edit the details for each selected room below. Click "Save All Changes" when you're done.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
           <BulkEditFormFields onOpenChange={onOpenChange} formId={formId} rooms={rooms} setIsSaving={setIsSaving} onSuccess={onSuccess} />
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSaving}>
            Save All Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
