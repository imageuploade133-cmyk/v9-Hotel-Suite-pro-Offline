'use client';

import * as React from 'react';
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
  Clock,
  Shirt,
  User,
  MoreHorizontal,
  Check,
  CheckCircle,
  FileText,
  Loader2,
  DollarSign,
  ListOrdered,
} from 'lucide-react';
import type { LaundryOrder, Bill } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/settings-context';
import { Badge } from '../ui/badge';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';

interface LaundryOrderCardProps {
  order: LaundryOrder;
  onUpdateStatus: (order: LaundryOrder, newStatus: LaundryOrder['status']) => void;
  onAddBill: (order: LaundryOrder) => void;
  onOpenActions: (order: LaundryOrder) => void;
  allBills: Bill[];
}

const statusMap: { [key in LaundryOrder['status']]: { icon: React.ElementType, color: string, text: string } } = {
  Pending: { icon: Clock, color: 'text-yellow-600', text: 'Pending' },
  'In-Progress': { icon: Shirt, color: 'text-blue-600', text: 'In-Progress' },
  Washed: { icon: Check, color: 'text-indigo-600', text: 'Washed' },
  Completed: { icon: CheckCircle, color: 'text-green-600', text: 'Completed' },
  Delivered: { icon: CheckCircle, color: 'text-gray-500', text: 'Delivered' },
};

export function LaundryOrderCard({ order, onUpdateStatus, onAddBill, onOpenActions, allBills }: LaundryOrderCardProps) {
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const currency = settings?.currency || 'USD';
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isBilling, setIsBilling] = React.useState(false);

  const { icon: StatusIcon, color: statusColor, text: statusText } = statusMap[order.status];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  const nextAction = (): { label: string; action: () => void; icon: React.ElementType; } | null => {
    switch (order.status) {
      case 'Pending':
        return { label: 'Start Washing', action: () => onUpdateStatus(order, 'In-Progress'), icon: Shirt };
      case 'In-Progress':
        return { label: 'Mark as Washed', action: () => onUpdateStatus(order, 'Washed'), icon: Check };
      case 'Washed':
        return { label: 'Mark as Completed', action: () => onUpdateStatus(order, 'Completed'), icon: CheckCircle };
      case 'Completed':
        return { label: 'Mark as Delivered', action: () => onUpdateStatus(order, 'Delivered'), icon: CheckCircle };
      default:
        return null;
    }
  };

  const NextActionButton = nextAction();
  const isBilled = !!order.billedAt;

  const billForItem = React.useMemo(() => {
    if (!order || !allBills) return null;
    return allBills.find(b => b.items.some(i => i.id.startsWith(`laundry-${order.orderNumber}`)));
  }, [order, allBills]);

  const isPaid = billForItem?.paid ?? false;

  const handleAddBillConfirm = async () => {
    setIsBilling(true);
    try {
      await onAddBill(order);
    } finally {
      setIsBilling(false);
    }
  };


  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Room {order.roomNumber}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono">#{order.orderNumber}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => onOpenActions(order)}>
                <MoreHorizontal className="h-4 w-4"/>
            </Button>
        </div>
        <div className={cn("flex items-center gap-2 text-sm font-semibold mt-2", statusColor)}>
          <StatusIcon className="h-5 w-5" />
          <span>{statusText}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{order.guestName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(order.createdAt.toDate(), { addSuffix: true })}
            </span>
          </div>
           {order.staffName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Last action by {order.staffName}</span>
              </div>
           )}
        </div>
        <Separator />
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><ListOrdered className="h-4 w-4" /> Order Items</h4>
          <ScrollArea className="h-32 rounded-md border p-2">
            <div className="space-y-2 text-sm">
              {order.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex justify-between">
                  <span>{item.name} x {item.quantity}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
       <CardFooter className="flex-col items-stretch gap-2 p-4 bg-muted/50">
        <div className="flex justify-between text-lg font-bold">
          <span>Total:</span>
          <span>{formatCurrency(order.totalPrice)}</span>
        </div>
        {isBilled && (
          isPaid ? (
              <Badge variant="success" className="justify-center text-xs">
                  <DollarSign className="h-3 w-3 mr-1" /> Paid
              </Badge>
          ) : (
              <Badge variant="warning" className="justify-center text-xs">
                  <DollarSign className="h-3 w-3 mr-1" /> Billed to Room (Unpaid)
              </Badge>
          )
        )}
        {NextActionButton && (
          <Button className="w-full mt-2" onClick={NextActionButton.action}>
            <NextActionButton.icon className="mr-2 h-4 w-4" />
            {NextActionButton.label}
          </Button>
        )}
        {order.status === 'Pending' && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="secondary" disabled={isBilled}>
                  <FileText className="mr-2 h-4 w-4" />
                  Add Bill to Room
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Add to Bill</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to add a charge of{' '}
                    <span className="font-bold">{formatCurrency(order.totalPrice)}</span> for this
                    laundry order to Room {order.roomNumber}'s bill?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAddBillConfirm}>
                    {isBilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}
