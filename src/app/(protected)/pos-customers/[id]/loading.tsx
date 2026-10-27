
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function CustomerDetailsLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-8 w-48 mb-4" />
      <div className="flex items-center gap-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-80" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-10 w-40" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-10 w-40" /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
            <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="p-4">
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
