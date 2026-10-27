
'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function ReservationActionLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="p-6 border rounded-lg space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-32" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
