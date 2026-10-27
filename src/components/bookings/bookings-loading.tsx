'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';

export default function BookingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="flex-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-20 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-center">
         <Skeleton className="h-9 w-40" />
      </div>

      <div className="w-full">
        <div className="grid h-auto w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-7">
           {[...Array(7)].map((_, i) => (
             <Skeleton key={i} className="h-10 w-full" />
           ))}
        </div>
      </div>
       <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <Skeleton className="h-40 w-full" />
              <CardHeader className="p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="flex-grow space-y-2 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
              <CardFooter className="bg-muted/50 p-4">
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
    </div>
  );
}
