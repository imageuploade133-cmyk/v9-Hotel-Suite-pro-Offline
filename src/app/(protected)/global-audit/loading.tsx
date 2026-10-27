'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { History } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function GlobalAuditLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <History className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
        </div>
      </div>
      <Card>
        <CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}