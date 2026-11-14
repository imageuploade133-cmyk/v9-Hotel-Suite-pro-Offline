
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  where,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { StockAuditLog, UserProfile, Settings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { History, ChevronLeft, ChevronRight, User, Search, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { getGlobalAuditColumns } from '@/components/history/global-audit-columns';
import GlobalAuditLoading from './loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { TopHeader } from '@/components/top-header';


const PAGE_SIZE = 25;

const CHANGE_TYPES = ['All', 'Create', 'Update', 'Delete', 'Login', 'Logout', 'Restock', 'Sale', 'Refund', 'Transfer', 'Check-in', 'Check-out', 'Cancel', 'Bill', 'Print', 'Reprint', 'Payment', 'Status Change'];
const MODULES = ['All', 'Bookings', 'Reservations', 'Inventory', 'Services & Foods', 'Menu', 'Point of Sale', 'Running Tables', 'Dockets', 'Customers', 'Staff', 'Payments', 'Settings', 'Housekeeping', 'Laundry', 'Gym', 'Salon', 'Other'];

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
  page,
  totalPages,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-end gap-4">
       <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


function GlobalAuditPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { settings } = useSettings();

  const [logs, setLogs] = React.useState<StockAuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('all');
  const [selectedChangeType, setSelectedChangeType] = React.useState<string>('All');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedModule, setSelectedModule] = React.useState('All');
  const [selectedStatus, setSelectedStatus] = React.useState('All');

  const { data: staffMembers } = useCollection<UserProfile>(React.useMemo(() => firestore ? query(collection(firestore, 'users'), orderBy('name')) : null, [firestore]));

  // Pagination state
  const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);

  const fetchLogs = React.useCallback(async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!firestore) return;
    setIsLoading(true);

    let constraints: QueryConstraint[] = [];
    if (dateRange?.from) constraints.push(where('timestamp', '>=', Timestamp.fromDate(dateRange.from)));
    if (dateRange?.to) constraints.push(where('timestamp', '<=', Timestamp.fromDate(dateRange.to)));
    if (selectedStaffId !== 'all') constraints.push(where('userId', '==', selectedStaffId));
    if (selectedChangeType !== 'All') constraints.push(where('changeType', '==', selectedChangeType));
    if (selectedModule !== 'All') constraints.push(where('module', '==', selectedModule));
    if (selectedStatus !== 'All') constraints.push(where('status', '==', selectedStatus));

    // Server-side search for broader fields
    if (searchTerm) {
        constraints.push(where('keywords', 'array-contains', searchTerm.toLowerCase()));
    }

    const baseQuery = query(collection(firestore, 'globalAuditLog'), ...constraints, orderBy('timestamp', 'desc'));

    if (direction === 'initial') {
        const countSnapshot = await getDocs(baseQuery);
        setTotalCount(countSnapshot.size);
    }

    let paginatedQuery;
    if (direction === 'next' && lastVisible) {
      paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      paginatedQuery = query(baseQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
      paginatedQuery = query(baseQuery, limit(PAGE_SIZE));
    }

    try {
      const snapshot = await getDocs(paginatedQuery);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAuditLog));

      setLogs(data);

      const newFirst = snapshot.docs[0] || null;
      const newLast = snapshot.docs[snapshot.docs.length - 1] || null;

      setFirstVisible(newFirst);
      setLastVisible(newLast);

      if (newLast) {
          const nextQuery = query(baseQuery, startAfter(newLast), limit(1));
          const nextSnapshot = await getDocs(nextQuery);
          setHasMore(!nextSnapshot.empty);
      } else {
          setHasMore(false);
      }

      if (direction === 'next') setPage(p => p + 1);
      else if (direction === 'prev' && page > 1) setPage(p => p - 1);
      else if (direction === 'initial') setPage(1);

    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch audit history.' });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, firstVisible, lastVisible, toast, dateRange, selectedStaffId, selectedChangeType, selectedModule, selectedStatus, searchTerm]);

  React.useEffect(() => {
    fetchLogs('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedStaffId, selectedChangeType, selectedModule, selectedStatus, searchTerm]);

  const columns = React.useMemo(() => getGlobalAuditColumns(), []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const uniqueUsersOnPage = new Set(logs.map(log => log.userId)).size;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCountOnPage = logs.filter(log => {
    const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp as any);
    return !Number.isNaN(date.getTime()) && date >= todayStart;
  }).length;
  const exportCsv = () => {
    const headers = ['Date & Time', 'User', 'Email', 'Role', 'Branch', 'Module', 'Action', 'Entity', 'Record ID', 'Description', 'Status'];
    const rows = logs.map(log => [log.timestamp?.toDate ? log.timestamp.toDate().toISOString() : '', log.userName, log.userEmail || '', log.userRole || '', log.branchName || '', log.module || log.entityType || '', log.action || log.changeType, log.entityName || '', log.entityId || log.documentId || '', log.description || log.notes || '', log.status || 'Success']);
    const csv = [headers, ...rows].map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'global-audit-log.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  if (isLoading && page === 1) {
    return <GlobalAuditLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <TopHeader name="Global Audit Log" icon={<History />} />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardDescription>Total matching records</CardDescription><CardTitle className="text-2xl tabular-nums">{totalCount.toLocaleString()}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Records on this page today</CardDescription><CardTitle className="text-2xl tabular-nums">{todayCountOnPage}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Staff represented on this page</CardDescription><CardTitle className="text-2xl tabular-nums">{uniqueUsersOnPage}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Current page</CardDescription><CardTitle className="text-2xl tabular-nums">{logs.length} / {PAGE_SIZE}</CardTitle></CardHeader></Card>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
               <div className="flex flex-wrap items-center gap-4">
                  <Input
                    placeholder="Search keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64"
                  />
                  <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger className="w-full sm:w-auto"><div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="All Staff" /></div></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {staffMembers?.map(staff => (
                        <SelectItem key={staff.id} value={staff.uid}>{staff.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedModule} onValueChange={setSelectedModule}>
                    <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="All Modules" /></SelectTrigger>
                    <SelectContent>{MODULES.map(module => <SelectItem key={module} value={module}>{module === 'All' ? 'All Modules' : module}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>{['All', 'Success', 'Failed', 'Pending', 'Reversed'].map(status => <SelectItem key={status} value={status}>{status === 'All' ? 'All Statuses' : status}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" onClick={exportCsv} disabled={!logs.length}>Export CSV</Button>
                  <Select value={selectedChangeType} onValueChange={setSelectedChangeType}>
                    <SelectTrigger className="w-full sm:w-auto"><div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="All Changes" /></div></SelectTrigger>
                    <SelectContent>
                      {CHANGE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={logs}
                isPaginated={false}
                tableId="global-audit-log"
                emptyStateIcon={History}
                emptyStateTitle="No Audit Records Found"
                emptyStateDescription="No records match your current filter criteria."
              />
          </CardContent>
          <CardFooter className="py-4 border-t">
              <PaginationControls
                canPrev={page > 1}
                canNext={hasMore}
                onPrev={() => fetchLogs('prev')}
                onNext={() => fetchLogs('next')}
                page={page}
                totalPages={totalPages}
              />
            </CardFooter>
        </Card>
      </div>
    </>
  );
}

export default withAuth(GlobalAuditPage, PagePermission.VIEW_GLOBAL_AUDIT);
