
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import {
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
  CreditCard,
} from 'lucide-react';

export function NetIncomeByMethod({ data }: any) {
  const { netIncomeByMethod, userCurrency } = data;

  const getPaymentMethodIcon = (method: string) => {
    const lowerMethod = method.toLowerCase();
    if (lowerMethod.includes('card')) return CreditCard;
    if (lowerMethod.includes('cash')) return Banknote;
    if (lowerMethod.includes('transfer') || lowerMethod.includes('bank')) return Landmark;
    if (lowerMethod.includes('mobile')) return Smartphone;
    return Wallet;
  };

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
    }).format(value);
  };

  const hasIncomeData = netIncomeByMethod && Object.keys(netIncomeByMethod).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Income by Payment Method</CardTitle>
        <CardDescription>Breakdown of net revenue for the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        {hasIncomeData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(netIncomeByMethod).map(([method, amount]: [string, any]) => (
                <StatCard
                    key={method}
                    title={`${method} Balance`}
                    value={formatCurrency(amount)}
                    icon={getPaymentMethodIcon(method)}
                    description={`Net balance for ${method}.`}
                    className={method === 'Credit' || amount < 0 ? 'border-destructive text-destructive' : ''}
                />
                ))}
            </div>
        ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No payment data available for this period.</p>
        )}
      </CardContent>
    </Card>
  );
}
