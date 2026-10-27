'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function PosAccountingLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default PosAccountingLoading;
