'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { BookUser } from 'lucide-react';

export default function PrintRoomBillLoading() {
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
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
            <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent className="p-6">
             <div className="space-y-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
            </div>
        </CardContent>
         <CardFooter className="flex items-center justify-end px-4 py-4 border-t">
              <Skeleton className="h-9 w-40" />
         </CardFooter>
      </Card>
    </div>
  );
}
