
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign, Percent, Tag, User } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';

export function DiscountSummary({ data }: any) {
  const { totalDiscount, todaysDiscount, discountsByStaff, userCurrency, isLoading } = data;
  const { userMap } = useUser();

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
    }).format(value);
  };

  const hasData = discountsByStaff && discountsByStaff.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            Discount Summary
        </CardTitle>
        <CardDescription>An overview of discounts given in the selected period.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
                title="Total Discount (Period)"
                value={formatCurrency(totalDiscount)}
                icon={DollarSign}
                description="Total value of all discounts given."
                className="border-yellow-500 text-yellow-600"
                isLoading={isLoading}
            />
             <StatCard
                title="Today's Discount"
                value={formatCurrency(todaysDiscount || 0)}
                icon={Tag}
                description="Total value of discounts given today."
                isLoading={isLoading}
            />
        </div>
        <div>
            <h4 className="font-semibold mb-2">Discounts by Staff</h4>
            {hasData ? (
                 <div className="space-y-3">
                    {discountsByStaff.map((staff: any) => {
                        const staffProfile = userMap.get(staff.soldByUid);
                        return (
                            <div key={staff.name} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={staffProfile?.photoURL} alt={staff.name} />
                                        <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{staff.name}</p>
                                        <p className="text-xs text-muted-foreground">{staff.count} sale(s)</p>
                                    </div>
                                </div>
                                <p className="font-bold text-destructive">{formatCurrency(staff.totalDiscount)}</p>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No discounts were applied in this period.</p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
