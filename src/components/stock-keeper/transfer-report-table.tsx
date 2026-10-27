'use client';

import * as React from 'react';
import type { TransferLog } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getTransferReportColumns } from './transfer-log-columns';
import { useSettings } from '@/contexts/settings-context';
import { EmptyState } from '../ui/empty-state';
import { FileText } from 'lucide-react';

interface TransferReportTableProps {
    transferLogs: TransferLog[];
    onViewSales: (log: TransferLog) => void;
}

export function TransferReportTable({ transferLogs, onViewSales }: TransferReportTableProps) {
    const { settings } = useSettings();
    const currency = settings?.currency || 'USD';

    const columns = React.useMemo(() => getTransferReportColumns({
        currency,
        onViewSales
    }), [currency, onViewSales]);

    if (!transferLogs || transferLogs.length === 0) {
        return (
            <EmptyState
                icon={FileText}
                title="No Transfer History"
                description="No stock has been transferred from staging to the main inventory yet."
            />
        )
    }

    return (
        <DataTable
            columns={columns}
            data={transferLogs}
            tableId="transfer-report-table"
            filterColumn="transferredBy"
            filterPlaceholder="Filter by staff name..."
        />
    );
}
