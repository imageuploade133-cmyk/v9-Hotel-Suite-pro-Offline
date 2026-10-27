'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ConciergeBell } from 'lucide-react';

export default function ServicesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ConciergeBell className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-10 w-24" />
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
