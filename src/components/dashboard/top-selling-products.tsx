
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function TopSellingProducts({ data }: any) {
  const { topSellingItems, userCurrency } = data;

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency || 'USD',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
        <CardDescription>Top 5 products by revenue in the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topSellingItems && topSellingItems.length > 0 ? (
            topSellingItems.map((item: any, index: number) => (
              <div key={`${item.name}-${index}`} className="flex justify-between items-center text-sm">
                <span className="font-medium">{index + 1}. {item.name}</span>
                <span className="font-bold text-primary">{formatCurrency(item.revenue)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No sales data for this period.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
