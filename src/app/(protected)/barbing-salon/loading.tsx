'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';

export default function BarbingSalonLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2 p-4">
            <Skeleton className="h-6 w-1/2 ml-auto" />
            <Skeleton className="h-10 w-full mt-2" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
