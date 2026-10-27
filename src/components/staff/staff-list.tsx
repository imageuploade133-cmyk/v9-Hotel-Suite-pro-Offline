
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy as firestoreOrderBy,
  getDocs,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  doc,
  setDoc,
  getDoc,
  where,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { getColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Users, ChevronLeft, ChevronRight, MessageSquareText } from 'lucide-react';
import type { UserProfile, Role } from '@/lib/types';
import { BulkActions } from '../customers/bulk-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';
import { useSettings } from '@/contexts/settings-context';
import { BulkMessageDialog } from '../messaging/bulk-whatsapp-dialog';
import { useBranch } from '@/contexts/branch-context';

const PAGE_SIZE = 10;
const TABLE_ID = 'staff';

interface StaffListProps {
  onEdit: (staff: UserProfile) => void;
  onDelete: (staff: UserProfile) => void;
  onToggleStatus: (staff: UserProfile) => void;
  onViewSalary: (staff: UserProfile) => void;
  reloadCounter: number;
}

export function StaffList({ onEdit, onDelete, onToggleStatus, onViewSalary, reloadCounter }: StaffListProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { branches } = useBranch();
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [isMessageOpen, setIsMessageOpen] = React.useState(false);
  const [selectedForMessage, setSelectedForMessage] = React.useState<UserProfile[]>([]);

  const staffQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), firestoreOrderBy('name'));
  }, [firestore, reloadCounter]);

  const { data: staff, isLoading } = useCollection<UserProfile>(staffQuery);

  const rolesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roles'));
  }, [firestore, reloadCounter]);
  const { data: roles, isLoading: areRolesLoading } = useCollection<Role>(rolesQuery);


  React.useEffect(() => {
    if (!firestore || !user) return;
    const configDocId = `${user.uid}_${TABLE_ID}`;
    const configDocRef = doc(firestore, 'table-configurations', configDocId);

    getDoc(configDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        setColumnVisibility(docSnap.data().visibility || {});
      }
    });
  }, [firestore, user]);

  const handleColumnVisibilityChange = async (updater: React.SetStateAction<VisibilityState>) => {
    if (!firestore || !user) return;

    const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
    setColumnVisibility(newVisibility);

    const configDocId = `${user.uid}_${TABLE_ID}`;
    const configDocRef = doc(firestore, 'table-configurations', configDocId);
    try {
      await setDoc(configDocRef, { visibility: newVisibility }, { merge: true });
    } catch (error) {
      console.error("Failed to save column visibility:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save column preferences.',
      });
    }
  };

  const handleBulkMessage = (items: UserProfile[]) => {
    setSelectedForMessage(items);
    setIsMessageOpen(true);
  };
  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';

  const columns = React.useMemo(
    () =>
      getColumns({
        onEdit: onEdit,
        onDelete: onDelete,
        onToggleStatus,
        onViewSalary,
        roles: roles || [],
        currency: settings?.currency || 'USD',
        payday: settings?.salaryPayday || 28,
        branches: branches || [],
      }),
    [onEdit, onDelete, onToggleStatus, onViewSalary, roles, settings, branches]
  );

  const isDataLoading = isLoading || areRolesLoading;

  if (isDataLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!staff || staff.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No Staff Found"
        description="You don't have any staff members yet. Get started by inviting one."
        className="h-full"
      />
    );
  }

  return (
    <>
        <div className="flex flex-col h-full">
        <DataTable
            columns={columns}
            data={staff || []}
            filterColumn="name"
            filterPlaceholder="Filter staff by name or email..."
            tableId={TABLE_ID}
            isPaginated
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={handleColumnVisibilityChange}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
        >
            {(table) => (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                    const selectedData = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
                    setSelectedForMessage(selectedData);
                    setIsMessageOpen(true);
                    }}
                    disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Message Selected ({table.getFilteredSelectedRowModel().rows.length})
                </Button>
            )}
        </DataTable>
        </div>
         <BulkMessageDialog
            isOpen={isMessageOpen}
            onClose={() => setIsMessageOpen(false)}
            recipients={selectedForMessage}
        />
    </>
  );
}
