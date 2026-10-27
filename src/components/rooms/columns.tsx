
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, RefreshCw, Percent, CalendarDays, Users } from "lucide-react"
import Image from 'next/image';
import { isWithinInterval, startOfDay, endOfDay, isPast, isFuture } from 'date-fns';

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "../ui/checkbox"
import type { Room } from "@/lib/types";
import { Progress } from "../ui/progress";
import { format } from "date-fns";
import { getSafeDate } from "@/lib/helpers";

export const getColumns = (
    onView: (room: Room) => void,
    onEdit: (room: Room) => void,
    onDelete: (room: Room) => void,
    onResetInventory: (room: Room) => void,
    currency: string,
    onUpdateRoomStatus: (room: Room, status: string) => void,
): ColumnDef<Room & { totalSpent?: number }>[] => [
    {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "images",
        header: "Image",
        cell: ({ row }) => {
            const room = row.original;
            const images = room.images;
            return (
                 <button onClick={() => onView(room)} className="w-12 h-12 rounded-md overflow-hidden relative group/image bg-muted hover:ring-2 hover:ring-primary hover:ring-offset-2 ring-offset-background transition-all">
                    {(!images || images.length === 0) ? (
                        <div className="flex items-center justify-center h-full w-full text-muted-foreground text-xs">
                           No Image
                        </div>
                    ) : (
                       <>
                            <Image
                                src={images[0]}
                                alt={`Room ${room.name}`}
                                fill
                                className="object-cover"
                            />
                            {images.length > 1 && (
                                <Badge variant="secondary" className="absolute bottom-1 right-1 text-[10px] p-0.5 px-1.5">{images.length}</Badge>
                            )}
                       </>
                    )}
                 </button>
            );
        },
        enableSorting: false,
    },
    {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Room Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const room = row.original;
        return (
            <div className="flex flex-col">
                <span className="font-medium">{room.name}</span>
                <span className="text-xs text-muted-foreground">ID: {room.id}</span>
            </div>
        )
    }
  },
  {
    accessorKey: "inventory",
    header: "Availability",
    cell: ({ row }) => {
      const room = row.original;
      const available = room.availableRooms ?? 0;
      const total = room.totalRooms ?? 0;
      const percentage = total > 0 ? ((total - available) / total) * 100 : 0;

      let colorClass = 'bg-green-500';
      if (percentage > 75) {
        colorClass = 'bg-red-500';
      } else if (percentage > 50) {
        colorClass = 'bg-yellow-500';
      }

      return (
        <div className="flex flex-col gap-1 w-24">
          <span className="font-semibold text-sm">{available} / {total}</span>
          <Progress value={percentage} className="h-2" indicatorClassName={colorClass} />
        </div>
      )
    }
  },
    {
        accessorKey: "capacity",
        header: () => (
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Capacity
            </div>
        ),
        cell: ({ row }) => {
            const room = row.original;
            return (
                <div className="text-center font-medium">{room.capacity}</div>
            );
        },
    },
  {
    accessorKey: "price",
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => {
      const room = row.original;
      const originalPrice = room.price;
      const promoPrice = room.promoPrice;
      const promoType = room.promoType;
      const promoStart = getSafeDate(room.promoStartDate);
      const promoEnd = getSafeDate(room.promoEndDate);
      const isPromoActive = promoStart && promoEnd ? isWithinInterval(new Date(), { start: startOfDay(promoStart), end: endOfDay(promoEnd) }) : false;

      let displayPrice = originalPrice;
      if (isPromoActive && promoPrice) {
          if (promoType === 'fixed') {
              displayPrice = promoPrice;
          } else {
              displayPrice = originalPrice - (originalPrice * (promoPrice / 100));
          }
      }

      const formattedOriginal = new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(originalPrice);
      const formattedDisplay = new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(displayPrice);

      return (
        <div className="text-right font-medium flex flex-col items-end">
            {isPromoActive ? (
                <>
                    <span className="text-muted-foreground line-through text-xs">{formattedOriginal}</span>
                    <span className="text-red-600 dark:text-red-500">{formattedDisplay}</span>
                </>
            ) : (
                 <span>{formattedOriginal}</span>
            )}
        </div>
      )
    },
  },
  {
    id: "promotion",
    header: "Promotion",
    cell: ({ row }) => {
      const room = row.original;
      const promoPrice = room.promoPrice;
      const promoType = room.promoType;
      const promoStart = getSafeDate(room.promoStartDate);
      const promoEnd = getSafeDate(room.promoEndDate);

      if (!promoPrice || !promoStart || !promoEnd) {
        return <span className="text-muted-foreground text-xs">No promotion set</span>;
      }

      const now = new Date();
      const isActive = isWithinInterval(now, { start: startOfDay(promoStart), end: endOfDay(promoEnd) });
      const isScheduled = isFuture(startOfDay(promoStart));
      const isExpired = isPast(endOfDay(promoEnd));

      let statusBadge;
      if (isActive) statusBadge = <Badge variant="success">Active</Badge>;
      else if (isScheduled) statusBadge = <Badge variant="outline">Scheduled</Badge>;
      else if (isExpired) statusBadge = <Badge variant="secondary">Expired</Badge>;

      return (
        <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
                {promoType === 'percentage' ? (
                    <Badge variant="destructive" className="gap-1"><Percent className="h-3 w-3" /> {promoPrice}% OFF</Badge>
                ) : (
                    <Badge variant="destructive">{new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(promoPrice)}</Badge>
                )}
                {statusBadge}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{format(promoStart, 'MMM d')} - {format(promoEnd, 'MMM d, yyyy')}</span>
            </div>
        </div>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const room = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(room)}>
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(room)}>
              Edit room
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdateRoomStatus(room, room.status)}>
             Update Room Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetInventory(room)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset Inventory
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(room.id)}
            >
              Copy room ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                className="text-red-500 focus:text-red-500 focus:bg-red-50"
                onClick={() => onDelete(room)}
            >
              Delete room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
