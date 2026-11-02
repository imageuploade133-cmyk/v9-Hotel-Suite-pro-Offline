
'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  Percent,
  Building2,
  Settings2,
  Volume2,
  VolumeX,
  CalendarPlus,
  Copy,
  Download,
  Layers,
  List,
  Calculator,
  MoreHorizontal,
  Moon,
  Sun,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useUser } from '@/contexts/user-context';
import Link from 'next/link';
import { ZoomControls } from '@/components/ui/zoom-controls';
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
import { getInitials, sanitizeForUrl } from '@/lib/helpers';
import { Badge } from '@/components/ui/badge';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { PagePermission } from '@/lib/permissions';
import { useSettings } from '@/contexts/settings-context';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { LanSyncStatusIndicator } from '@/components/lan-sync/LanSyncStatusIndicator';
import { useRoomStatus } from '@/hooks/use-room-status';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { RewardCelebration } from '@/components/dashboard/reward-celebration';
import { AppBadgeUpdater } from '@/components/notifications/app-badge-updater';
import { DailyReportTrigger } from '@/components/settings/daily-report-trigger';
import { useFirestore, useCollection } from '@/firebase';
import { query, collection, onSnapshot, where } from 'firebase/firestore';
import type { Booking, Order, StockItem, GuestReport, LaundryOrder, Notification } from '@/lib/types';
import { useAppInstall } from '@/contexts/app-install-context';
import { useBranch } from '@/contexts/branch-context';
import { FinancialProvider } from '@/contexts/financial-context';
import { Building, Check } from 'lucide-react';
import { FullscreenLoader } from '@/components/ui/fullscreen-loader';
import { useTheme } from 'next-themes';


const NavIcon = ({ iconName }: { iconName: string }) => {
  return <DynamicIcon iconName={iconName} className="h-5 w-5" />;
};

