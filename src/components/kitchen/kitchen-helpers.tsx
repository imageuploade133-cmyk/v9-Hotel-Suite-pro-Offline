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
            <CardHeader>
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-5 w-32" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-40 w-full" />
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2 p-4">
                <Skeleton className="h-6 w-1/2 ml-auto" />
                <Skeleton className="h-10 w-full mt-2" />
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
      <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
