"use client"

import { ColumnDef } from "@tanstack/react-table"
import type { StockAuditLog } from "@/lib/types"; // Re-using for structure
import { format } from "date-fns"
import { getSafeDate } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";

const getChangeColor = (changeType: StockAuditLog['changeType']) => {
    switch (changeType) {
        case 'Create': return 'bg-green-100 text-green-800 dark:bg-green-900/20 border-green-500';
        case 'Update': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 border-yellow-500';
        case 'Delete': return 'bg-red-100 text-red-800 dark:bg-red-900/20 border-red-500';
        case 'Login': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 border-blue-500';
        case 'Sale': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 border-blue-500';
        case 'Refund': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 border-purple-500';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 border-gray-500';
    }
}

const renderChange = (value: any) => {
    if (value === null || value === undefined || value === 'not set' || value === '') {
        return <span className="text-muted-foreground italic">N/A</span>;
    }
     if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    return String(value);
}

export const getGlobalAuditColumns = (): ColumnDef<StockAuditLog>[] => [
    {
        accessorKey: 'timestamp',
        header: 'Date & Time',
        cell: ({ row }) => {
            const date = getSafeDate(row.original.timestamp)!;
            return (
                <div className="flex flex-col">
                    <span>{format(date, "EEEE, MM-dd-yyyy")}</span>
                    <span className="text-xs text-muted-foreground">{format(date, "h:mm:ss a")}</span>
                </div>
            )
        },
    },
    {
        accessorKey: 'userName',
        header: 'User',
    },
    {
        accessorKey: 'changeType',
        header: 'Action',
         cell: ({ row }) => <Badge className={getChangeColor(row.original.changeType)}>{row.original.changeType}</Badge>,

    },
    {
        accessorKey: 'entityType',
        header: 'Entity Type',
    },
    {
        accessorKey: 'entityId',
        header: 'Entity ID',
        cell: ({ row }) => <div className="font-mono text-xs max-w-[100px] truncate">{row.original.entityId}</div>
    },
    {
        id: 'fieldChanged',
        header: 'Field',
        cell: ({ row }) => (
          <div className="space-y-1 text-xs max-w-md">
            {row.original.changes?.map((change, index) => (
              <div key={index} className="font-semibold capitalize">
                {change.field.replace(/([A-Z])/g, ' $1')}
              </div>
            ))}
             {row.original.notes && <p className="italic text-muted-foreground pt-1">{row.original.notes}</p>}
             {(row.original.details && typeof row.original.details === 'object' && 'message' in row.original.details) ? <p className="italic text-muted-foreground pt-1">{row.original.details.message}</p> :
             (row.original.details && typeof row.original.details === 'string') && <p className="italic text-muted-foreground pt-1">{row.original.details}</p>}
          </div>
        )
    },
    {
        id: 'before',
        header: 'Before',
        cell: ({ row }) => (
          <div className="space-y-1 text-xs max-w-md font-mono">
            {row.original.changes?.map((change, index) => (
              <div key={index} className="text-destructive">
                {renderChange(change.before)}
              </div>
            ))}
          </div>
        )
    },
    {
        id: 'after',
        header: 'After',
        cell: ({ row }) => (
          <div className="space-y-1 text-xs max-w-md font-mono">
            {row.original.changes?.map((change, index) => (
              <div key={index} className="font-bold text-green-600">
                {renderChange(change.after)}
              </div>
            ))}
          </div>
        )
    }
]
