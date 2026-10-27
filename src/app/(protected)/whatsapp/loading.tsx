'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { MessageSquareText } from 'lucide-react';

export default function WhatsAppLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <MessageSquareText className="h-10 w-10 text-primary" />
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
         <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
                <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent><Skeleton className="h-96 w-full" /></CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
