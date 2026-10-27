'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { PackagePlus, ArrowLeft } from 'lucide-react';

export default function BulkAddLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 p-4 flex justify-end items-center gap-8">
            <div className="text-right">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24 mt-1" />
            </div>
            <div className="text-right">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24 mt-1" />
            </div>
        </CardFooter>
      </Card>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48" />
      </div>
    </div>
  );
}
