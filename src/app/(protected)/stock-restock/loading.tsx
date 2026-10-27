'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function RestockInventoryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="border rounded-lg">
        <div className="p-4">
          <Skeleton className="h-10 w-full mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-10 w-10 rounded" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
