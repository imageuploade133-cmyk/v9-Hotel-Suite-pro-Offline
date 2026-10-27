import { Skeleton } from '@/components/ui/skeleton';

export default function POSCategoriesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>

      <Skeleton className="h-10 w-full max-w-md" />

      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