const DEFAULT_HOUSEKEEPING_STATUSES = {
  'Vacant': { href: '/status/vacant', icon: Bed, permission: PagePermission.MANAGE_ROOM_STATUS },
  'Cleaning in Progress': { href: '/status/cleaning-in-progress', icon: Wind, permission: PagePermission.VIEW_CLEANING_PAGE },
  'Maintenance': { href: '/status/maintenance', icon: Wrench, permission: PagePermission.VIEW_MAINTENANCE_PAGE },
  'Do Not Disturb': { href: '/status/do-not-disturb', icon: BellOff, permission: PagePermission.MANAGE_ROOM_STATUS }
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

  const linkContent = (
    <>
      {typeof Icon === 'string' ? (
        <NavIcon iconName={Icon} />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      {!isCollapsed && <span className="flex-1">{item.label}</span>}
      {!isCollapsed && item.notificationCount && item.notificationCount > 0 && (
        <Badge variant="destructive" className={cn("rounded-full px-2", "blinking-red-badge")}>{item.notificationCount}</Badge>
      )}
    </>
  );

  // When collapsed, wrap with tooltip. When expanded, render Link directly.
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 justify-start px-3 py-2 transition-all rounded-lg',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground primary-hover',
                'justify-center w-auto'
              )}
            >
              {linkContent}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
            {item.notificationCount && item.notificationCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">({item.notificationCount})</span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Expanded sidebar - Link without tooltip wrapper
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 justify-start px-3 py-2 transition-all rounded-lg',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground primary-hover',
        'w-full'
      )}
    >
      {linkContent}
    </Link>
  );
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, logout } = useAuth();
  const { userProfile, loading: profileLoading, dynamicPermissionGroups } = useUser();
  const { settings, isLoading: areSettingsLoading } = useSettings();
  const { individualRoomsByStatus, roomStatusesData } = useRoomStatus();
  const { canInstall, triggerInstall } = useAppInstall();
  const { branches, currentBranchId, currentBranch, selectBranch, isBranchMode, isGlobalMode, userAccessibleBranches, isRestrictedToBranch } = useBranch();
  const { toast, dismiss } = useToast();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const firestore = useFirestore();

  const [isSoundMuted, setIsSoundMuted] = React.useState(false);
  const [newReservationsCount, setNewReservationsCount] = React.useState(0);
  const [newOrdersCount, setNewOrdersCount] = React.useState(0);
  const [newLaundryOrdersCount, setNewLaundryOrdersCount] = React.useState(0);
  const [newReportsCount, setNewReportsCount] = React.useState(0);
  const [stockAlertCount, setStockAlertCount] = React.useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const guestReportToastId = React.useRef<string | null>(null);
  const soundIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const soundPlayCountRef = React.useRef(0);

  // Real-time listeners for notifications - memoize queries to prevent excessive re-subscriptions
  const bookingsQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'bookings'), where('status', 'in', ['Booked', 'Reserved'])) : null,
    [firestore]
  );
  const ordersQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'orders'), where('status', 'in', ['Pending'])) : null,
    [firestore]
  );
  const laundryQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'laundry'), where('status', '==', 'Pending')) : null,
    [firestore]
  );
  const stockQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'stock')) : null,
    [firestore]
  );
  const guestReportsQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'guestReports'), where('status', '==', 'new')) : null,
    [firestore]
  );
  const notificationsQuery = React.useMemo(() =>
    userProfile?.id ? query(collection(firestore, `users/${userProfile.id}/notifications`), where('read', '==', false)) : null,
    [firestore, userProfile?.id]
  );

  // Memoize onData callbacks to prevent infinite re-render loops
  const handleReservationsData = React.useCallback((data: Booking[]) => setNewReservationsCount(data.length), []);
  const handleOrdersData = React.useCallback((data: Order[]) => setNewOrdersCount(data.length), []);
  const handleLaundryData = React.useCallback((data: LaundryOrder[]) => setNewLaundryOrdersCount(data.length), []);
  const handleStockData = React.useCallback((data: StockItem[]) => setStockAlertCount(data.filter(item => item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 0)).length), []);
  const handleGuestReportsData = React.useCallback((data: GuestReport[]) => setNewReportsCount(data.length), []);
  const handleNotificationsData = React.useCallback((data: Notification[]) => setUnreadNotificationsCount(data.length), []);

  useCollection<Booking>(bookingsQuery, { onData: handleReservationsData });
  useCollection<Order>(ordersQuery, { onData: handleOrdersData });
  useCollection<LaundryOrder>(laundryQuery, { onData: handleLaundryData });
  useCollection<StockItem>(stockQuery, { onData: handleStockData });
  useCollection<GuestReport>(guestReportsQuery, { onData: handleGuestReportsData });
  useCollection<Notification>(notificationsQuery, { onData: handleNotificationsData });

  // Guest Report Sound/Toast Logic
  React.useEffect(() => {
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
  }, [newReportsCount, toast, dismiss, router, settings]);

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}/website`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied!',
      description: 'The public website link has been copied to your clipboard.',
    });
  };

  // Use actual user permissions from user-context (which defaults to full Administrator permissions)
  const { permissions: contextPermissions } = useUser();
  const isSuperAdmin = !userProfile || userProfile?.isSuperAdmin || userProfile?.role === 'Super Admin' || userProfile?.role === 'Admin';
  const finalPermissions = (userProfile?.permissions && userProfile.permissions.length > 0) ? userProfile.permissions : contextPermissions;
  const canManageRoomStatus = isSuperAdmin || finalPermissions.includes(PagePermission.MANAGE_ROOM_STATUS);

  const navGroups = React.useMemo(() => {
    const allStatuses = { ...individualRoomsByStatus };
    const housekeepingItems = Object.keys(allStatuses)
      .filter(status => status in DEFAULT_HOUSEKEEPING_STATUSES && status !== 'Occupied')
      .map(status => {
        const defaults = (DEFAULT_HOUSEKEEPING_STATUSES as any)[status];
        return {
          href: defaults?.href || `/status/${sanitizeForUrl(status)}`,
          icon: defaults?.icon || 'Tag',
          label: status,
          notificationCount: allStatuses[status]?.length || 0,
          permission: defaults?.permission || PagePermission.MANAGE_ROOM_STATUS,
        };
      })
      .sort((a, b) => {
        const order = Object.keys(DEFAULT_HOUSEKEEPING_STATUSES);
        return order.indexOf(a.label) - order.indexOf(b.label);
      });

    const customStatusItems = (roomStatusesData || [])
        .filter((status: any) => status.showInSidebar && !(status.name in DEFAULT_HOUSEKEEPING_STATUSES))
        .map((status: any) => ({
            href: `/status/${sanitizeForUrl(status.name)}`,
            icon: status.iconName || 'Tag',
            label: status.name,
            notificationCount: allStatuses[status.name]?.length || 0,
            permission: `view:${sanitizeForUrl(status.name)}`,
        }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

    // POS Section items - Each item requires its specific permission
    // Staff without the specific permission won't see that item in the menu
    const posSectionItems = [
      { href: '/pos', icon: ShoppingCart, label: 'Point of Sale', permission: PagePermission.VIEW_POS, requiredPermission: PagePermission.VIEW_POS },
      { href: '/my-sales-history', icon: History, label: 'My Sales History', permission: PagePermission.VIEW_MY_SALES_HISTORY, requiredPermission: PagePermission.VIEW_MY_SALES_HISTORY },
      { href: '/pos-customers', icon: Users, label: 'POS Customers', permission: PagePermission.MANAGE_POS_CUSTOMERS, requiredPermission: PagePermission.MANAGE_POS_CUSTOMERS },
      { href: '/running-tables', icon: List, label: 'Running Tables', permission: PagePermission.VIEW_RUNNING_TABLES, requiredPermission: PagePermission.VIEW_RUNNING_TABLES },
      { href: '/product-sales', icon: TrendingUp, label: 'Product Sales', permission: PagePermission.VIEW_SALES_REPORTS, requiredPermission: PagePermission.VIEW_SALES_REPORTS },
      { href: '/sales-history', icon: TrendingUp, label: 'Sales History', permission: PagePermission.VIEW_SALES_REPORTS, requiredPermission: PagePermission.VIEW_SALES_REPORTS },
      { href: '/credit-sales', icon: CreditCard, label: 'Credit Sales', permission: PagePermission.MANAGE_CREDIT_SALES, requiredPermission: PagePermission.MANAGE_CREDIT_SALES },
      { href: '/refund-sales', icon: Undo2, label: 'Refund Sales', permission: PagePermission.PROCESS_SALE_REFUNDS, requiredPermission: PagePermission.PROCESS_SALE_REFUNDS },
      { href: '/pos-accounting', icon: Calculator, label: 'POS Accounting', permission: PagePermission.VIEW_POS_ACCOUNTING, requiredPermission: PagePermission.VIEW_POS_ACCOUNTING },
      { href: '/pos-management', icon: Building2, label: 'POS Management', permission: PagePermission.MANAGE_POS_SETTINGS, requiredPermission: PagePermission.MANAGE_POS_SETTINGS },
      { href: '/pos/settings', icon: Settings, label: 'POS Settings', permission: PagePermission.MANAGE_POS_SETTINGS, requiredPermission: PagePermission.MANAGE_POS_SETTINGS },
      { href: '/pos-categories', icon: Layers, label: 'POS Categories', permission: PagePermission.MANAGE_POS_CATEGORIES, requiredPermission: PagePermission.MANAGE_POS_CATEGORIES },
    ];

    // Management Section items - Only available to users with VIEW_MANAGEMENT permission
    const managementSectionItems = [
      { href: '/accounting', icon: Landmark, label: 'Accounting', permission: PagePermission.VIEW_ACCOUNTING_PAGE },
      { href: '/kitchen', icon: ChefHat, label: 'Kitchen Orders', notificationCount: newOrdersCount, permission: PagePermission.VIEW_KITCHEN_PAGE },
      { href: '/restaurant', icon: Utensils, label: 'Restaurant', permission: PagePermission.VIEW_RESTAURANT_PAGE },
      { href: '/approved-discount', icon: Percent, label: 'Discount Approvals', permission: PagePermission.MANAGE_ROLES },
      { href: '/staff-analytics', icon: TrendingUp, label: 'Staff Analytics', permission: PagePermission.VIEW_STAFF_ANALYTICS },
      { href: '/staff-working-hrs', icon: Clock, label: 'Staff Working Hrs', permission: PagePermission.VIEW_STAFF_WORKING_HOURS },
      { href: '/salary', icon: Banknote, label: 'Salary / Dockets', permission: PagePermission.VIEW_ACCOUNTING_PAGE },
      { href: '/expenses', icon: FileText, label: 'Expenses', permission: PagePermission.MANAGE_EXPENSES },
      { href: '/customers', icon: Users, label: 'Hotel Customers', permission: PagePermission.VIEW_CUSTOMERS_PAGE },
      { href: '/guest-engagement', icon: LinkIcon, label: 'Guest Engagement', permission: PagePermission.MANAGE_GUEST_ENGAGEMENT },
      { href: '/guest-reports', icon: MessageSquareWarning, label: 'Guest Reports', notificationCount: newReportsCount, permission: PagePermission.VIEW_GUEST_REPORTS },
      { href: '/gym-management', icon: Dumbbell, label: 'Gym Management', permission: PagePermission.VIEW_GYM_PAGE },
      { href: '/barbing-salon', icon: Scissors, label: 'Barbing Salon', permission: PagePermission.VIEW_SALON_PAGE },
      { href: '/services', icon: ConciergeBell, label: 'Services / Foods', permission: PagePermission.VIEW_SERVICES_PAGE },
      { href: '/suppliers', icon: Truck, label: 'Suppliers', permission: PagePermission.MANAGE_SUPPLIERS },
      { href: '/stock-keeper', icon: Archive, label: 'Stock Keeper', permission: PagePermission.VIEW_STOCK_MANAGEMENT },
      { href: '/stock-management', icon: Package, label: 'Global Stock Management', permission: PagePermission.VIEW_STOCK_MANAGEMENT },
      { href: '/stock-alerts', icon: AlertTriangle, label: 'Stock Alerts', notificationCount: stockAlertCount || 0, permission: PagePermission.VIEW_STOCK_ALERTS },
      { href: '/stock-restock', icon: PackagePlus, label: 'Restock Inventory', permission: PagePermission.RESTOCK_INVENTORY, enabled: settings?.enableRestock },
      { href: '/guest-folio', icon: BookUser, label: 'Guest Folio', permission: PagePermission.VIEW_GUEST_FOLIO },
      { href: '/print-room-bill', icon: Printer, label: 'Print Room Bill', permission: PagePermission.VIEW_ACCOUNTING_PAGE },
      { href: '/payments', icon: Wallet, label: 'Payments', permission: PagePermission.VIEW_PAYMENTS_PAGE },
      { href: '/history', icon: History, label: 'Booking History', permission: PagePermission.VIEW_BOOKINGS_PAGE },
    ];

    // Check if user has any POS permissions to show the POS section
    // Uses requiredPermission to ensure we check the actual permission needed for each item
    const hasPosPermissions = posSectionItems.some(item =>
      finalPermissions.includes(item.requiredPermission || item.permission)
    );
    // Check if user has any Management permissions to show the Management section
    const hasManagementPermissions = managementSectionItems.some(item => finalPermissions.includes(item.permission as PagePermission));

    const baseNavGroups = [
      {
        title: 'Main Menu',
        items: [
          { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: PagePermission.VIEW_DASHBOARD },
          { href: '/bookings', icon: BedDouble, label: 'Bookings', permission: PagePermission.VIEW_BOOKINGS_PAGE },
          { href: '/bookings/create', icon: CalendarPlus, label: 'New Booking', permission: PagePermission.CREATE_BOOKING },
          { href: '/active-check-ins', icon: UserCheck, label: 'Active Check-ins', notificationCount: (individualRoomsByStatus['Active Check-ins'] || []).length, permission: PagePermission.VIEW_BOOKINGS_PAGE },
          { href: '/reservations', icon: CalendarClock, label: 'Reservations', notificationCount: newReservationsCount, permission: PagePermission.VIEW_BOOKINGS_PAGE },
        ]
      },
      {
        title: 'Housekeeping',
        items: [
          { href: '/rooms', icon: Bed, label: 'All Rooms', permission: PagePermission.VIEW_ROOMS_PAGE },
          ...housekeepingItems,
          { href: '/laundry', icon: WashingMachine, label: 'Laundry', notificationCount: newLaundryOrdersCount, permission: PagePermission.VIEW_LAUNDRY_PAGE },
        ]
      },
      ...(isBranchMode ? [] : [{
        title: 'Custom Room Status',
        items: customStatusItems
      }]),
      // POS Section - Show if user has any POS permissions
      ...(hasPosPermissions ? [{
        title: 'Point of Sale',
        items: posSectionItems
      }] : []),
      // Management Section - Only show if user has VIEW_MANAGEMENT and at least one management permission
      ...(finalPermissions.includes(PagePermission.VIEW_MANAGEMENT) && hasManagementPermissions ? [{
        title: 'Management',
        items: managementSectionItems
      }] : []),
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
              { href: '/settings/website-studio', icon: Globe, label: 'Website Studio', permission: PagePermission.MANAGE_GENERAL_SETTINGS },
              { href: '/settings/website-studio2', icon: AppWindow, label: 'Website Studio 2', permission: PagePermission.MANAGE_GENERAL_SETTINGS },
              { href: '/settings', icon: Settings, label: 'App Settings', permission: PagePermission.VIEW_SETTINGS_PAGE },
              { href: '/settings/page2', icon: Settings2, label: 'Settings Page 2', permission: PagePermission.MANAGE_GENERAL_SETTINGS },
              { href: '/branch/create', icon: Building, label: 'Create Branch', permission: PagePermission.MANAGE_BRANCHES },
              { href: '/branch/manage', icon: Building, label: 'Manage Branches', permission: PagePermission.MANAGE_BRANCHES },
              { href: '/staff', icon: Users, label: 'Staff', permission: PagePermission.MANAGE_STAFF },
              { href: '/roles', icon: Shield, label: 'Roles & Permissions', permission: PagePermission.MANAGE_ROLES },
              { href: '/global-audit', icon: History, label: 'Global Audit', permission: PagePermission.VIEW_GLOBAL_AUDIT },
          ]
      },
    ];

    // Define which routes are accessible in branch mode
    const BRANCH_ALLOWED_ROUTES = [
      '/pos',
      '/pos-customers',
      '/product-sales',
      '/sales-history',
      '/my-sales-history',
      '/pos-categories',
      '/pos/settings',
      '/pos-accounting',
      '/stock-keeper',
      '/stock-alerts',
      '/stock-restock',
      '/stock-management',
      '/running-tables',
      '/stock-categories',
      '/suppliers',
      '/credit-sales',
      '/services',
    ];

    // Determine if we should filter based on branch mode
    // All users are now admin, so no branch filtering needed
    const shouldFilterByBranch = false;

    return baseNavGroups
      .map(group => {
        // Special handling for the 'Custom Room Status' group
        if (group.title === 'Custom Room Status') {
            if (canManageRoomStatus) {
                return {
                    ...group,
                    items: group.items.filter(item => (item as any).enabled === undefined || (item as any).enabled === true),
                };
            }
        }

        return {
            ...group,
            items: group.items.filter(item => {
                // In branch mode, filter out items not in the allowed list
                if (shouldFilterByBranch) {
                    const href = (item as any).href;
                    const isAllowedInBranch = BRANCH_ALLOWED_ROUTES.some(route => href.startsWith(route));
                    if (!isAllowedInBranch) {
                        return false;
                    }
                }

                const isEnabled = (item as any).enabled === undefined || (item as any).enabled === true;
                // Use requiredPermission if available, otherwise fall back to permission
                const permissionId = (item as any).requiredPermission || (item as any).permission;
                const hasPerm = finalPermissions.includes(permissionId);

                // If no permission is defined, allow access
                if (!permissionId) {
                    return isEnabled;
                }

                // If it's a custom status page, grant access if the user has the umbrella 'manage:room_status' permission
                // Only apply this to custom statuses (href starts with /status/), not to all view: permissions
                const itemHref = (item as any).href;
                if (permissionId.startsWith('view:') && !hasPerm && itemHref?.startsWith('/status/')) {
                    return canManageRoomStatus;
                }

                return isEnabled && hasPerm;
            }),
        }
      })
      .filter(group => group.items.length > 0);

  }, [user, userProfile, individualRoomsByStatus, settings, newReservationsCount, newOrdersCount, newLaundryOrdersCount, newReportsCount, stockAlertCount, dynamicPermissionGroups, roomStatusesData, isBranchMode]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = React.useState(false);
  React.useEffect(() => setThemeMounted(true), []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Protect against infinite loading spinners by auto-releasing the spinner after a short delay
  const [forceReady, setForceReady] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setForceReady(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = !forceReady && (authLoading || profileLoading || areSettingsLoading);

  if (isLoading) {
    return (
      <FullscreenLoader
        message="Please wait..."
        subtext="Preparing your workspace"
      />
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <DailyReportTrigger />
       <AppBadgeUpdater count={unreadNotificationsCount} />
       {showCelebration && <RewardCelebration onCelebrationEnd={() => setShowCelebration(false)} />}
      <TooltipProvider>
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
              <Building2 className="h-8 w-8 text-primary" />
              {!isCollapsed && (
                <span className="text-lg font-bold text-foreground">
                  v9 Hotel Suite Pro
                </span>
              )}
              <span className="sr-only">v9 Hotel Suite Pro</span>
            </Link>
          </div>

          {/* Branch Selector in Sidebar - Desktop */}
          {userAccessibleBranches.length > 0 && (
            <div className={cn('border-b px-2 py-2', isCollapsed ? 'flex justify-center' : '')}>
              {isCollapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isBranchMode ? 'default' : 'outline'}
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {}}
                      >
                        <Building className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {currentBranch ? currentBranch.name : 'Select Branch'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : isRestrictedToBranch && userAccessibleBranches.length === 1 ? (
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Building className="h-3 w-3" />
                    Your Branch
                  </p>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary/90 text-primary-foreground rounded-lg">
                    <Building className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{userAccessibleBranches[0].name}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="h-3 w-3" />
                    Select Branch
                  </p>
                  {!isRestrictedToBranch && (
                    <button
                      onClick={() => selectBranch('global')}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all',
                        currentBranchId === 'global'
                          ? 'bg-primary/90 text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:bg-primary/20 hover:text-primary'
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">Global Branch</span>
                      {currentBranchId === 'global' && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  )}
                  {userAccessibleBranches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => selectBranch(branch.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all',
                        currentBranchId === branch.id
                          ? 'bg-primary/90 text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:bg-primary/20 hover:text-primary'
                      )}
                    >
                      <Building className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{branch.name}</span>
                      {currentBranchId === branch.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
                                      key={`${item.href}-${item.label}`}
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
          <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b bg-background px-2 sm:h-16 sm:gap-4 sm:px-6">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} disableHistory>
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
                    onClick={() => setMobileMenuOpen(false)}
                    className="group flex items-center justify-center gap-2 text-lg font-semibold"
                  >
                    <Building2 className="h-8 w-8 text-primary" />
                    <span className="text-lg font-bold text-foreground">v9 Hotel Suite Pro</span>
                  </Link>
                </SheetHeader>
                <ScrollArea className="min-h-0 flex-1">
                  {/* Branch Selector in Mobile Slide Menu */}
                  {userAccessibleBranches.length > 0 && (
                    <div className="border-b px-4 py-3">
                      {isRestrictedToBranch && userAccessibleBranches.length === 1 ? (
                        <>
                          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Building className="h-3 w-3" />
                            Your Branch
                          </p>
                          <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg">
                            <Building className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-left truncate">{userAccessibleBranches[0].name}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Building className="h-3 w-3" />
                            Select Branch
                          </p>
                          <div className="space-y-1">
                            {!isRestrictedToBranch && (
                              <button
                                onClick={() => { selectBranch('global'); setMobileMenuOpen(false); }}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all',
                                  currentBranchId === 'global'
                                    ? 'bg-primary text-primary-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )}
                              >
                                <Building2 className="h-4 w-4 shrink-0" />
                                <span className="flex-1 text-left truncate">Global Branch</span>
                                {currentBranchId === 'global' && <Check className="h-3.5 w-3.5 shrink-0" />}
                              </button>
                            )}
                            {userAccessibleBranches.map((branch) => (
                              <button
                                key={branch.id}
                                onClick={() => { selectBranch(branch.id); setMobileMenuOpen(false); }}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all',
                                  currentBranchId === branch.id
                                    ? 'bg-primary text-primary-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )}
                              >
                                <Building className="h-4 w-4 shrink-0" />
                                <span className="flex-1 text-left truncate">{branch.name}</span>
                                {currentBranchId === branch.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <nav className="grid gap-1.5 p-3 text-sm font-medium sm:gap-2 sm:p-4 sm:text-base">
                    {navGroups.flatMap(g => g.items).map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:py-2"
                      >
                        {typeof item.icon === 'string' ? <NavIcon iconName={item.icon} /> : <item.icon className="h-5 w-5" />}
                        <span className="min-w-0 flex-1 break-words">{item.label}</span>
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

            <div className="hidden w-full items-center justify-end gap-4 sm:flex md:ml-auto md:gap-2 lg:gap-4">
              {/* Active branch indicator in header */}
              {(isBranchMode || isGlobalMode) && currentBranch && (
                <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                  <Building className="h-3.5 w-3.5" />
                  <span>{currentBranch.name}</span>
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Globe className="mr-2 h-4 w-4" />
                    View Website
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/website" target="_blank">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Open in new tab
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
               <LanSyncStatusIndicator />
               <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="hidden sm:inline-flex" onClick={() => setIsSoundMuted(!isSoundMuted)}>
                            {isSoundMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                            <span className="sr-only">{isSoundMuted ? 'Unmute Sounds' : 'Mute Sounds'}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isSoundMuted ? 'Unmute all sounds' : 'Mute all sounds'}</p>
                    </TooltipContent>
                </Tooltip>
               </TooltipProvider>
              <ZoomControls />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 sm:hidden" aria-label="More header actions">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/website" target="_blank">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Open Website
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Website URL
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsSoundMuted(!isSoundMuted)}>
                    {isSoundMuted ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
                    {isSoundMuted ? 'Unmute Sounds' : 'Mute Sounds'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} disabled={!themeMounted}>
                    {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full sm:h-10 sm:w-10"
                  >
                    <Avatar className="h-8 w-8 border-2 sm:h-10 sm:w-10">
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
                  {canInstall && (
                    <DropdownMenuItem onClick={triggerInstall}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Install App</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="min-w-0 max-w-full flex-1 overflow-x-auto overflow-y-auto p-3 sm:p-6 lg:p-8">
            <FinancialProvider>
              {children}
            </FinancialProvider>
          </main>
        </div>
      </TooltipProvider>
    </div>
  );
}
