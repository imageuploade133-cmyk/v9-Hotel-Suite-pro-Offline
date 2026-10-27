'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  LogOut,
  LayoutDashboard,
  BedDouble,
  Users,
  History,
  Settings,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  Wind,
  Wrench,
  Wallet,
  User,
  CalendarClock,
  Bed,
  Shield,
  ChefHat,
  Utensils,
  UserCheck,
  BellOff,
  BookUser,
  Dumbbell,
  WashingMachine,
  Scissors,
  Package,
  ShoppingCart,
  Tags,
  Truck,
  TrendingUp,
  Undo2,
  CreditCard,
  PackagePlus,
  AlertTriangle,
  Landmark,
  FileText,
  MessageSquareText,
  Banknote,
  Clock,
  Printer,
  BookOpenCheck,
  MessageSquareWarning,
  Link as LinkIcon,
  Globe,
  AppWindow,
  Archive,
  ConciergeBell,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useUser } from '@/contexts/user-context';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/helpers';
import { useCollection, useFirestore } from '@/firebase';
import { query, collection, onSnapshot, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import type { Booking, Order, StockItem, GuestReport } from '@/lib/types';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { PagePermission } from '@/lib/permissions';
import { useSettings } from '@/contexts/settings-context';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useRoomStatus } from '@/hooks/use-room-status';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RewardCelebration } from '@/components/dashboard/reward-celebration';


const NavIcon = ({ iconName }: { iconName: string }) => {
  return <DynamicIcon iconName={iconName} className="h-5 w-5" />;
};


