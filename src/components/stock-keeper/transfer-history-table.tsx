
'use client';

import * as React from 'react';
import type { TransferLog } from '@/lib/types';
import {
  collection,
  query,
  orderBy,
  where,
  Timestamp,
  QueryConstraint,
  onSnapshot,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { DataTable } from '@/components/ui/data-table';
import { getTransferReportColumns } from './transfer-log-columns';
import { EmptyState } from '../ui/empty-state';
import { History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '../ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Button } from '../ui/button';
import { useSettings } from '@/contexts/settings-context';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useBranch } from '@/contexts/branch-context';

interface TransferHistoryTableProps {
  onPrintReceipt: (log: any) => void;
  onReverse: (log: any) => void;
}

export function TransferHistoryTable({ onPrintReceipt, onReverse }: TransferHistoryTableProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { settings } = useSettings();
    const { getCollectionPath } = useBranch();
    const currency = settings?.currency || 'USD';

    const [logs, setLogs] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    const transferLogCollection = React.useMemo(() => getCollectionPath('transferLog'), [getCollectionPath]);

    React.useEffect(() => {
        if (!firestore) return;
        setIsLoading(true);

        let constraints: QueryConstraint[] = [orderBy('transferredAt', 'desc')];
        if (dateRange?.from) constraints.push(where('transferredAt', '>=', Timestamp.fromDate(dateRange.from)));
        if (dateRange?.to) constraints.push(where('transferredAt', '<=', Timestamp.fromDate(dateRange.to)));

        const q = query(collection(firestore, transferLogCollection), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLogs(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching transfer logs:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch transfer history.' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, toast, dateRange, transferLogCollection]);


    const columns = React.useMemo(() => getTransferReportColumns({ currency, onPrintReceipt, onReverse }), [currency, onPrintReceipt, onReverse]);

    return (
        <Card>
             <CardHeader>
                <div className="flex justify-end">
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <DataTable
                    columns={columns}
                    data={logs}
                    tableId="transfer-history-log"
                    isPaginated={true}
                    emptyStateIcon={History}
                    emptyStateTitle="No Transfer History"
                    emptyStateDescription="Transfers from staging to inventory will appear here."
                    isLoading={isLoading}
                    filterColumn="transferredBy"
                    filterPlaceholder="Filter by staff name..."
                />
            </CardContent>
        </Card>
    )
}
