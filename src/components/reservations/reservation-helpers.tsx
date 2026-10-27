
'use client';

import * as React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';


const PAGE_SIZE = 8;

export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
  );
}

export function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" onClick={onNext} disabled={!canNext}>
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