const NavLink = ({
  item,
  isCollapsed,
}: {
  item: { href: string; icon: React.ElementType | string; label: string, notificationCount?: number };
  isCollapsed: boolean;
}) => {
  const pathname = usePathname();
  const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');

  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-3 justify-start px-3 py-2 transition-all rounded-lg',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            isCollapsed ? 'justify-center w-auto' : 'w-full'
          )}
        >
          {typeof Icon === 'string' ? (
            <NavIcon iconName={Icon} />
          ) : (
            <Icon className="h-5 w-5" />
          )}
          {!isCollapsed && <span className="flex-1">{item.label}</span>}
          {!isCollapsed && item.notificationCount && item.notificationCount > 0 && (
            <Badge variant="destructive" className={cn("rounded-full px-2", "blinking-red-badge")}>{item.notificationCount}</Badge>
          )}
        </Link>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right">
          {item.label}
          {item.notificationCount && item.notificationCount > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">({item.notificationCount})</span>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const { userProfile, loading: userProfileLoading } = useUser();
  const { settings } = useSettings();
  const { individualRoomsByStatus } = useRoomStatus();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const firestore = useFirestore();
  const { toast, dismiss } = useToast();
  const guestReportToastId = React.useRef<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const soundIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const soundPlayCountRef = React.useRef(0);

  const reservationsQuery = React.useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'bookings'),
      where('status', 'in', ['Booked', 'Reserved'])
    );
  }, [firestore, user]);

  const { data: reservations } = useCollection<Booking>(reservationsQuery);

  const activeCheckinsQuery = React.useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'bookings'),
        where('status', 'in', ['Active', 'Checked-in'])
    );
  }, [firestore, user]);
  const { data: activeCheckins } = useCollection<Booking>(activeCheckinsQuery);


  const activeOrdersQuery = React.useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', 'in', ['Pending', 'Preparing', 'Billed'])
    );
  }, [firestore, user]);
  const { data: activeOrders } = useCollection<Order>(activeOrdersQuery);

  const stockItemsQuery = React.useMemo(() => firestore && user ? query(collection(firestore, 'stock')) : null, [firestore, user]);
  const { data: stockItems } = useCollection<StockItem>(stockItemsQuery);

  const { data: guestReports } = useCollection<GuestReport>(React.useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'guestReports'),
        where('status', '==', 'new')
    );
  }, [firestore, user]));

  useEffect(() => {
    if (!firestore || !user) return;

    const q = query(
      collection(firestore, 'guestReports'),
      where('status', '==', 'new')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newReportsCount = snapshot.size;

      if (newReportsCount > 0 && !guestReportToastId.current) {
        const { id } = toast({
          variant: 'destructive',
          title: 'New Guest Report Received!',
          description: `${newReportsCount} new report(s) require your attention.`,
          duration: 20000,
          action: <Button onClick={() => router.push('/guest-reports')}>View Reports</Button>,
        });
        guestReportToastId.current = id;

        if (settings?.enableGuestReportSound && audioRef.current) {
          soundPlayCountRef.current = 0;
          if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);

          const playSound = () => {
             if (soundPlayCountRef.current < 3) {
              audioRef.current?.play().catch(e => console.error("Sound play failed:", e));
              soundPlayCountRef.current += 1;
            } else {
              if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
            }
          };

          playSound();
          soundIntervalRef.current = setInterval(playSound, 5000);
        }

      } else if (newReportsCount === 0 && guestReportToastId.current) {
        dismiss(guestReportToastId.current);
        guestReportToastId.current = null;
        if (soundIntervalRef.current) {
          clearInterval(soundIntervalRef.current);
          soundIntervalRef.current = null;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    });

    return () => unsubscribe();
  }, [firestore, user, toast, dismiss, router, settings]);

  useEffect(() => {
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, []);

  React.useEffect(() => {
    const scrollableDiv = scrollRef.current;
    if (!scrollableDiv) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        localStorage.setItem('sidebarScrollTop', String(scrollableDiv.scrollTop));
      }, 150);
    };

    const savedScrollTop = localStorage.getItem('sidebarScrollTop');
    if (savedScrollTop) {
      scrollableDiv.scrollTop = parseInt(savedScrollTop, 10);
    }

    scrollableDiv.addEventListener('scroll', handleScroll);

    return () => {
      scrollableDiv.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const stockAlertCount = React.useMemo(() => {
    if (!stockItems) return 0;
    return stockItems.filter(item => item.quantity <= (item.lowStockThreshold || 0)).length;
  }, [stockItems]);

 const navGroups = React.useMemo(() => {
    const defaultHousekeepingStatuses = {
      'Vacant': { href: '/vacant-rooms', icon: Bed, permission: PagePermission.MANAGE_ROOM_STATUS },
      'Cleaning in Progress': { href: '/cleaning', icon: Wind, permission: PagePermission.VIEW_CLEANING_PAGE },
      'Maintenance': { href: '/maintenance', icon: Wrench, permission: PagePermission.VIEW_MAINTENANCE_PAGE },
      'Do Not Disturb': { href: '/do-not-disturb', icon: BellOff, permission: PagePermission.MANAGE_ROOM_STATUS }
    };

    const allStatuses = { ...individualRoomsByStatus };
    const housekeepingItems = Object.keys(allStatuses)
      .filter(status => status in defaultHousekeepingStatuses && status !== 'Occupied')
      .map(status => {
        const defaults = (defaultHousekeepingStatuses as any)[status];
        return {
          href: defaults?.href || `/status/${status.toLowerCase().replace(/\s+/g, '-')}`,
          icon: defaults?.icon || 'Tag',
          label: status,
          notificationCount: allStatuses[status]?.length || 0,
          permission: defaults?.permission || PagePermission.MANAGE_ROOM_STATUS,
        };
      })
      .sort((a, b) => {
        const order = Object.keys(defaultHousekeepingStatuses);
        return order.indexOf(a.label) - order.indexOf(b.label);
      });

    const customStatusItems = Object.keys(allStatuses)
        .filter(status => !(status in defaultHousekeepingStatuses) && status !== 'Occupied' && status !== 'Active Check-ins' && status !== 'Reserved')
        .map(status => ({
            href: `/status/${status.toLowerCase().replace(/\s+/g, '-')}`,
            icon: 'Tag',
            label: status,
            notificationCount: allStatuses[status]?.length || 0,
            permission: PagePermission.MANAGE_ROOM_STATUS,
        }))
        .sort((a,b) => a.label.localeCompare(b.label));

    const baseNavGroups = [
      {
        title: 'Main Menu',
        items: [
          { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: PagePermission.VIEW_DASHBOARD },
          { href: '/bookings', icon: BedDouble, label: 'Bookings', permission: PagePermission.VIEW_BOOKINGS_PAGE },
          { href: '/active-check-ins', icon: UserCheck, label: 'Active Check-ins', notificationCount: activeCheckins?.length || 0, permission: PagePermission.VIEW_BOOKINGS_PAGE },
          { href: '/reservations', icon: CalendarClock, label: 'Reservations', notificationCount: reservations?.length || 0, permission: PagePermission.VIEW_BOOKINGS_PAGE },
        ]
      },
      {
        title: 'Housekeeping',
        items: [
          { href: '/rooms', icon: Bed, label: 'All Rooms', permission: PagePermission.MANAGE_ROOM_STATUS },
          ...housekeepingItems,
          { href: '/laundry', icon: WashingMachine, label: 'Laundry', permission: PagePermission.VIEW_LAUNDRY_PAGE },
        ]
      },
      {
          title: 'Custom Room Status',
          items: customStatusItems
      },
       {
        title: 'Management',
        items: [
          { href: '/accounting', icon: Landmark, label: 'Accounting', permission: PagePermission.VIEW_ACCOUNTING_PAGE },
          { href: '/kitchen', icon: ChefHat, label: 'Kitchen Orders', notificationCount: activeOrders?.length || 0, permission: PagePermission.VIEW_KITCHEN_PAGE },
          { href: '/pos', icon: ShoppingCart, label: 'Point of Sale', permission: PagePermission.VIEW_POS },
          { href: '/staff-analytics', icon: TrendingUp, label: 'Staff Analytics', permission: PagePermission.VIEW_STAFF_ANALYTICS },
          { href: '/staff-working-hrs', icon: Clock, label: 'Staff Working Hrs', permission: PagePermission.VIEW_STAFF_WORKING_HOURS },
          { href: '/salary', icon: Banknote, label: 'Salary / Dockets', permission: PagePermission.VIEW_ACCOUNTING_PAGE },
          { href: '/expenses', icon: FileText, label: 'Expenses', permission: PagePermission.MANAGE_EXPENSES },
          { href: '/customers', icon: Users, label: 'Hotel Customers', permission: PagePermission.VIEW_CUSTOMERS_PAGE },
          { href: '/guest-engagement', icon: LinkIcon, label: 'Guest Engagement', permission: PagePermission.MANAGE_GUEST_ENGAGEMENT },
          { href: '/guest-reports', icon: MessageSquareWarning, label: 'Guest Reports', notificationCount: guestReports?.length || 0, permission: PagePermission.VIEW_GUEST_REPORTS },
          { href: '/pos-customers', icon: Users, label: 'POS Customers', permission: PagePermission.MANAGE_POS_CUSTOMERS },
          { href: '/gym-management', icon: Dumbbell, label: 'Gym Management', permission: PagePermission.VIEW_GYM_PAGE },
          { href: '/barbing-salon', icon: Scissors, label: 'Barbing Salon', permission: PagePermission.VIEW_SALON_PAGE },
          { href: '/services', icon: ConciergeBell, label: 'Services / Foods', permission: PagePermission.VIEW_SERVICES_PAGE },
          { href: '/suppliers', icon: Truck, label: 'Suppliers', permission: PagePermission.MANAGE_SUPPLIERS },
          { href: '/stock-keeper', icon: Archive, label: 'Stock Keeper', permission: PagePermission.VIEW_STOCK_MANAGEMENT },
          { href: '/stock-management', icon: Package, label: 'Stock Management', permission: PagePermission.VIEW_STOCK_MANAGEMENT },
          { href: '/stock-alerts', icon: AlertTriangle, label: 'Stock Alerts', notificationCount: stockAlertCount || 0, permission: PagePermission.VIEW_STOCK_ALERTS },
          { href: '/stock-restock', icon: PackagePlus, label: 'Restock Inventory', permission: PagePermission.RESTOCK_INVENTORY, enabled: settings?.enableRestock },
          { href: '/stock-audit', icon: History, label: 'Stock Audit', permission: PagePermission.VIEW_STOCK_AUDIT },
          { href: '/stock-categories', icon: Tags, label: 'Stock Categories', permission: PagePermission.MANAGE_STOCK_CATEGORIES },
          { href: '/credit-sales', icon: CreditCard, label: 'Credit Sales', permission: PagePermission.MANAGE_CREDIT_SALES },
          { href: '/refund-sales', icon: Undo2, label: 'Refund Sales', permission: PagePermission.PROCESS_SALE_REFUNDS },
          { href: '/product-sales', icon: TrendingUp, label: 'Product Sales', permission: PagePermission.VIEW_SALES_REPORTS },
          { href: '/sales-history', icon: TrendingUp, label: 'Sales History', permission: PagePermission.VIEW_SALES_REPORTS },
          { href: '/guest-folio', icon: BookUser, label: 'Guest Folio', permission: PagePermission.VIEW_GUEST_FOLIO },
          { href: '/print-room-bill', icon: Printer, label: 'Print Room Bill', permission: PagePermission.VIEW_ACCOUNTING_PAGE },
          { href: '/payments', icon: Wallet, label: 'Payments', permission: PagePermission.VIEW_PAYMENTS_PAGE },
          { href: '/history', icon: History, label: 'Booking History', permission: PagePermission.VIEW_BOOKINGS_PAGE },
        ]
      },
      {
        title: 'Profile',
        items: [
            { href: '/profile', icon: User, label: 'Profile', permission: PagePermission.MANAGE_OWN_PROFILE },
        ]
      },
      {
          title: 'Administration',
          items: [
              { href: '/tutorial', icon: BookOpenCheck, label: 'Tutorial', permission: PagePermission.VIEW_TUTORIAL_PAGE },
              { href: '/whatsapp', icon: MessageSquareText, label: 'WhatsApp Messaging', permission: PagePermission.MANAGE_WHATSAPP_MESSAGING },
              { href: '/webapp', icon: AppWindow, label: 'Web App Studio', permission: PagePermission.MANAGE_GENERAL_SETTINGS },
              { href: '/settings', icon: Settings, label: 'Settings', permission: PagePermission.VIEW_SETTINGS_PAGE },
              { href: '/staff', icon: Users, label: 'Staff', permission: PagePermission.MANAGE_STAFF },
              { href: '/roles', icon: Shield, label: 'Roles & Permissions', permission: PagePermission.MANAGE_ROLES },
              { href: '/global-audit', icon: History, label: 'Global Audit', permission: PagePermission.VIEW_GLOBAL_AUDIT },
          ]
      }
    ];

    // Since all authenticated users have full access, no permission filtering is needed.
    return baseNavGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
            const isEnabled = (item as any).enabled === undefined || (item as any).enabled === true;
            return isEnabled;
        }),
      }))
      .filter(group => group.items.length > 0);

  }, [activeCheckins, reservations, activeOrders, individualRoomsByStatus, stockAlertCount, guestReports, settings]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (loading || userProfileLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       {showCelebration && <RewardCelebration onCelebrationEnd={() => setShowCelebration(false)} />}
       {settings?.enableGuestReportSound && (
        <audio ref={audioRef} src={settings.guestReportNotificationSoundUrl || 'https://cdn.pixabay.com/download/audio/2022/10/13/audio_8238140449.mp3'} />
      )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-10 hidden flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 sm:flex',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          <div
            className={cn(
              'flex h-16 items-center border-b',
              isCollapsed ? 'justify-center px-2' : 'px-6'
            )}
          >
            <Link
              href="/dashboard"
              className="group flex items-center justify-center gap-2 text-lg font-semibold"
            >
              <Logo className="h-8 w-8 text-primary" />
              {!isCollapsed && (
                <span className="text-lg font-bold text-foreground">
                  Hotel Suite Pro
                </span>
              )}
              <span className="sr-only">Hotel Suite Pro</span>
            </Link>
          </div>

          <nav ref={scrollRef} className="sidebar-nav flex-1 overflow-y-auto p-2 sm:py-5 space-y-2">
            {navGroups.map((group, groupIndex) => (
                <React.Fragment key={group.title}>
                    {group.items.length > 0 && groupIndex > 0 && !isCollapsed && <Separator className="my-4" />}
                    {group.items.length > 0 && (
                        <div key={group.title}>
                            {!isCollapsed && (
                                <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {group.title}
                                </h4>
                            )}
                            <div className={cn("space-y-1", isCollapsed ? 'items-center flex flex-col' : '')}>
                                {group.items.map(item => (
                                    <NavLink
                                    key={item.href}
                                    item={item as any}
                                    isCollapsed={isCollapsed}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </React.Fragment>
            ))}
          </nav>
        </aside>

        <div
          className={cn(
            'flex flex-col transition-all duration-300',
            isCollapsed ? 'sm:pl-20' : 'sm:pl-64'
          )}
        >
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="sm:hidden">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs p-0 flex flex-col">
                <SheetHeader className="h-16 border-b px-6 flex items-center">
                  <SheetTitle className="sr-only">Main Menu</SheetTitle>
                  <Link
                    href="/dashboard"
                    className="group flex items-center justify-center gap-2 text-lg font-semibold"
                  >
                    <Logo className="h-8 w-8 text-primary" />
                    <span className="text-lg font-bold text-foreground">Hotel Suite Pro</span>
                  </Link>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <nav className="grid gap-2 text-lg font-medium p-4">
                    {navGroups.flatMap(g => g.items).map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        {typeof item.icon === 'string' ? <NavIcon iconName={item.icon} /> : <item.icon className="h-5 w-5" />}
                        {item.label}
                        {item.notificationCount && item.notificationCount > 0 && (
                          <Badge variant={'destructive'} className="ml-auto rounded-full blinking-red-badge">{item.notificationCount}</Badge>
                        )}
                      </Link>
                    ))}
                  </nav>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <Button
              variant="outline"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={toggleSidebar}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle Sidebar</span>
            </Button>

            <div className="relative ml-auto flex items-center gap-2">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-10 w-10 border-2">
                      <AvatarImage
                        src={user.photoURL ?? ''}
                        alt={user.email ?? ''}
                      />
                      <AvatarFallback>
                        {userProfile?.name ? getInitials(userProfile.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userProfile?.name || 'Authenticated User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>

    </div>
  );
}