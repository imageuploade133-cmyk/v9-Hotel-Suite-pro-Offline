'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { WashingMachine } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';

export default function LaundryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <WashingMachine className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-40" />
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} title="" value="" icon={WashingMachine} description="" isLoading={true} />
        ))}
      </div>
       <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-2 p-4">
                    <Skeleton className="h-6 w-1/2 ml-auto" />
                    <Skeleton className="h-10 w-full mt-2" />
                </CardFooter>
            </Card>
          ))}
        </div>
    </div>
  );
}
