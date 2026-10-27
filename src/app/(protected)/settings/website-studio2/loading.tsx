
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { AppWindow } from 'lucide-react';

export default function WebsiteStudio2Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <AppWindow className="h-10 w-10 text-primary" />
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
           <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
       <Skeleton className="h-10 w-40" />
    </div>
  );
}
