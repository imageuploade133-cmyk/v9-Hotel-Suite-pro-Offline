
'use client';

import * as React from 'react';
import { useUser } from '@/contexts/user-context';
import { useFirestore, useCollection } from '@/firebase';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { collection, query, where, orderBy, limit, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { NotificationDetailsDialog } from './notification-details-dialog';
import type { Notification } from '@/lib/types';
import { NotificationItem } from './notification-item';

export function NotificationBell() {
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isMarking, setIsMarking] = React.useState(false);
  const [selectedNotification, setSelectedNotification] = React.useState<Notification | null>(null);

  const notificationsQuery = React.useMemo(() => {
    if (!userProfile?.id || !firestore) return null;
    return query(
      collection(firestore, `users/${userProfile.id}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
  }, [userProfile?.id, firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const { unreadCount, unreadNotifications, readNotifications } = React.useMemo(() => {
    const unread = notifications?.filter((n) => !n.read) || [];
    const read = notifications?.filter((n) => n.read) || [];
    return { unreadCount: unread.length, unreadNotifications: unread, readNotifications: read };
  }, [notifications]);

  const markAllAsRead = async () => {
    if (!firestore || !userProfile?.id || unreadCount === 0) return;

    setIsMarking(true);
    try {
      const batch = writeBatch(firestore);
      unreadNotifications.forEach((n) => {
        const notifRef = doc(firestore, `users/${userProfile.id}/notifications`, n.id);
        batch.update(notifRef, { read: true });
      });
      await batch.commit();
      toast({
        variant: 'success',
        title: 'Success',
        description: 'All notifications marked as read.',
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not mark all notifications as read.',
      });
    } finally {
      setIsMarking(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.read && firestore && userProfile?.id) {
        const notifRef = doc(firestore, `users/${userProfile.id}/notifications`, notification.id);
        try {
            await updateDoc(notifRef, { read: true });
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10" title="Notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span className="text-base font-bold">Notifications</span>
                {unreadCount > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary"
                    onClick={markAllAsRead}
                    disabled={isMarking}
                  >
                    {isMarking ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                    Mark all as read
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-96">
                {isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications && notifications.length > 0 ? (
                  <>
                    {unreadNotifications.length > 0 && (
                      <>
                        <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-semibold uppercase">New</DropdownMenuLabel>
                        {unreadNotifications.map(n => <NotificationItem key={n.id} notification={n} onSelect={handleNotificationClick} />)}
                      </>
                    )}
                    {readNotifications.length > 0 && (
                      <>
                        {unreadNotifications.length > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-semibold uppercase">Previous</DropdownMenuLabel>
                        {readNotifications.map(n => <NotificationItem key={n.id} notification={n} onSelect={handleNotificationClick} />)}
                      </>
                    )}
                  </>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">You have no new notifications.</div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
      </DropdownMenu>
      <NotificationDetailsDialog
        notification={selectedNotification}
        open={!!selectedNotification}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNotification(null);
          }
        }}
      />
    </>
  );
}
