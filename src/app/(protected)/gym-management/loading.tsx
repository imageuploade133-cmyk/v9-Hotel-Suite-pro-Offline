'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Dumbbell } from 'lucide-react';

export default function GymLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Dumbbell className="h-10 w-10 text-primary" />
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="mt-2 h-4 w-80" />
            </div>
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
           <Skeleton key={i} className="h-80 w-full" />
        ))}
      </div>
    </div>
  );
}
