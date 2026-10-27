'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { TopHeader } from '@/components/top-header';

export default function PosLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <TopHeader name="Point of Sale" icon={<ShoppingCart />} />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="space-y-6">
        <div className="grid w-full grid-cols-3 gap-2 rounded-lg border bg-card p-1">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
             <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-full sm:w-[200px]" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
                        {Array.from({length: 10}).map((_, i) => <Skeleton key={i} className="aspect-square"/>)}
                    </div>
                </CardContent>
                 <CardFooter className="p-2 border-t justify-end flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </CardFooter>
             </Card>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
                <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
                <CardContent><Skeleton className="h-10 w-full" /></CardContent>
            </Card>
            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>Current Sale</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-3">
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="h-12 w-12" />
                    <p className="mt-4 text-sm">Loading cart...</p>
                </div>
              </CardContent>
               <CardFooter className="flex-col items-stretch gap-3 p-4 border-t">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-6 w-1/2 ml-auto" />
                    <div className="flex gap-2 mt-2">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 flex-1" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}