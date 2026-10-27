'use client';

import * as React from 'react';
import type { Booking, Room } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BedDouble,
  ChevronDown,
  CalendarCheck,
  LogIn,
  Percent,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { useSettings } from '@/contexts/settings-context';
import { cn } from '@/lib/utils';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';


interface RoomTypeCardProps {
  room: Room;
  allBookingsData: Booking[] | null;
  userCurrency: string;
  setWalkInRoom: (room: Room) => void;
}

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};


export function RoomTypeCard({ room, allBookingsData, userCurrency, setWalkInRoom }: RoomTypeCardProps) {
    const [isCollapsibleOpen, setIsCollapsibleOpen] = React.useState(false);
    const { settings } = useSettings();

    const occupiedCount = room.bookedRooms || 0;
    const occupancyPercentage = room.totalRooms && room.totalRooms > 0 ? (occupiedCount / room.totalRooms) * 100 : 0;

    const promoStartDate = getSafeDate(room.promoStartDate);
    const promoEndDate = getSafeDate(room.promoEndDate);
    const isPromoActive = promoStartDate && promoEndDate ? isWithinInterval(new Date(), { start: startOfDay(promoStartDate), end: endOfDay(promoEndDate) }) : false;

    let displayPrice = room.price;
    if (isPromoActive) {
        if (room.promoType === 'fixed' && room.promoPrice) {
            displayPrice = room.promoPrice;
        } else if (room.promoType === 'percentage' && room.promoPrice) {
            displayPrice = room.price - (room.price * (room.promoPrice / 100));
        }
    }


    let colorClass = 'bg-green-500';
    if (occupancyPercentage > 75) {
      colorClass = 'bg-red-500';
    } else if (occupancyPercentage > 50) {
      colorClass = 'bg-yellow-500';
    }

    const occupiedRoomNumbers = new Set(
        (allBookingsData || [])
            .filter(b => b.roomId === room.id && (b.status === 'Active' || b.status === 'Checked-in'))
            .map(b => b.roomNumber)
            .filter(Boolean) as string[]
    );

    const reservedRoomNumbers = new Set(
        (allBookingsData || [])
            .filter(b => b.roomId === room.id && (b.status === 'Booked' || b.status === 'Reserved'))
            .map(b => b.roomNumber)
            .filter(Boolean) as string[]
    );

    const getStatusStyle = (isOccupied: boolean, isReserved: boolean, customStatus?: string) => {
      const opacity = settings?.calendarColorOpacity ?? 0.2;
      let bgColor = settings?.calendarVacantColor || '#22C55E';
      let textColor = settings?.calendarVacantTextColor || '#166534';

      if (isOccupied) {
          bgColor = settings?.calendarCheckinColor || '#3B82F6';
          textColor = settings?.calendarCheckinTextColor || '#FFFFFF';
      } else if (isReserved) {
          bgColor = settings?.calendarReservationColor || '#A855F7';
          textColor = settings?.calendarReservationTextColor || '#FFFFFF';
      } else if (customStatus) {
          // You might want to add more logic here for custom statuses
          bgColor = '#808080'; // Default grey for custom
          textColor = '#FFFFFF';
      }

      return {
          backgroundColor: hexToRgba(bgColor, opacity),
          color: textColor,
          borderColor: hexToRgba(bgColor, opacity + 0.2)
      };
    };


    return (
        <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen} asChild>
            <Card className="group/card flex flex-col overflow-hidden rounded-lg transition-all hover:shadow-lg">
              <div className="relative w-full bg-muted">
                {isPromoActive && (
                    <Badge className="absolute top-2 left-2 z-10 bg-red-600 text-white gap-1">
                        <Percent className="h-3 w-3"/>
                        SALE
                    </Badge>
                )}
                {room.images && room.images.length > 0 ? (
                    <Carousel className="h-full w-full">
                    <CarouselContent>
                        {room.images.map((image, index) => (
                        <CarouselItem key={index} className="h-48">
                            <div className="relative h-full"><Image src={image} alt={`Room ${room.name} - Image ${index + 1}`} fill className="object-cover" /></div>
                        </CarouselItem>
                        ))}
                    </CarouselContent>
                    {room.images.length > 1 && (<><CarouselPrevious className="absolute left-2 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover/card:opacity-100" /><CarouselNext className="absolute right-2 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover/card:opacity-100" /></>)}
                    </Carousel>
                ) : (<div className="flex h-48 items-center justify-center"><BedDouble className="h-10 w-10 text-muted-foreground/50" /></div>)}
              </div>

                <div className="flex-1 flex flex-col text-left group-hover:bg-muted/50 transition-colors">
                    <CardHeader className="p-4 w-full">
                      <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl">{room.name}</CardTitle>
                            <CardDescription>
                                <span className="font-bold">{room.availableRooms}</span> rooms available out of {room.totalRooms}
                            </CardDescription>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                            </Button>
                          </CollapsibleTrigger>
                      </div>
                    </CardHeader>
                    <CardContent className="w-full flex-grow space-y-4 p-4 pt-0">
                        <Progress value={occupancyPercentage} className="h-2" indicatorClassName={colorClass} />
                         <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(displayPrice)}
                          </span>
                           {isPromoActive && (
                                <span className="text-sm font-normal text-muted-foreground line-through">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: userCurrency }).format(room.price)}
                                </span>
                           )}
                           <span className="text-sm font-normal text-muted-foreground">/night</span>
                        </div>
                         {room.facilities && room.facilities.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                            {room.facilities.map(facility => {
                                return (
                                <Badge key={facility} variant="outline" className="flex items-center gap-1.5">
                                    <DynamicIcon iconName={facility} className="h-3.5 w-3.5" />
                                    {facility}
                                </Badge>
                                );
                            })}
                            </div>
                        )}
                    </CardContent>
                  </div>

              <CollapsibleContent className="p-4 pt-0">
                <Separator className="mb-4"/>
                <h4 className="font-semibold text-sm mb-2">Room Numbers:</h4>
                 <div className="flex flex-wrap gap-2">
                  {(room.roomNumbers || []).map(num => {
                    const customStatus = room.individualRoomStatus?.[num];
                    const isOccupied = occupiedRoomNumbers.has(num);
                    const isReserved = reservedRoomNumbers.has(num);

                    let tooltipText = 'Available';
                    if (isOccupied) tooltipText = 'Occupied';
                    else if (isReserved) tooltipText = 'Reserved';
                    else if (customStatus) tooltipText = customStatus;

                    const style = getStatusStyle(isOccupied, isReserved, customStatus);

                    return (
                      <Tooltip key={num}>
                        <TooltipTrigger asChild>
                           <Badge style={style}>{num}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{tooltipText}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </CollapsibleContent>

              <CardFooter className="flex items-center gap-2 bg-muted/50 p-4 mt-auto">
                {(room.availableRooms || 0) === 0 ? (
                     <Button className="w-full" variant="outline" onClick={() => setWalkInRoom(room)}>
                        <CalendarCheck className="mr-2 h-4 w-4" /> Reservation Only
                    </Button>
                ) : (
                    <Button className="w-full" onClick={() => setWalkInRoom(room)}>
                        <LogIn className="mr-2 h-4 w-4" /> Book / Check In
                    </Button>
                )}
              </CardFooter>
            </Card>
        </Collapsible>
    );
}