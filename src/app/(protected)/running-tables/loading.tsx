import { Skeleton } from '@/components/ui/skeleton';

export default function RunningTablesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
