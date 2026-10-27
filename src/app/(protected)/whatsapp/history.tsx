'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { WhatsAppReminder } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function WhatsAppHistory() {
  const firestore = useFirestore();

  const historyQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'whatsapp-logs'), orderBy('sentAt', 'desc'), limit(15));
  }, [firestore]);

  const { data: history, isLoading } = useCollection<any>(historyQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message History</CardTitle>
        <CardDescription>A log of the most recently sent WhatsApp messages.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {isLoading ? (
            <LoadingSkeleton />
          ) : history && history.length > 0 ? (
            <div className="space-y-4 pr-6">
              {history.map(item => (
                <div key={item.id} className="flex items-start gap-4">
                    <div className={cn("mt-1.5", item.status === 'success' ? 'text-green-500' : 'text-destructive')}>
                        {item.status === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{item.recipientPhone}</p>
                      <p className="text-xs text-muted-foreground">
                        {getSafeDate(item.sentAt) ? formatDistanceToNow(getSafeDate(item.sentAt)!, { addSuffix: true }) : ''}
                      </p>
                    </div>
                    <div className="text-sm p-3 bg-muted/50 rounded-md mt-1 whitespace-pre-wrap">{item.message}</div>
                     <div className="text-xs text-muted-foreground mt-1">
                        <Badge variant={item.status === 'success' ? 'success' : 'destructive'} className="mr-2">{item.status}</Badge>
                        Sent via {item.senderName}
                     </div>
                     {item.status === 'error' && (
                        <p className="text-xs text-destructive mt-1">Error: {item.error}</p>
                     )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">No message history found.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
