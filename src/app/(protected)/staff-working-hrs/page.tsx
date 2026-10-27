
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  Timestamp,
  QueryConstraint,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { StockAuditLog, UserProfile, Settings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Clock, User, Search, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { useWorkingHrsColumns } from '@/components/staff-working-hrs/columns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { addMinutes } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { EmptyState } from '@/components/ui/empty-state';
import { TopHeader } from '@/components/top-header';


const PAGE_SIZE = 15;

function PaginationControls({ onPrev, onNext, canPrev, canNext }: { onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean; }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" onClick={onNext} disabled={!canNext}>
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StaffWorkingHrsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();

  const [logs, setLogs] = React.useState<StockAuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'On Time' | 'Late'>('all');

  const [allStaff, setAllStaff] = React.useState<UserProfile[]>([]);

  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);


  const userMap = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    allStaff.forEach(user => map.set(user.uid, user));
    return map;
  }, [allStaff]);

  React.useEffect(() => {
    if (!firestore) return;
    const fetchStaff = async () => {
      const usersQuery = query(collection(firestore, 'users'), orderBy('name'));
      const adProfilesQuery = query(collection(firestore, 'AD Profile'));
      const [usersSnapshot, adProfilesSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(adProfilesQuery)]);

      const adProfilesMap = new Map(adProfilesSnapshot.docs.map(doc => [doc.id, doc.data()]));

      const combinedUsers = usersSnapshot.docs.map(doc => {
          const baseProfile = { id: doc.id, ...doc.data() } as UserProfile;
          const adProfile = adProfilesMap.get(doc.id) || {};
          return { ...baseProfile, ...adProfile };
      });
      setAllStaff(combinedUsers);
    };
    fetchStaff();
  }, [firestore]);

  const getStatus = React.useCallback((log: StockAuditLog): 'On Time' | 'Late' | 'On Duty' => {
      const userProfile = userMap.get(log.userId);
      const shift = userProfile?.shift;

      if (!shift) {
          return 'On Time';
      }

      const shiftSettings = settings?.shiftSettings;
      if (!shiftSettings) {
          return 'On Time';
      }

      if (shift === '24hrs') {
          if (shiftSettings.twentyFourHours?.trackLateness && shiftSettings.twentyFourHours.lateAfterTime) {
            const workStartTime = shiftSettings.twentyFourHours.lateAfterTime;
            const gracePeriod = 0; // No grace for this type
            const loginTime = getSafeDate(log.timestamp);
            if (!loginTime) return 'Late';
            const [startHours, startMinutes] = workStartTime.split(':').map(Number);
            const workStartToday = new Date(loginTime);
            workStartToday.setHours(startHours, startMinutes, 0, 0);
            const deadline = addMinutes(workStartToday, gracePeriod);
            return loginTime > deadline ? 'Late' : 'On Time';
          }
          return 'On Duty';
      }


      const shiftConfig = shift === 'Morning' ? shiftSettings.morning : shiftSettings.night;
      const workStartTime = shiftConfig.startTime;
      const gracePeriod = shiftConfig.lateGracePeriod || 0;

      const loginTime = getSafeDate(log.timestamp);
      if (!loginTime) return 'Late';

      const [startHours, startMinutes] = workStartTime.split(':').map(Number);
      const workStartToday = new Date(loginTime);
      workStartToday.setHours(startHours, startMinutes, 0, 0);

      const deadline = addMinutes(workStartToday, gracePeriod);

      return loginTime <= deadline ? 'On Time' : 'Late';
  }, [userMap, settings]);

  const fetchLogs = React.useCallback(async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!firestore) return;
    setIsLoading(true);

    let constraints: QueryConstraint[] = [
        where('changeType', '==', 'Login'),
    ];

    if (dateRange?.from) constraints.push(where('timestamp', '>=', Timestamp.fromDate(dateRange.from)));
    if (dateRange?.to) constraints.push(where('timestamp', '<=', Timestamp.fromDate(dateRange.to)));
    if (selectedStaffId !== 'all') constraints.push(where('userId', '==', selectedStaffId));

    let baseQuery = query(collection(firestore, 'globalAuditLog'), ...constraints, orderBy('timestamp', 'desc'));

    let paginatedQuery = baseQuery;
    const isInitialOrReload = direction === 'initial';

    if (isInitialOrReload) {
        setPage(1);
        setFirstVisible(null);
        setLastVisible(null);
        paginatedQuery = query(baseQuery, limit(PAGE_SIZE));
    } else if (direction === 'next' && lastVisible) {
        paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
        paginatedQuery = query(baseQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
    }


    try {
      const snapshot = await getDocs(paginatedQuery);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAuditLog));

      setLogs(data);

      if (!snapshot.empty) {
        const newFirst = snapshot.docs[0];
        const newLast = snapshot.docs[snapshot.docs.length - 1];
        setFirstVisible(newFirst);
        setLastVisible(newLast);

        const nextQuery = query(baseQuery, startAfter(newLast), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        setHasMore(!nextSnapshot.empty);

        if (direction === 'next') setPage(p => p + 1);
        if (direction === 'prev' && page > 1) setPage(p => p - 1);

      } else {
          if (isInitialOrReload) setLogs([]);
          setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch working hours history.' });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, firstVisible, lastVisible, toast, dateRange, selectedStaffId]);

  React.useEffect(() => {
    fetchLogs('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedStaffId]);


  const paginatedLogs = React.useMemo(() => {
    if (filterStatus === 'all') {
        return logs;
    }
    return logs.filter(log => getStatus(log) === filterStatus);
  }, [logs, filterStatus, getStatus]);

  const { lateCount, onTimeCount } = React.useMemo(() => {
    let late = 0;
    let onTime = 0;
    logs.forEach(log => {
      const status = getStatus(log);
      if (status === 'Late') late++;
      else if (status === 'On Time') onTime++;
    });
    return { lateCount: late, onTimeCount: onTime };
  }, [logs, getStatus]);

  const columns = useWorkingHrsColumns({ settings, userMap });

  const handleNextPage = () => fetchLogs('next');
  const handlePrevPage = () => fetchLogs('prev');

  const canNextPage = hasMore;
  const canPrevPage = page > 1;

  const isDataLoading = isLoading;


  if (isDataLoading) {
    return (
        <div className="flex flex-col gap-6">
            <TopHeader name="Staff Working Hours" icon={<Clock />} />
            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                <div className="space-y-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <TopHeader name="Staff Working Hours" icon={<Clock />} />

         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
                title="Total Logins (Filtered)"
                value={logs.length}
                icon={User}
                description="Total logins recorded for the filtered period."
            />
            <StatCard
                title="On Time Arrivals"
                value={onTimeCount}
                icon={CheckCircle}
                description="Logins within the grace period."
                className="border-green-500 text-green-600"
            />
            <StatCard
                title="Late Arrivals"
                value={lateCount}
                icon={AlertTriangle}
                description="Logins after the grace period."
                className={lateCount > 0 ? "border-destructive text-destructive" : ""}
            />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
               <div className="flex flex-wrap items-center gap-4">
                  <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger className="w-full sm:w-auto"><div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="All Staff" /></div></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {allStaff?.map(staff => (
                        <SelectItem key={staff.id} value={staff.uid}>{staff.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
                    <SelectTrigger className="w-full sm:w-auto"><div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filter by Status" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="On Time">On Time</SelectItem>
                        <SelectItem value="Late">Late</SelectItem>
                    </SelectContent>
                </Select>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={paginatedLogs}
                isPaginated={false}
                tableId="working-hours-log"
                emptyStateIcon={History}
                emptyStateTitle="No Login Records Found"
                emptyStateDescription="No records match your current filter criteria."
                filterColumn="userName"
                filterPlaceholder="Filter by staff name..."
              />
          </CardContent>
           {logs.length > 0 && (
            <CardFooter className="py-4 border-t">
                <PaginationControls
                  canPrev={canPrevPage}
                  canNext={canNextPage}
                  onPrev={handlePrevPage}
                  onNext={handleNextPage}
                />
              </CardFooter>
          )}
        </Card>
      </div>
    </>
  );
}

export default withAuth(StaffWorkingHrsPage, PagePermission.VIEW_STAFF_WORKING_HOURS);
