'use client';

import * as React from 'react';
import type { Payment, GymMembershipPlan, UserProfile } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getGymHistoryColumns } from './gym-history-columns';
import { EmptyState } from '@/components/ui/empty-state';
import { History } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';
import { RowSelectionState } from '@tanstack/react-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';

interface GymHistoryTableProps {
  data: (Payment & { planId?: string, membershipFee?: number })[];
  currency: string;
  isLoading: boolean;
  membershipPlans: GymMembershipPlan[];
  onReprintReceipt: (payment: Payment) => void;
  onRefund: (payment: Payment) => void;
  searchTerm?: string;
}

export function GymHistoryTable({ data, currency, isLoading, membershipPlans, onReprintReceipt, onRefund, searchTerm }: GymHistoryTableProps) {
    const firestore = useFirestore();
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    const { hasPermission } = usePermissions();
    const canManageMembers = hasPermission(PagePermission.MANAGE_GYM_MEMBERS);

    const usersQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

    const userMap = React.useMemo(() => {
        if (!users) return new Map<string, UserProfile>();
        return new Map(users.map(u => [u.uid, u]));
    }, [users]);

  const columns = React.useMemo(() => getGymHistoryColumns({ currency, membershipPlans, onReprintReceipt, onRefund, userMap, canManageMembers }), [currency, membershipPlans, onReprintReceipt, onRefund, userMap, canManageMembers]);

  if (isLoading || areUsersLoading) {
    return <p>Loading history...</p>;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No Transaction History"
        description="Payments for gym memberships will appear here."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      tableId="gym-history"
      filterColumn="guestName"
      filterPlaceholder="Search by member name..."
    />
  );
}
