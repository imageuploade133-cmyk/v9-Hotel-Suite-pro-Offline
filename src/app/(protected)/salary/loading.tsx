'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Banknote } from 'lucide-react';

export default function SalaryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Banknote className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
      </div>
       <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
