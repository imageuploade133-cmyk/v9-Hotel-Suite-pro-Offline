'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';

export default function DoNotDisturbLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-6 w-32" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <div className="flex w-full items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-2">
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
      ))}
    </div>
  );
}
