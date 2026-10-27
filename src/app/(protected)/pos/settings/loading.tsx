import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Skeleton className="h-8 w-8" />
        </div>
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    </div>
  );
}
