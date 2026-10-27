
'use client';

import * as React from 'react';
import type { Order, Bill } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  User,
  Phone,
  Mail,
  ShoppingCart,
  CookingPot,
  UserCheck,
  FileText,
  Printer,
  Image as ImageIcon,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getSafeDate } from '@/lib/helpers';
import Image from 'next/image';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (order: Order, newStatus: 'Preparing' | 'Completed') => void;
  onPrint: (order: Order) => void;
  formatCurrency: (value: number) => string;
  onViewImage: (imageUrl: string) => void;
  allBills: Bill[],
  onAddBill: (order: Order) => void;
}

export function OrderCard({
  order,
  onUpdateStatus,
  onPrint,
  formatCurrency,
  onViewImage,
  allBills,
  onAddBill
}: OrderCardProps) {
  const isCompleted = order.status === 'Completed';

  const billForItem = allBills.find(b => b.items.some(i => i.id.startsWith(`order-${order.orderNumber}`)));
  const isPaid = billForItem?.paid ?? false;

  let statusIcon, statusText, statusColor, actorName, actorDate;

  switch(order.status) {
    case 'Completed':
        statusIcon = <UserCheck className="h-4 w-4" />;
        statusColor = 'text-green-600';
        actorName = order.completedByName;
        actorDate = getSafeDate(order.completedAt);
        statusText = `Completed by ${actorName || 'System'}`;
        break;
    case 'Billed':
        statusIcon = <FileText className="h-4 w-4" />;
        statusColor = 'text-gray-500';
        actorName = order.billedByName;
        actorDate = getSafeDate(order.billedAt);
        statusText = `Billed by ${actorName || 'System'}`;
        break;
    case 'Preparing':
        statusIcon = <CookingPot className="h-5 w-5" />;
        statusColor = 'text-blue-600';
        actorName = order.preparingByName;
        actorDate = getSafeDate(order.preparingAt);
        statusText = `Preparing by ${actorName || 'System'}`;
        break;
    default: // Pending
        statusIcon = <Clock className="h-5 w-5" />;
        statusColor = 'text-yellow-600';
        const createdAt = getSafeDate(order.createdAt);
        statusText = createdAt ? `Pending since ${format(createdAt, 'PPp')}` : 'Pending...';
  }

  const isBilled = !!order.billedAt;
  const isFromStaff = order.source === 'staff';


  return (
    <Card className={cn("flex flex-col transition-all duration-300 relative overflow-hidden", isCompleted ? 'bg-muted/50' : 'bg-card')}>
       {order.status === 'Pending' && (
        <div className="absolute inset-y-0 left-0 w-1.5 bg-yellow-500 animate-pending"></div>
      )}
      <div className="pl-4">
        <CardHeader>
          <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Room {order.roomNumber}</CardTitle>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Order #{order.orderNumber}</p>
                   {isBilled && <Badge variant={'destructive'}>Billed to Room</Badge>}
                   {isFromStaff && <Badge variant={'warning'}>Reception</Badge>}
                </div>
              </div>
            <div className={cn("flex items-center gap-2 text-sm font-semibold", statusColor)}>
                {statusIcon}
                 <div className="flex flex-col items-end">
                    <span>{statusText}</span>
                    {actorDate && actorName && (
                        <span className="text-xs text-muted-foreground font-normal">
                            {format(actorDate, "PPp")}
                        </span>
                    )}
                </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-4">
          <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{order.guestName || 'Guest'}</span>
              </div>
              <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.phoneNumber}</span>
              </div>
               {order.guestEmail && (
                  <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{order.guestEmail}</span>
                  </div>
              )}
          </div>
          <Separator />
          <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Order Items</h4>
              <ScrollArea className="h-40 rounded-md border p-2">
                  <div className="space-y-3">
                      {order.items.map((item, index) => (
                          <div key={`${item.id}-${index}`} className="flex items-center gap-3">
                             {item.images && item.images.length > 0 && (
                              <button onClick={() => onViewImage(item.images![0])} className="relative h-10 w-10 flex-shrink-0 rounded-md overflow-hidden group">
                                <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ImageIcon className="h-5 w-5 text-white" />
                                </div>
                              </button>
                             )}
                             <div className="flex-1">
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                             </div>
                             <p className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                          </div>
                      ))}
                  </div>
              </ScrollArea>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 bg-muted/50 p-4">
          <div className="flex justify-between items-center text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(order.totalPrice)}</span>
          </div>
          {isCompleted && (
                isPaid ? (
                    <Badge variant="success" className="justify-center py-1 text-sm mt-2">Paid</Badge>
                ) : isBilled ? (
                    <Badge variant="warning" className="justify-center py-1 text-sm mt-2">Billed (Unpaid)</Badge>
                ) : (
                    <Button className="w-full mt-2" onClick={() => onAddBill(order)} disabled={isBilled}>
                        <FileText className="mr-2 h-4 w-4"/>
                        {isBilled ? 'Already Billed' : 'Add Bill to Room'}
                    </Button>
                )
          )}

          {(order.status === 'Pending' || order.status === 'Billed') && (
            <Button
              className="w-full mt-2"
              onClick={() => onUpdateStatus(order, 'Preparing')}
              variant="secondary"
            >
              <CookingPot className="mr-2 h-4 w-4" />
              Mark as Preparing
            </Button>
          )}
          {order.status === 'Preparing' && (
            <Button
              className="w-full mt-2"
              onClick={() => onUpdateStatus(order, 'Completed')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Complete
            </Button>
          )}
           <Button variant="outline" className="w-full mt-2" onClick={() => onPrint(order)}>
                <Printer className="mr-2 h-4 w-4" /> Print KOT
            </Button>
        </CardFooter>
      </div>
    </Card>
  );
}
