'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function StaffAnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <TrendingUp className="h-10 w-10 text-primary" />
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
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
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
             <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-28" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-28" />
                  </div>
               </div>
            </CardContent>
             <CardFooter>
                 <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
