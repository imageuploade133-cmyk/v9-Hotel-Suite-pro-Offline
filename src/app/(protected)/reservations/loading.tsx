'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';

export default function ReservationsLoading() {
  return (
     <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
                <CalendarClock className="h-10 w-10 text-primary" />
                <div>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="mt-2 h-4 w-80" />
                </div>
            </div>
             <Skeleton className="h-10 w-72" />
        </div>
         <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader className="items-center text-center p-6 space-y-3">
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                    <CardFooter className="p-2">
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
     </div>
  );
}
