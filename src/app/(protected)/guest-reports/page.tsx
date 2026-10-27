
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
  getDocs,
  QueryConstraint,
  onSnapshot,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import { MessageSquareWarning, Bed, Clock, User, Check, CheckCheck, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Link as LinkIcon, Volume2, VolumeX, Image as ImageIcon, ZoomIn, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { useSettings } from '@/contexts/settings-context';
import { GuestImageModal } from '@/components/ui/guest-image-modal';

interface GuestReport {
  id: string;
  roomNumber: string;
  reportMessage: string;
  reportedAt: any;
  status: 'new' | 'viewed' | 'resolved';
  guestName?: string;
  phoneNumber?: string;
  bookingId?: string;
  resolvedAt?: any;
  resolvedBy?: string;
  images?: string[];
  imageCount?: number;
}

const PAGE_SIZE = 9;

function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
                 <Card key={i}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                             <Skeleton className="h-6 w-32" />
                             <Skeleton className="h-5 w-20" />
                        </div>
                         <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-16 w-full mt-4" />
                    </CardContent>
                     <CardFooter>
                         <Skeleton className="h-9 w-full" />
                     </CardFooter>
                </Card>
            ))}
        </div>
    )
}

function IndexingHelp({ projectId }: { projectId: string }) {
  const indexUrl = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=guestReports&fields=%7B%22fieldPath%22%3A%22status%22%2C%22order%22%3A%22ASCENDING%22%7D&fields=%7B%22fieldPath%22%3A%22reportedAt%22%2C%22order%22%3A%22DESCENDING%22%7D`;

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Data Fetching Error</AlertTitle>
      <AlertDescription>
        <p>The app is having trouble loading guest reports. This usually means a Firestore index is required but hasn't been created yet.</p>
        <p className="mt-2">Please create the following index in your Firestore database:</p>
        <ul className="list-disc pl-6 my-2 text-xs bg-muted p-2 rounded-md">
            <li><strong>Collection ID:</strong> <code className="font-mono">guestReports</code></li>
            <li><strong>Fields to index:</strong>
                <ul className="list-circle pl-5">
                    <li><code className="font-mono">status</code> (Ascending)</li>
                    <li><code className="font-mono">reportedAt</code> (Descending)</li>
                </ul>
            </li>
        </ul>
        <Button asChild className="mt-2">
            <Link href={indexUrl} target="_blank">
                <LinkIcon className="mr-2 h-4 w-4"/>
                Create Index in Firebase
            </Link>
        </Button>
        <p className="text-xs text-muted-foreground mt-2">After creating the index, it may take a few minutes to become active. Please refresh this page afterward.</p>
      </AlertDescription>
    </Alert>
  );
}


function GuestReportCard({ report, onUpdate }: { report: GuestReport, onUpdate: (id: string, status: 'viewed' | 'resolved') => void }) {
    const reportDate = getSafeDate(report.reportedAt);
    const isNew = report.status === 'new';
    const [selectedImageIndex, setSelectedImageIndex] = React.useState<number | null>(null);
    const [imageError, setImageError] = React.useState<Set<number>>(new Set());

    const images = report.images ?? [];
    const hasImages = images.length > 0;
    const imageCount = report.imageCount || images.length;

    const handleImageError = (index: number) => {
        setImageError(prev => new Set(prev).add(index));
    };

    const handleImageClick = (index: number) => {
        setSelectedImageIndex(index);
    };

    return (
        <>
            <Card className={isNew ? 'border-primary' : ''}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="flex items-center gap-2">
                            <Bed className="h-5 w-5" />
                            Room {report.roomNumber}
                        </CardTitle>
                        <Badge variant={isNew ? 'default' : (report.status === 'viewed' ? 'warning' : 'secondary')}>{report.status}</Badge>
                    </div>
                     <CardDescription className="flex items-center gap-2 text-xs pt-1">
                        <Clock className="h-3 w-3" />
                         {reportDate ? formatDistanceToNow(reportDate, { addSuffix: true }) : 'N/A'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <p className="text-sm bg-muted/50 p-3 rounded-md font-bold text-destructive">{report.reportMessage}</p>
                     {report.guestName && (
                         <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                            <User className="h-3 w-3" />
                            Reported by guest: {report.guestName}
                        </p>
                     )}

                     {/* Images Section */}
                     {hasImages && (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    <ImageIcon className="h-3 w-3" />
                                    <span>{imageCount} Image{imageCount > 1 ? 's' : ''} Attached</span>
                                </div>
                            </div>

                            {imageCount > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {images.slice(0, 6).map((imageUrl, index) => (
                                        <div
                                            key={index}
                                            className={`
                                                relative aspect-square rounded-lg overflow-hidden border-2 border-muted
                                                cursor-pointer hover:border-primary hover:scale-105 transition-all duration-200
                                                ${imageError.has(index) ? 'bg-muted/50' : 'bg-background'}
                                            `}
                                            onClick={() => !imageError.has(index) && handleImageClick(index)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    !imageError.has(index) && handleImageClick(index);
                                                }
                                            }}
                                            aria-label={`View image ${index + 1}`}
                                        >
                                            {imageError.has(index) ? (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                    <X className="h-6 w-6" />
                                                </div>
                                            ) : (
                                                <>
                                                    <img
                                                        src={imageUrl}
                                                        alt={`Report image ${index + 1}`}
                                                        className="h-full w-full object-cover"
                                                        onError={() => handleImageError(index)}
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                                        <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {imageCount > 6 && (
                                        <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-muted bg-muted/30 flex items-center justify-center">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                +{imageCount - 6}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                     )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    {report.status === 'new' && (
                        <Button size="sm" variant="outline" onClick={() => onUpdate(report.id, 'viewed')}>
                           <Check className="mr-2 h-4 w-4" /> Mark as Viewed
                        </Button>
                    )}
                     {report.status !== 'resolved' && (
                        <Button size="sm" onClick={() => onUpdate(report.id, 'resolved')}>
                           <CheckCheck className="mr-2 h-4 w-4" /> Mark as Resolved
                        </Button>
                     )}
                </CardFooter>
            </Card>

            {/* Image Modal */}
            <GuestImageModal
                isOpen={selectedImageIndex !== null}
                images={images}
                initialIndex={selectedImageIndex ?? 0}
                altText={`Guest Report Image - Room ${report.roomNumber} View`}
                onClose={() => setSelectedImageIndex(null)}
            />
        </>
    );
}

function ReportList({
    status,
    newReportCount,
    setNewReportCount
}: {
    status: 'new' | 'viewed' | 'resolved',
    newReportCount: number,
    setNewReportCount: (count: number) => void;
}) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [reports, setReports] = React.useState<GuestReport[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<Error | null>(null);
    const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [firstVisible, setFirstVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [page, setPage] = React.useState(1);

    const fetchAndSetReports = React.useCallback((direction: 'next' | 'prev' | 'initial') => {
        if (!firestore) return;

        setIsLoading(true);
        setFetchError(null);

        const constraints: QueryConstraint[] = [where('status', '==', status), orderBy('reportedAt', 'desc')];
        let q = query(collection(firestore, 'guestReports'), ...constraints);

        if (direction === 'next' && lastVisible) {
            q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
        } else if (direction === 'prev' && firstVisible) {
            q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
        } else {
            q = query(q, limit(PAGE_SIZE));
        }

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuestReport));
            setReports(data);

            if (!snapshot.empty) {
                setFirstVisible(snapshot.docs[0]);
                setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            }

            if (direction === 'next') setPage(p => p + 1);
            if (direction === 'prev') setPage(p => p > 1 ? p - 1 : 1);
            if (direction === 'initial') setPage(1);

            setIsLoading(false);
        }, (error: any) => {
            console.error("Error fetching reports:", error);
            setFetchError(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch reports. A database index might be required.' });
            setIsLoading(false);
        });

    }, [firestore, status, lastVisible, firstVisible, toast]);

    React.useEffect(() => {
        const unsubscribe = fetchAndSetReports('initial');
        return () => unsubscribe && unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    // Real-time listener for new reports count
    React.useEffect(() => {
        if (!firestore) return;
        const q = query(collection(firestore, 'guestReports'), where('status', '==', 'new'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNewReportCount(snapshot.size);
        }, (error) => {
            console.error("Error listening for new reports:", error);
        });
        return () => unsubscribe();
    }, [firestore, setNewReportCount]);

    const handleUpdateStatus = async (id: string, newStatus: 'viewed' | 'resolved') => {
        if (!firestore) return;
        const reportRef = doc(firestore, 'guestReports', id);
        try {
            await updateDoc(reportRef, { status: newStatus, resolvedAt: serverTimestamp() });
            toast({ title: 'Report Updated', description: `The report has been marked as ${newStatus}.`, variant: 'success' });
            // Real-time listener will automatically update the UI
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to update report status.', variant: 'destructive' });
        }
    };

    if (isLoading) return <LoadingSkeleton />;

    if (fetchError) {
        return <IndexingHelp projectId="studio-6961382181-1ebba" />;
    }

    if (reports.length === 0) {
        return (
            <EmptyState
                icon={MessageSquareWarning}
                title={`No ${status} reports`}
                description={`Reports with the status "${status}" will appear here.`}
                className="min-h-[40vh]"
            />
        );
    }

    // This is a simplified pagination logic for demonstration.
    // A full implementation would need to check if there are actually more pages.
    const canNext = reports.length === PAGE_SIZE;
    const canPrev = page > 1;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map(report => (
                    <GuestReportCard key={report.id} report={report} onUpdate={handleUpdateStatus} />
                ))}
            </div>
             <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => fetchAndSetReports('prev')} disabled={!canPrev || isLoading}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => fetchAndSetReports('next')} disabled={!canNext || isLoading}>
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function GuestReportsPage() {
  const { settings } = useSettings();
  const [newReportCount, setNewReportCount] = React.useState(0);
  const [isSoundMuted, setIsSoundMuted] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const enableSound = settings?.enableGuestReportSound ?? true;
  const soundUrl = settings?.guestReportNotificationSoundUrl || 'https://cdn.pixabay.com/download/audio/2022/10/13/audio_8238140449.mp3';

  React.useEffect(() => {
    if (typeof window !== 'undefined' && enableSound && soundUrl) {
      audioRef.current = new Audio(soundUrl);
      audioRef.current.loop = true;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [enableSound, soundUrl]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const shouldPlay = newReportCount > 0 && !isSoundMuted;

    if (shouldPlay && audio.paused) {
      audio.play().catch(e => {
        console.warn("Guest report sound autoplay failed. This is often due to browser restrictions. A user interaction (like clicking the unmute button) is required to enable sound.", e);
      });
    } else if (!shouldPlay && !audio.paused) {
      audio.pause();
    }
  }, [newReportCount, isSoundMuted]);

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <TopHeader name="Guest Reports" icon={<MessageSquareWarning />} />
        <Button variant="outline" onClick={() => setIsSoundMuted(prev => !prev)} disabled={!enableSound}>
            {isSoundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="ml-2">{isSoundMuted ? 'Unmute' : 'Mute'}</span>
        </Button>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList>
            <TabsTrigger value="new">
                New
                {newReportCount > 0 && <Badge variant="destructive" className="ml-2">{newReportCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="viewed">Viewed</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="new" className="mt-6">
            <ReportList status="new" newReportCount={newReportCount} setNewReportCount={setNewReportCount} />
        </TabsContent>
        <TabsContent value="viewed" className="mt-6">
             <ReportList status="viewed" newReportCount={newReportCount} setNewReportCount={setNewReportCount} />
        </TabsContent>
        <TabsContent value="resolved" className="mt-6">
             <ReportList status="resolved" newReportCount={newReportCount} setNewReportCount={setNewReportCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(GuestReportsPage, PagePermission.VIEW_GUEST_REPORTS);
