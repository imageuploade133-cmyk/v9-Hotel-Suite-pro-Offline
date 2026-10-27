'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, collectionGroup } from 'firebase/firestore';
import type { Booking, Bill, BillItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  Bed,
  Clock,
  Phone,
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Receipt,
  User,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

interface BillToRoomSectionProps {
  selectedRoomId: string | null;
  onSelectRoom: (booking: Booking) => void;
  onBillToRoom: (booking: Booking) => void;
}

export function BillToRoomSection({ selectedRoomId, onSelectRoom, onBillToRoom }: BillToRoomSectionProps) {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const [searchTerm, setSearchTerm] = React.useState('');
  const [expandedBookingId, setExpandedBookingId] = React.useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const activeBookingsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'bookings'),
      where('status', 'in', ['Active', 'Checked-in']),
      orderBy('checkOutDate', 'asc')
    );
  }, [firestore]);
  const { data: activeBookings, isLoading: areBookingsLoading } = useCollection<Booking>(activeBookingsQuery);

  const allBillsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collectionGroup(firestore, 'bills'));
  }, [firestore]);
  const { data: allBills, isLoading: areBillsLoading } = useCollection<Bill>(allBillsQuery);

  const isLoading = areBookingsLoading || areBillsLoading;

  const bookingsWithBills = React.useMemo(() => {
    if (!activeBookings) return [];

    return activeBookings.map(booking => {
      const bookingBills = (allBills || []).filter(bill => bill.bookingId === booking.id);
      const totalBilled = bookingBills.reduce((sum, bill) => sum + bill.total, 0);
      const unpaidBills = bookingBills.filter(bill => !bill.paid);
      const paidBills = bookingBills.filter(bill => bill.paid);
      const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + bill.total, 0);

      const checkOutDate = getSafeDate(booking.checkOutDate);
      const isOverdue = checkOutDate ? isPast(checkOutDate) : false;

      return {
        ...booking,
        totalBilled,
        totalUnpaid,
        unpaidBillsCount: unpaidBills.length,
        paidBillsCount: paidBills.length,
        billsCount: bookingBills.length,
        unpaidBills,
        paidBills,
        isOverdue,
        checkOutDateFormatted: checkOutDate ? format(checkOutDate, 'dd MMM yyyy') : 'N/A',
        timeRemaining: checkOutDate ? formatDistanceToNow(checkOutDate, { addSuffix: true }) : 'N/A'
      };
    });
  }, [activeBookings, allBills]);

  const filteredBookings = React.useMemo(() => {
    if (!searchTerm) return bookingsWithBills;
    const lowerSearch = searchTerm.toLowerCase();
    return bookingsWithBills.filter(booking =>
      booking.roomNumber?.toLowerCase().includes(lowerSearch) ||
      booking.guestName?.toLowerCase().includes(lowerSearch) ||
      booking.guestPhoneNumber?.toLowerCase().includes(lowerSearch)
    );
  }, [bookingsWithBills, searchTerm]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by room, guest name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-sm">
          {filteredBookings.length} Active Room{filteredBookings.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={Bed}
          title="No Active Check-ins"
          description={searchTerm ? "No rooms match your search criteria." : "There are no guests currently checked in to bill to."}
          className="min-h-[40vh]"
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
            {filteredBookings.map((booking) => {
              const isSelected = selectedRoomId === booking.id;

              return (
                <Card
                  key={booking.id}
                  className={cn(
                    "transition-all duration-200 cursor-pointer hover:shadow-md",
                    isSelected ? "ring-2 ring-primary border-primary" : "",
                    booking.isOverdue && "border-yellow-500",
                    booking.totalUnpaid > 0 && "border-destructive/30"
                  )}
                  onClick={() => onSelectRoom(booking)}
                >
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-3">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarImage src={booking.guestPhotoURL} alt={booking.guestName} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {booking.guestPhotoURL ? <User className="h-6 w-6" /> : getInitials(booking.guestName)}
                        </AvatarFallback>
                      </Avatar>
                      {booking.totalUnpaid > 0 && (
                        <div className="absolute -bottom-1 -right-1 bg-destructive text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                          !
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base truncate">{booking.guestName}</CardTitle>
                        {booking.isOverdue && (
                          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-2 mt-0.5">
                        <Bed className="h-3 w-3 shrink-0" /> Room {booking.roomNumber}
                      </CardDescription>
                      {booking.guestPhoneNumber && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{booking.guestPhoneNumber}</span>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={booking.status === 'Checked-in' ? 'default' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      {booking.status}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="truncate">Checkout: {booking.checkOutDateFormatted}</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      {/* Total Bill Section */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5" /> Total Bill
                        </span>
                        <span className="font-semibold text-base">{formatCurrency(booking.totalBilled)}</span>
                      </div>

                      {/* Bills Count with Expandable View */}
                      {booking.billsCount > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" /> Bills
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1 text-xs text-primary hover:text-primary hove:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id);
                              }}
                            >
                              {booking.billsCount} bill{booking.billsCount !== 1 ? 's' : ''}
                              {expandedBookingId === booking.id ? (
                                <ChevronDown className="ml-1 h-3 w-3" />
                              ) : (
                                <ChevronRight className="ml-1 h-3 w-3" />
                              )}
                            </Button>
                          </div>

                          {/* Expanded Bill Details */}
                          {expandedBookingId === booking.id && (
                            <div className="bg-muted/50 rounded-md p-2 space-y-2 max-h-[200px] overflow-y-auto">
                              {booking.unpaidBills && booking.unpaidBills.length > 0 && booking.unpaidBills.map((bill) => (
                                <div key={bill.id} className="text-xs border-b border-border pb-2 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center font-medium">
                                    <span className="text-destructive">
                                      Bill #{bill.id.slice(-6)}
                                    </span>
                                    <Badge variant="destructive" className="text-[10px] h-5">Unpaid</Badge>
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {bill.items && bill.items.map((item: BillItem, idx: number) => (
                                      <div key={idx} className="flex justify-between text-muted-foreground">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>{formatCurrency(item.price * item.quantity)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-border">
                                    <span>Total</span>
                                    <span className="text-destructive">{formatCurrency(bill.total)}</span>
                                  </div>
                                </div>
                              ))}
                              {booking.paidBills && booking.paidBills.length > 0 && booking.paidBills.map((bill) => (
                                <div key={bill.id} className="text-xs border-b border-border pb-2 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center font-medium">
                                    <span className="text-green-600">
                                      Bill #{bill.id.slice(-6)}
                                    </span>
                                    <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] h-5">Paid</Badge>
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {bill.items && bill.items.map((item: BillItem, idx: number) => (
                                      <div key={idx} className="flex justify-between text-muted-foreground">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>{formatCurrency(item.price * item.quantity)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-border">
                                    <span>Total</span>
                                    <span className="text-green-600">{formatCurrency(bill.total)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> Bills
                          </span>
                          <Badge variant="outline" className="text-xs">
                            0
                          </Badge>
                        </div>
                      )}

                      {/* Unpaid Bills Section - More Prominent */}
                      {booking.totalUnpaid > 0 ? (
                        <div className="flex justify-between items-center bg-destructive/10 rounded-md px-2 py-1.5 -mx-0.5">
                          <span className="text-sm text-destructive font-medium flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4" /> Unpaid Bills
                          </span>
                          <span className="font-bold text-destructive">
                            {formatCurrency(booking.totalUnpaid)}
                          </span>
                        </div>
                      ) : booking.totalBilled > 0 ? (
                        <div className="flex justify-between items-center bg-green-50 rounded-md px-2 py-1.5 -mx-0.5">
                          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4" /> All Paid
                          </span>
                          <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                            Settled
                          </Badge>
                        </div>
                      ) : null}
                    </div>

                    <Button
                      className="w-full mt-2"
                      variant={booking.totalUnpaid > 0 ? "default" : "default"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBillToRoom(booking);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Bill to Room
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
