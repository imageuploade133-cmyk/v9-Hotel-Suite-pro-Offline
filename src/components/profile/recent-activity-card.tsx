'use client';

import * as React from 'react';
import { useUser } from '@/contexts/user-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import type { StockAuditLog } from '@/lib/types';

function ActivityItem({ time, text }: { time: string; text: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium">{text}</p>
                <p className="text-xs text-muted-foreground">{time}</p>
            </div>
        </div>
    );
}

export function RecentActivityCard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const activitiesQuery = React.useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'globalAuditLog'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(5)
        );
    }, [firestore, user]);

    const { data: activities, isLoading } = useCollection<StockAuditLog>(activitiesQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>A log of your recent actions in the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        </div>
                    ))
                ) : activities && activities.length > 0 ? (
                    activities.map(activity => (
                        <ActivityItem
                            key={activity.id}
                            text={activity.details.message || `${activity.changeType} on ${activity.collectionName}`}
                            time={getSafeDate(activity.timestamp) ? formatDistanceToNow(getSafeDate(activity.timestamp)!, { addSuffix: true }) : 'a moment ago'}
                        />
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity found.</p>
                )}
            </CardContent>
        </Card>
    );
}
