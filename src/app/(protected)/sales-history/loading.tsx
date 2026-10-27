'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function SalesHistoryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <TrendingUp className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-5" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-7 w-24 mb-2" />
                <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-center">
         <Skeleton className="h-9 w-40" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <Skeleton className="h-10 w-1/3" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
