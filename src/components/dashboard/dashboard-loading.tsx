'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardLoading() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-10 w-48" />
                </div>
                <Skeleton className="h-10 w-[300px]" />
            </div>
            <Skeleton className="h-5 w-1/2" />
            </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
            <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-5" />
                </CardHeader>
                <CardContent>
                <Skeleton className="h-7 w-20 mb-2" />
                <Skeleton className="h-4 w-full" />
                </CardContent>
            </Card>
            ))}
        </div>

        <div className="flex items-center justify-center">
            <Skeleton className="h-9 w-40" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[250px] w-full" />
            </CardContent>
            </Card>
            <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[250px] w-full" />
            </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <div className="px-6">
                <Skeleton className="h-10 w-full" />
            </div>
            <CardContent className="mt-4 flex flex-col gap-4">
                {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="grid gap-1.5 flex-1">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-48" />
                    </div>
                    </div>
                </div>
                ))}
            </CardContent>
            </Card>
        </div>
    )
}
