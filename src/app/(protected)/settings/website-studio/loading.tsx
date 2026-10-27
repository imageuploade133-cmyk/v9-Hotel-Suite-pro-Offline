
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Globe } from 'lucide-react';

export default function WebsiteStudioLoading() {
  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Globe className="h-10 w-10 text-primary" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-10 w-full" /></CardContent>
            </Card>
            <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-10 w-full" /></CardContent>
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
    </div>
  );
}
