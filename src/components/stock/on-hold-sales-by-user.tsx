
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { UserProfile, HeldSale, UnifiedItem, Branch } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Hand, User, DollarSign, ChevronDown, ShoppingCart, Building } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/user-context';
import { Button } from '../ui/button';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { PagePermission } from '@/lib/permissions';
import { useBranch } from '@/contexts/branch-context';

interface UserHeldSales {
  user: UserProfile;
  sales: HeldSale[];
  salesCount: number;
  totalValue: number;
}

interface OnHoldSalesByUserProps {
  globalHeldSales?: HeldSale[];
}

export function OnHoldSalesByUser({ globalHeldSales }: OnHoldSalesByUserProps = {}) {
  const firestore = useFirestore();
  const { userProfile: adminProfile, loading: isAdminProfileLoading } = useUser();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const { hasPermission } = usePermissions();
  const canViewPOS = hasPermission(PagePermission.VIEW_POS);
  const { getCollectionPath, isGlobalMode } = useBranch();


  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const branchesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'branches'));
  }, [firestore]);
  const { data: branches, isLoading: areBranchesLoading } = useCollection<Branch>(branchesQuery);

  // Use global data if provided, otherwise query from current branch
  const heldSalesQuery = React.useMemo(() => {
    if (!firestore || globalHeldSales) return null;
    return query(collection(firestore, getCollectionPath('heldSales')));
  }, [firestore, getCollectionPath, globalHeldSales]);
  const { data: branchHeldSales, isLoading: areBranchHeldSalesLoading } = useCollection<HeldSale>(heldSalesQuery);

  const heldSales = globalHeldSales || branchHeldSales || [];
  const areHeldSalesLoading = globalHeldSales ? false : areBranchHeldSalesLoading;
  const isLoading_final = areUsersLoading || areHeldSalesLoading || isAdminProfileLoading || areBranchesLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const usersWithHeldSales: UserHeldSales[] = React.useMemo(() => {
    if (!users || !heldSales) return [];

    const allUsers = [...users];
    if (adminProfile && !allUsers.some(u => u.uid === adminProfile.uid)) {
        allUsers.push(adminProfile);
    }

    const userMap = new Map<string, UserProfile>(allUsers.map(u => [u.uid, u]));
    const salesByUser = new Map<string, { sales: HeldSale[], salesCount: number; totalValue: number }>();

    heldSales.forEach(sale => {
      const userStats = salesByUser.get(sale.heldByUid) || { sales: [], salesCount: 0, totalValue: 0 };
      userStats.sales.push(sale);
      userStats.salesCount += 1;
      userStats.totalValue += (sale.cart || []).reduce((sum, item) => sum + ((item.price || item.sellingPrice) * (item.sellQuantity as number)), 0);
      salesByUser.set(sale.heldByUid, userStats);
    });

    const result: UserHeldSales[] = [];
    salesByUser.forEach((stats, userId) => {
      const userProfile = userMap.get(userId);
      if (userProfile) {
        result.push({
          user: userProfile,
          ...stats,
        });
      }
    });

    return result.sort((a, b) => b.totalValue - a.totalValue);
  }, [users, adminProfile, heldSales]);

  const getBranchName = React.useCallback((branchId: string | undefined) => {
    if (!branchId) return null;
    return branches?.find(b => b.id === branchId)?.name || 'Unknown Branch';
  }, [branches]);

  if (isLoading_final) {
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
    )
  }

  if (usersWithHeldSales.length === 0) {
    return null; // Don't render the card if no one has sales on hold
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-2">
                <Hand className="h-6 w-6 text-yellow-500" />
                Running Tables by Staff
                </CardTitle>
                <CardDescription>
                Overview of tables currently active by each staff member. Click to expand.
                </CardDescription>
            </div>
            {canViewPOS && (
                <Button asChild>
                    <Link href="/pos">
                        <ShoppingCart className="mr-2 h-4 w-4" /> Go to POS
                    </Link>
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {usersWithHeldSales.map(({ user, salesCount, totalValue, sales }) => (
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
                                <span>{salesCount} sale(s)</span>
                                <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
                            </div>
                        </div>
                         <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="p-4 border-t space-y-4">
                        {sales.map(sale => (
                             <Card key={sale.id} className="bg-background">
                                <CardHeader className="pb-2">
                                    <div className="flex flex-col gap-2">
                                      <CardTitle className="text-base flex justify-between">
                                          <span>{sale.name}</span>
                                          <span className="text-muted-foreground font-medium">{sale.customer?.name || "Walk-in"}</span>
                                      </CardTitle>
                                      {sale.branchId && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Building className="h-3 w-3" />
                                          <span>{getBranchName(sale.branchId)}</span>
                                        </div>
                                      )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sale.cart.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.name}</TableCell>
                                                    <TableCell className="text-center">{item.sellQuantity}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency((item.price || item.sellingPrice) * (item.sellQuantity as number))}</TableCell>
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
