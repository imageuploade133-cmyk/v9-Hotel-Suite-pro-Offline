'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Link as LinkIcon } from 'lucide-react';

export default function GuestEngagementLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="text-primary">
            <LinkIcon className="h-10 w-10" />
        </div>
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-[84px] w-[84px] rounded-md" />
                    <Skeleton className="h-[84px] w-[84px] rounded-md" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-full col-span-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
