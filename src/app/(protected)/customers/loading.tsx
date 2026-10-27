'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function CustomersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Users className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between">
                <Skeleton className="h-10 w-1/4" />
                <Skeleton className="h-10 w-1/4" />
            </div>
            <Skeleton className="h-12 w-full" />
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
