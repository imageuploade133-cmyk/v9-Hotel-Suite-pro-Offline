
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
  User,
  MoreVertical,
  Check,
  CheckCircle,
  FileText,
  Loader2,
  DollarSign,
} from 'lucide-react';
import type { SalonService, BillItem } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/settings-context';
import { Badge } from '../ui/badge';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';

interface SalonOrderCardProps {
  order: SalonService;
  onOrderUpdate: () => void;
  onPrint: (order: SalonService) => void;
  onPay: (order: SalonService) => void;
  onOpenActions: (order: SalonService) => void;
}

const statusMap: { [key in SalonService['status']]: { icon: React.ElementType, color: string, text: string } } = {
  Pending: { icon: Clock, color: 'text-yellow-600', text: 'Pending' },
  'In-Progress': { icon: Loader2, color: 'text-blue-600 animate-spin', text: 'In-Progress' },
  Completed: { icon: CheckCircle, color: 'text-green-600', text: 'Completed' },
};

export function SalonOrderCard({ order, onOrderUpdate, onPrint, onPay, onOpenActions }: SalonOrderCardProps) {
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

  const handleUpdateStatus = async (newStatus: 'In-Progress' | 'Completed') => {
    if (!firestore || !userProfile) return;
    setIsUpdating(true);
    try {
        const orderRef = doc(firestore, 'salonServices', order.id);
        await updateDoc(orderRef, { status: newStatus });
        toast({ variant: 'success', title: 'Status Updated' });
        onOrderUpdate();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleAddBillToRoom = async () => {
    if (!firestore || !userProfile || !order.bookingId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No associated booking found for this order.' });
        return;
    }
    setIsBilling(true);
    try {
        const batch = writeBatch(firestore);
        const billRef = doc(collection(firestore, `bookings/${order.bookingId}/bills`));

        const billItems: BillItem[] = order.items.map(s => ({
            id: `salon-${order.orderNumber}-${s.serviceId}`,
            name: `Salon: ${s.serviceName}`,
            price: s.price,
            quantity: 1,
            paid: false,
            isService: true,
            billId: billRef.id,
        }));

        batch.set(billRef, {
            items: billItems,
            total: order.totalPrice,
            createdAt: serverTimestamp(),
            createdBy: userProfile.uid,
            createdByName: userProfile.name,
            paid: false,
            bookingId: order.bookingId,
        });

        const orderRef = doc(firestore, 'salonServices', order.id);
        batch.update(orderRef, { paymentStatus: 'Billed' });

        await batch.commit();
        toast({ variant: 'success', title: 'Billed to Room', description: `Charge of ${formatCurrency(order.totalPrice)} added to room bill.` });
        onOrderUpdate();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add bill to room.' });
    } finally {
        setIsBilling(false);
    }
  };

  const nextAction = () => {
    switch (order.status) {
      case 'Pending':
        return { label: 'Start Service', action: () => handleUpdateStatus('In-Progress'), icon: Check };
      case 'In-Progress':
        return { label: 'Mark as Completed', action: () => handleUpdateStatus('Completed'), icon: CheckCheck };
      default:
        return null;
    }
  };

  const NextActionButton = nextAction();

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">
                  {order.customerName}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                  {order.roomNumber ? `Room ${order.roomNumber}` : 'Walk-in Customer'}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => onOpenActions(order)}>
                <MoreVertical className="h-4 w-4"/>
            </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center justify-between">
            <div className={cn("flex items-center gap-2 text-sm font-semibold", statusColor)}>
                <StatusIcon className="h-5 w-5" />
                <span>{statusText}</span>
            </div>
            <Badge variant={order.paymentStatus === 'Paid' ? 'success' : 'destructive'}>{order.paymentStatus}</Badge>
        </div>
        <Separator />
        <div className="space-y-3">
             <h4 className="font-semibold">Services:</h4>
             <ul className="space-y-2 text-sm">
                {order.items.map((item, index) => (
                    <li key={index} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.price)}</span>
                    </li>
                ))}
             </ul>
        </div>
        <Separator />
        {order.notes && (
            <div className="text-sm">
                <h4 className="font-semibold mb-1">Notes:</h4>
                <p className="text-muted-foreground italic">"{order.notes}"</p>
            </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(order.createdAt.toDate(), { addSuffix: true })}</span>
        </div>
      </CardContent>
       <CardFooter className="flex-col items-stretch gap-2 p-4 bg-muted/50">
        <div className="flex justify-between text-lg font-bold">
          <span>Total:</span>
          <span>{formatCurrency(order.totalPrice)}</span>
        </div>
        {order.paymentMethod && <div className="text-xs text-muted-foreground text-right">Paid via {order.paymentMethod}</div>}

        {order.paymentStatus === 'Unpaid' && (
            <div className="flex gap-2 mt-2">
            <Button className="flex-1" variant="secondary" onClick={() => onPay(order)}>
                <DollarSign className="mr-2 h-4 w-4"/> Pay Now
            </Button>
            {order.roomNumber && order.bookingId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button className="flex-1" variant="outline" disabled={isBilling}>
                        {isBilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}
                        Bill to Room
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Add to Bill</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to add this service cost to the room bill for Room {order.roomNumber}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAddBillToRoom}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {NextActionButton && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
                 <Button className="w-full mt-2" variant={order.status === 'In-Progress' ? 'default' : 'secondary'}>
                    <NextActionButton.icon className="mr-2 h-4 w-4" />
                    {NextActionButton.label}
                 </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Action</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to mark this service as "{order.status === 'Pending' ? 'In-Progress' : 'Completed'}"?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={NextActionButton.action}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
