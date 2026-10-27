
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

const CHANGE_TYPES = ['All', 'Create', 'Update', 'Delete', 'Login', 'Logout', 'Sale', 'Refund', 'Check-in', 'Check-out', 'Cancel', 'Bill'];

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
  }, [firestore, firstVisible, lastVisible, toast, dateRange, selectedStaffId, selectedChangeType, searchTerm]);

  React.useEffect(() => {
    fetchLogs('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedStaffId, selectedChangeType, searchTerm]);

  const columns = React.useMemo(() => getGlobalAuditColumns(), []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (isLoading && page === 1) {
    return <GlobalAuditLoading />;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <TopHeader name="Global Audit Log" icon={<History />} />
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
