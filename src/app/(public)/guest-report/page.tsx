import { Suspense } from 'react';
import GuestReportClientPage from './guest-report-client-page';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

const GuestReportPage = () => {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <GuestReportClientPage />
    </Suspense>
  );
};

const LoadingSkeleton = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4">
        <Card className="w-full max-w-xl shadow-2xl overflow-hidden border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4 pb-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b">
                <div className="flex justify-center">
                    <Skeleton className="h-24 w-24 rounded-2xl" />
                </div>
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-5 w-1/2 mx-auto" />
            </CardHeader>
            <CardContent className="p-6 md:p-8 space-y-6">
                <Skeleton className="h-4 w-full max-w-sm mx-auto" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                </div>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-8 w-full" />
            </CardContent>
            <div className="p-6 pt-0">
                <Skeleton className="h-12 w-full" />
            </div>
        </Card>
    </div>
);

export default GuestReportPage;
