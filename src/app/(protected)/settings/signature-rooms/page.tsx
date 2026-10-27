
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Edit, Star, GripVertical, Bed } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Room as SignatureRoom } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import { useSettings } from '@/contexts/settings-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Reorder } from 'framer-motion';
import { uploadImage } from '@/lib/helpers';
import { SignatureRoomFormFields } from '@/components/settings/signature-room-form-fields';
import { Separator } from '@/components/ui/separator';
import { Form } from '@/components/ui/form';
import { TopHeader } from '@/components/ui/top-header';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';

const roomSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().min(1, 'Description is required.'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
  rooms: z.string().optional(),
  rating: z.coerce.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  imageFile: z.instanceof(File).optional(),
  imageUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  beds: z.coerce.number().min(1, 'Must have at least 1 bed').optional(),
  bathrooms: z.coerce.number().min(1, 'Must have at least 1 bathroom').optional(),
  size: z.coerce.number().min(1, 'Size must be positive').optional(),
}).refine(data => data.imageFile || data.imageUrl, {
    message: "An image is required. Please upload one or provide a URL.",
    path: ["imageFile"],
});


type RoomFormValues = z.infer<typeof roomSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

function SignatureRoomsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<SignatureRoom | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const roomsQuery = React.useMemo(() => (firestore ? query(collection(firestore, 'signatureRooms'), orderBy('order')) : null), [firestore]);
  const { data: roomsData, isLoading } = useCollection<SignatureRoom>(roomsQuery as any);

  const [orderedRooms, setOrderedRooms] = React.useState<SignatureRoom[]>([]);
  React.useEffect(() => {
    if (roomsData) {
      setOrderedRooms(roomsData as SignatureRoom[]);
    }
  }, [roomsData]);


  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      title: '',
      description: '',
      rating: 5,
      imageUrl: '',
      imageFile: undefined,
      price: 0,
      rooms: '',
      beds: 1,
      bathrooms: 1,
      size: 25,
    }
  });

  const handleAddNew = () => {
    setEditingRoom(null);
    form.reset({ title: '', description: '', rating: 5, imageUrl: '', imageFile: undefined, price: 0, rooms: '', beds: 1, bathrooms: 1, size: 25 });
    setIsFormOpen(true);
  };

  const handleEdit = (room: SignatureRoom) => {
    setEditingRoom(room);
    form.reset({
        title: room.name,
        description: room.description,
        rating: (room as any).rating || 5,
        imageUrl: (room.images && room.images[0]) || '',
        imageFile: undefined,
        price: room.price || 0,
        rooms: room.roomNumbers?.join(', ') || '',
        beds: (room as any).beds || 1,
        bathrooms: (room as any).bathrooms || 1,
        size: (room as any).size || 25,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (room: SignatureRoom) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'signatureRooms', room.id));
      toast({ variant: 'success', title: 'Room Deleted' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleReorder = async (newOrder: SignatureRoom[]) => {
      setOrderedRooms(newOrder);
      if (!firestore) return;
      const batch = writeBatch(firestore);
      newOrder.forEach((room, index) => {
          const docRef = doc(firestore, 'signatureRooms', room.id);
          batch.update(docRef, { order: index });
      });
      try {
          await batch.commit();
          toast({ variant: 'success', title: 'Order Saved'});
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error Saving Order', description: e.message });
      }
  }

  const onSubmit = async (data: RoomFormValues) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
        let imageUrl = data.imageUrl;
        if (data.imageFile) {
            toast({ title: "Uploading Image..." });
            const imageName = `signature-room-${Date.now()}`;
            imageUrl = await uploadImage(data.imageFile, settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY, imageName);
        }

        if (!imageUrl) {
            throw new Error("An image is required. Please upload one or provide a URL.");
        }

        const roomData = {
          name: data.title,
          description: data.description,
          price: data.price,
          rating: data.rating,
          images: [imageUrl],
          roomNumbers: data.rooms?.split(',').map(s => s.trim()).filter(Boolean) || [],
          beds: data.beds,
          bathrooms: data.bathrooms,
          size: data.size,
          capacity: data.beds ? data.beds * 2 : 2
        };

        if (editingRoom) {
            await updateDoc(doc(firestore, 'signatureRooms', editingRoom.id), roomData);
            toast({ variant: 'success', title: 'Room Updated' });
        } else {
            await addDoc(collection(firestore, 'signatureRooms'), { ...roomData, order: roomsData?.length || 0 });
            toast({ variant: 'success', title: 'Room Added' });
        }
        setIsFormOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };


  return (
    <>
      <div className="space-y-6">
        <TopHeader
          icon={<Star className="h-10 w-10" />}
          name="Signature Rooms"
          description="Manage the featured rooms displayed on your website homepage."
        />
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Featured Accommodations</CardTitle>
                        <CardDescription>Drag and drop the rooms to reorder them on the website.</CardDescription>
                    </div>
                    <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" /> Add Room</Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <p>Loading...</p> : (
                    <Reorder.Group axis="y" values={orderedRooms} onReorder={handleReorder}>
                        <div className="space-y-4">
                            {orderedRooms.map(room => (
                                <Reorder.Item key={room.id} value={room}>
                                    <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/50 cursor-grab active:cursor-grabbing">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        <div className="relative h-20 w-20 rounded-md overflow-hidden bg-muted">
                                            {(room.images && room.images[0]) ? (
                                                <Image src={room.images[0]} alt={room.name} fill className="object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full w-full text-muted-foreground">
                                                    <Bed className="h-8 w-8" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold">{room.name}</h4>
                                            <p className="text-xs text-muted-foreground">{room.description}</p>
                                            <div className="flex items-center gap-1 mt-1 text-yellow-500">
                                                {Array.from({length: 5}).map((_, i) => (
                                                    <Star key={i} className={`h-4 w-4 ${i < ((room as any).rating || 0) ? 'fill-current' : ''}`} />
                                                ))}
                                            </div>
                                            {room.price > 0 && <p className="text-sm font-semibold mt-1">{new Intl.NumberFormat('en-US', { style: 'currency', currency: settings?.currency || 'USD' }).format(room.price)} / night</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(room)}><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete the "{room.name}" room from the website.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <Button
                                                            variant="destructive"
                                                            onClick={() => handleDelete(room)}
                                                            loading={isSaving}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </Button>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </Reorder.Item>
                            ))}
                        </div>
                    </Reorder.Group>
                )}
            </CardContent>
        </Card>
      </div>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>{editingRoom ? 'Edit' : 'Add'} Signature Room</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] -mx-6 px-6">
              <Form {...form}>
                <SignatureRoomFormFields form={form} />
              </Form>
            </ScrollArea>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" form="signature-room-form" loading={isSaving} onClick={form.handleSubmit(onSubmit)}>
                    {editingRoom ? 'Save Room' : 'Add Room'}
                </Button>
            </DialogFooter>
        </DialogContent>
       </Dialog>
    </>
  );
}

export default withAuth(SignatureRoomsPage, PagePermission.MANAGE_GENERAL_SETTINGS);
