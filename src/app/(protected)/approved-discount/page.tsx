
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/helpers';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import { Percent, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function ApprovedDiscountPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);

  const usersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

  const handleToggle = async (user: UserProfile, canApprove: boolean) => {
    if (!firestore) return;
    setIsUpdating(user.uid);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const permission = PagePermission.APPLY_DISCOUNTS;

      if (canApprove) {
        await updateDoc(userRef, { permissions: arrayUnion(permission) });
      } else {
        await updateDoc(userRef, { permissions: arrayRemove(permission) });
      }

      toast({
        title: 'Permission Updated',
        description: `${user.name} can ${canApprove ? 'now' : 'no longer'} apply discounts.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update permission.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <TopHeader
        name="Discount Approvals"
        icon={<Percent className="h-10 w-10" />}
        description="Grant or revoke permission for staff members to apply discounts in the Point of Sale."
      />
      <Card>
        <CardHeader>
          <CardTitle>Staff Discount Permissions</CardTitle>
          <CardDescription>
            Toggle the switch to allow or disallow a user from applying discounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                ))
            ) : (
                users?.map((user) => (
                    <div key={user.uid} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={(user as any).photoURL} alt={user.name} />
                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUpdating === user.uid && <Loader2 className="h-4 w-4 animate-spin" />}
                          <Switch
                            checked={user.permissions?.includes(PagePermission.APPLY_DISCOUNTS) || false}
                            onCheckedChange={(checked) => handleToggle(user, checked)}
                            disabled={isUpdating !== null}
                          />
                        </div>
                    </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(ApprovedDiscountPage, PagePermission.MANAGE_ROLES);
