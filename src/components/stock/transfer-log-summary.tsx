'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { UserProfile, TransferLog, StockItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Truck, User, DollarSign, ChevronDown } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { useBranch } from '@/contexts/branch-context';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';

interface UserTransferStats {
  user: UserProfile;
  transfers: TransferLog[];
  transferCount: number;
  totalValue: number;
}

export function TransferLogSummary() {
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const { getCollectionPath, isGlobalMode } = useBranch();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  // Branch / POS mode query
  const branchTransferLogQuery = useMemoFirebase(() => {
    if (!firestore || isGlobalMode) return null;
    return query(collection(firestore, getCollectionPath('transferLog')), orderBy('transferredAt', 'desc'));
  }, [firestore, isGlobalMode, getCollectionPath]);
  const branchResult = useCollection<TransferLog>(branchTransferLogQuery);

  // Global mode query
  const globalResult = useGlobalCollectionData<TransferLog>('transferLog');

  const transferLogs = isGlobalMode ? globalResult.data : branchResult.data;
  const areLogsLoading = isGlobalMode ? globalResult.isLoading : branchResult.isLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const usersWithTransfers: UserTransferStats[] = React.useMemo(() => {
    if (!users || !transferLogs) return [];

    const userMap = new Map<string, UserProfile>(users.map(u => [u.uid, u]));
    const transfersByUser = new Map<string, { transfers: TransferLog[], transferCount: number; totalValue: number }>();

    transferLogs.forEach(log => {
      const userStats = transfersByUser.get(log.transferredByUid) || { transfers: [], transferCount: 0, totalValue: 0 };
      userStats.transfers.push(log);
      userStats.transferCount += 1;
      userStats.totalValue += log.totalValue;
      transfersByUser.set(log.transferredByUid, userStats);
    });

    const result: UserTransferStats[] = [];
    transfersByUser.forEach((stats, userId) => {
      const userProfile = userMap.get(userId);
      if (userProfile) {
        result.push({
          user: userProfile,
          ...stats,
        });
      }
    });

    return result.sort((a, b) => b.totalValue - a.totalValue);
  }, [users, transferLogs]);

  const isLoading = areUsersLoading || areLogsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (usersWithTransfers.length === 0) {
    return null; // Don't render if no transfers have been made
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Stock Transfers by Staff
            </CardTitle>
            <CardDescription>
              Summary of items transferred from staging to main inventory by staff.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {usersWithTransfers.map(({ user, transferCount, totalValue, transfers }) => (
            <Collapsible key={user.uid} className="border rounded-lg">
              <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.photoURL || undefined} alt={user.name} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-bold">{user.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{transferCount} transfer(s)</span>
                      <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 border-t space-y-4">
                  {transfers.map(log => (
                    <Card key={log.id} className="bg-background">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex justify-between">
                          <span>{log.supplier ? `From ${log.supplier}` : 'General Transfer'}</span>
                          <span className="text-muted-foreground font-medium">{formatCurrency(log.totalValue)}</span>
                        </CardTitle>
                        <CardDescription>{format(getSafeDate(log.transferredAt)!, 'PPpp')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-center">Qty</TableHead>
                              <TableHead className="text-right">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(log.items as StockItem[]).map(item => (
                              <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency((item.costPrice || 0) * item.quantity)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
