
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { BookUser } from 'lucide-react';

export default function GuestFolioLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <BookUser className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5" />
          </CardHeader>
          <CardContent>
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5" />
          </CardHeader>
          <CardContent>
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-5" />
          </CardHeader>
          <CardContent>
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="border-b">
            <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent className="p-0">
             <div className="p-6">
                <Skeleton className="h-96 w-full" />
            </div>
        </CardContent>
         <CardFooter className="flex-col items-stretch gap-4 p-4 border-t">
            <Skeleton className="h-24 w-full" />
            <div className="flex items-center justify-end">
              <Skeleton className="h-9 w-40" />
            </div>
         </CardFooter>
      </Card>
    </div>
  );
}
