'use client';

import React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Wallet, CalendarDays } from 'lucide-react';
import { useUser } from '@/contexts/user-context';

export function MySales({ data }: any) {
  const { userProfile } = useUser();
  const { myTotalIncome, myTodaysIncome, userCurrency } = data;

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
    }).format(value);
  };

  if (!userProfile) return null;

  return (
    <div className="mt-4 border-t pt-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">My Sales ({userProfile.name})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Total Income"
          value={formatCurrency(myTotalIncome)}
          icon={Wallet}
          description="Your all-time total sales."
        />
        <StatCard
          title="My Income Today"
          value={formatCurrency(myTodaysIncome)}
          icon={CalendarDays}
          description="Your total sales for today."
        />
      </div>
    </div>
  );
}
