
'use client';

import * as React from 'react';
import { Home, Image as ImageIcon, Building2 } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { DashboardLoading } from '@/components/dashboard/dashboard-loading';
import { ReprintReceiptDialog } from '@/components/payments/reprint-receipt-dialog';
import { CancellationInvoiceDialog } from '@/components/bookings/cancellation-invoice-dialog';
import { DashboardMetrics } from '@/components/dashboard/dashboard-metrics';
import { MySales } from '@/components/dashboard/my-sales';
import { NetIncomeByMethod } from '@/components/dashboard/net-income-by-method';
import { WeeklyOverview } from '@/components/dashboard/weekly-overview';
import { TopSellingProducts } from '@/components/dashboard/top-selling-products';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { ResponsiveBookingDetails } from '@/components/dashboard/responsive-booking-details';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DueCheckoutsDialog } from '@/components/dashboard/due-checkouts-dialog';
import type { Booking, Payment } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { DiscountSummary } from '@/components/dashboard/discount-summary';
import { RoomAndPosSummary } from '@/components/dashboard/room-and-pos-summary';

function DashboardPage() {
  const { userProfile, loading: isProfileLoading, permissions } = useUser();
  const { currentBranch, isBranchMode } = useBranch();
  const canViewTodaysIncome = permissions.includes(PagePermission.VIEW_TODAYS_INCOME);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [isDueCheckoutsOpen, setDueCheckoutsOpen] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<any>(undefined);
  const [receiptBooking, setReceiptBooking] = React.useState<Booking | null>(null);
  const [cancellationBooking, setCancellationBooking] = React.useState<Booking | null>(null);
  const [imageToView, setImageToView] = React.useState<string | null>(null);

  const [incomeFilter, setIncomeFilter] = React.useState<'today' | 'yesterday' | 'lastWeek' | 'custom'>('today');
  const [posIncomeFilter, setPosIncomeFilter] = React.useState<'today' | 'yesterday' | 'lastWeek'>('today');
  const [monthlyIncomeFilter, setMonthlyIncomeFilter] = React.useState<string>('this-month');
  const [yearlyIncomeFilter, setYearlyIncomeFilter] = React.useState<string>('this-year');

  const { data: dashboardData, isLoading } = useDashboardData({
    dateRange,
    incomeFilter,
    posIncomeFilter,
    monthlyIncomeFilter,
    yearlyIncomeFilter
  });

  const paymentForReceipt: Payment | null = React.useMemo(() => {
    if (!receiptBooking) return null;
    return {
      id: receiptBooking.bookingId || receiptBooking.id,
      guestName: receiptBooking.guestName,
      guestEmail: receiptBooking.guestEmail,
      amount: receiptBooking.totalAmount || 0,
      paymentMethod: receiptBooking.paymentMethod!,
      transactionDate: getSafeDate(receiptBooking.createdAt) || new Date(),
      status: receiptBooking.status,
      type: 'Booking',
      createdByUid: receiptBooking.createdByUid!,
      bookingDetails: receiptBooking,
    };
  }, [receiptBooking]);


  const handleDateChange = (newDateRange: any) => {
    setDateRange(newDateRange);
    if (newDateRange === undefined) {
      setIncomeFilter('today');
    } else {
      setIncomeFilter('custom');
    }
  };

  const handleReprint = (booking: Booking) => {
      if (booking.status === 'Cancelled' || booking.status === 'Refunded') {
          setCancellationBooking(booking);
      } else {
          setReceiptBooking(booking);
      }
  }

  if (isLoading || isProfileLoading) {
    return <DashboardLoading />;
  }


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Home className="h-10 w-10 text-primary" />
              <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
                {isBranchMode && currentBranch && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{currentBranch.name} Branch</span>
                  </div>
                )}
              </div>
            </div>
            <DateRangePicker date={dateRange} onDateChange={handleDateChange} />
          </div>
          <p className="text-muted-foreground">
            Welcome, {userProfile?.name || 'Manager'}! Here's a summary of your
            {isBranchMode && currentBranch ? ` ${currentBranch.name}` : ' hotel'}'s operations.
          </p>
        </div>

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <DashboardMetrics
            data={dashboardData}
            incomeFilter={incomeFilter}
            setIncomeFilter={setIncomeFilter}
            monthlyIncomeFilter={monthlyIncomeFilter}
            setMonthlyIncomeFilter={setMonthlyIncomeFilter}
            yearlyIncomeFilter={yearlyIncomeFilter}
            setYearlyIncomeFilter={setYearlyIncomeFilter}
            dateRange={dateRange}
            canViewTodaysIncome={canViewTodaysIncome}
          />
          <div className="mt-4 flex items-center justify-center">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                {isExpanded ? 'Show Less' : 'Show More Stats'}
                <ChevronDown
                  className={cn(
                    'ml-2 h-4 w-4 transition-transform',
                    isExpanded && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </Collapsible>

        <RoomAndPosSummary
          data={dashboardData}
          posIncomeFilter={posIncomeFilter}
          setPosIncomeFilter={setPosIncomeFilter}
        />

        <NetIncomeByMethod data={dashboardData} />

        {userProfile && <MySales data={dashboardData} />}

        <div className="grid gap-6 lg:grid-cols-3">
          <WeeklyOverview data={dashboardData} />
          <TopSellingProducts data={dashboardData} />
        </div>

        <DiscountSummary data={dashboardData} />

        <RecentActivity data={dashboardData} onReprint={handleReprint} onViewImage={setImageToView}/>

      </div>
      <ResponsiveBookingDetails open={isSheetOpen} onOpenChange={setSheetOpen} />
      <DueCheckoutsDialog
        isOpen={isDueCheckoutsOpen}
        onClose={() => setDueCheckoutsOpen(false)}
        onCheckedOut={() => {}}
      />
      <ReprintReceiptDialog isOpen={!!receiptBooking} onClose={() => setReceiptBooking(null)} payment={paymentForReceipt} />
      <CancellationInvoiceDialog isOpen={!!cancellationBooking} onClose={() => setCancellationBooking(null)} booking={cancellationBooking} />

      <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Guest Photo</DialogTitle>
          </DialogHeader>
          {imageToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageToView}
                alt="Guest Photo"
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(DashboardPage, PagePermission.VIEW_DASHBOARD);
