
'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function WebsiteLoading() {
  return (
    <div className="bg-background-light dark:bg-background-dark animate-pulse">
      <header className="fixed top-0 left-0 right-0 z-50 h-24 bg-background-dark/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-[1440px] mx-auto px-8 h-full flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <div className="hidden lg:flex items-center gap-12">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-12 w-32" />
        </div>
      </header>
      <div className="h-screen w-full relative">
        <Skeleton className="h-full w-full" />
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-3xl space-y-8 p-8">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-3/4" />
            </div>
        </div>
      </div>
    </div>
  );
}
