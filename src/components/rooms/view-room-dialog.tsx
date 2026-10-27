
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Room } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BottomSheet } from '../ui/bottom-sheet';
import { Bed, DollarSign, Tag, Wifi, ChevronLeft, ChevronRight, Hash, Building2, Users } from 'lucide-react';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Progress } from '../ui/progress';


interface ViewRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  currency: string;
  roomList: Room[];
  onNavigate: (direction: 'next' | 'prev') => void;
}

function RoomDetails({ room, currency }: { room: Room, currency: string }) {
    if (!room) return null;
    const firestore = useFirestore();

    const roomFacilitiesQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'roomFacilities'));
    }, [firestore]);
    const { data: roomFacilitiesData } = useCollection(roomFacilitiesQuery);

    const facilityDetails = React.useMemo(() => {
        if (!room.facilities || !roomFacilitiesData) return [];
        return room.facilities.map(facilityName => {
            const facilityData = roomFacilitiesData.find((f: any) => f.name === facilityName);
            return {
                name: facilityName,
                iconName: facilityData?.iconName || facilityName,
            }
        });
    }, [room.facilities, roomFacilitiesData]);

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

    const occupancyPercentage = room.totalRooms && room.totalRooms > 0 ? ((room.bookedRooms || 0) / room.totalRooms) * 100 : 0;

    return (
        <div className="flex flex-col gap-4">
            {(room.images && room.images.length > 0) ? (
                 <Carousel className="w-full">
                    <CarouselContent>
                        {room.images.map((image, index) => (
                        <CarouselItem key={index}>
                            <Card className="overflow-hidden">
                                <CardContent className="p-0 aspect-video relative">
                                     <Image
                                        src={image}
                                        alt={`Room image ${index + 1}`}
                                        fill
                                        className="object-cover"
                                    />
                                </CardContent>
                            </Card>
                        </CarouselItem>
                        ))}
                    </CarouselContent>
                    {room.images.length > 1 && (
                        <>
                            <CarouselPrevious className="left-2" />
                            <CarouselNext className="right-2" />
                        </>
                    )}
                </Carousel>
            ): (
                 <div className="aspect-video w-full flex items-center justify-center bg-muted rounded-lg">
                    <p className="text-muted-foreground">No images available</p>
                </div>
            )}

            <p className="text-muted-foreground text-sm">{room.description || 'No description available.'}</p>

            <Separator/>

             <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> Inventory
                </h4>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Available Rooms</span>
                        <span className="font-bold">{room.availableRooms} / {room.totalRooms}</span>
                    </div>
                     <Progress value={occupancyPercentage} />
                     <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Booked: {room.bookedRooms}</span>
                         <span>{occupancyPercentage.toFixed(0)}% Occupied</span>
                    </div>
                </div>
            </div>


            <Separator/>


            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                        <p className="text-muted-foreground">Capacity</p>
                        <p className="font-semibold">{room.capacity}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                        <p className="text-muted-foreground">Price/Night</p>
                        <p className="font-semibold">{formatCurrency(room.price)}</p>
                    </div>
                </div>
            </div>

            {room.roomNumbers && room.roomNumbers.length > 0 && (
                 <>
                    <Separator />
                     <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                           <Hash className="h-5 w-5 text-primary" /> Assigned Room Numbers
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {room.roomNumbers.map((number) => (
                                <Badge key={number} variant="secondary">
                                    {number}
                                </Badge>
                            ))}
                        </div>
                    </div>
                 </>
            )}

            {facilityDetails && facilityDetails.length > 0 && (
                <>
                    <Separator />
                    <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                           <Wifi className="h-5 w-5 text-primary" /> Facilities
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {facilityDetails.map((facility, index) => {
                                return (
                                    <Badge key={index} variant="outline" className="flex items-center gap-2 pr-3">
                                        <DynamicIcon iconName={facility.iconName} className="h-4 w-4 text-muted-foreground" />
                                        {facility.name}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export function ViewRoomDialog({ open, onOpenChange, room, currency, roomList, onNavigate }: ViewRoomDialogProps) {
  const isMobile = useIsMobile();

  if (!room) return null;

  const currentIndex = roomList.findIndex(r => r.id === room.id);
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex < roomList.length - 1;

  const NavigationControls = () => (
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onNavigate('prev')} disabled={!canNavigatePrev}>
            <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
            {currentIndex + 1} / {roomList.length}
        </span>
        <Button variant="outline" size="icon" onClick={() => onNavigate('next')} disabled={!canNavigateNext}>
            <ChevronRight className="h-4 w-4" />
        </Button>
    </div>
  );


  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <div className="p-4 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Room: {room.name}</h2>
            <NavigationControls />
          </div>
          <div className="flex-1 overflow-y-auto -mx-4 pr-2">
            <div className="px-4">
                <RoomDetails room={room} currency={currency} />
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Room Type: {room.name}</DialogTitle>
            <NavigationControls />
          </div>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto -mx-6 px-6">
            <RoomDetails room={room} currency={currency} />
        </div>
         <div className="flex justify-end pt-4 border-t">
            <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
