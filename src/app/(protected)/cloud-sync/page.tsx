'use client';

import * as React from 'react';
import {
  Cloud,
  CloudUpload,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Database,
  ArrowUpDown,
  Copy,
  Check,
  Eye,
  Wifi,
  WifiOff,
  Filter,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface MutationRecord {
  id: string;
  collectionName: string;
  docId: string;
  action: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
  timestamp: number;
  syncedToCloud: boolean;
  syncedAt?: number;
  attempts: number;
  error?: string;
}

interface SyncSummary {
  totalMutationsCount: number;
  pendingMutationsCount: number;
  syncedMutationsCount: number;
  failedMutationsCount: number;
  lastCloudSync: number | null;
}

export default function CloudSyncPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState<boolean>(true);
  const [summary, setSummary] = React.useState<SyncSummary>({
    totalMutationsCount: 0,
    pendingMutationsCount: 0,
    syncedMutationsCount: 0,
    failedMutationsCount: 0,
    lastCloudSync: null,
  });
  const [mutations, setMutations] = React.useState<MutationRecord[]>([]);
  const [activeTab, setActiveTab] = React.useState<'all' | 'pending' | 'synced' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCollection, setSelectedCollection] = React.useState<string>('all');
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [masterOnlyNotice, setMasterOnlyNotice] = React.useState<boolean>(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Sync Progress State
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
  const [syncProgress, setSyncProgress] = React.useState<number>(0);
  const [syncStatusText, setSyncStatusText] = React.useState<string>('');
  const [syncSuccessDetails, setSyncSuccessDetails] = React.useState<{
    count: number;
    time: Date;
  } | null>(null);

  // Inspector Dialog State
  const [inspectRecord, setInspectRecord] = React.useState<MutationRecord | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Online / Offline monitor
  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadMutations = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/lan-sync/mutations?limit=1000', {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);

      // This endpoint reads the filesystem-backed queue on the Local Master
      // Server. A cloud/serverless deployment intentionally cannot provide it.
      if (data?.code === 'LAN_MASTER_ONLY') {
        setMasterOnlyNotice(true);
        setLoadError(null);
        return;
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Unable to retrieve local sync history.');
      }

      setMasterOnlyNotice(false);
      setLoadError(null);
      setSummary(data.summary);
      setMutations(data.mutations || []);
    } catch (err) {
      console.error('Failed to load mutations:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to retrieve sync history.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadMutations();
    // Stop polling when this app is served by a cloud/serverless deployment.
    // The user can still retry manually after opening the Local Master URL.
    const interval = setInterval(() => {
      if (!masterOnlyNotice) void loadMutations();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadMutations, masterOnlyNotice]);

  // Execute Synchronization with real-time 0-100% Progress Bar
  const handleExecuteSync = async () => {
    if (masterOnlyNotice) return;
    if (!isOnline) {
      toast({
        variant: 'destructive',
        title: 'Internet Disconnected',
        description: 'Please connect the Master Server PC or your device to the internet before syncing to Cloud Database.',
      });
      return;
    }

    const pendingItems = mutations.filter((m) => !m.syncedToCloud);
    if (pendingItems.length === 0) {
      toast({
        variant: 'default',
        title: 'Already Synchronized',
        description: 'All local data is already 100% synced to Cloud Database.',
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncSuccessDetails(null);
    setSyncStatusText(`Preparing to synchronize ${pendingItems.length} records...`);

    const totalToSync = pendingItems.length;
    let totalSynced = 0;
    let totalFailed = 0;

    // Process in batches of 4 items to provide granular, smooth 0-100% progress updates
    const batchSize = 4;
    for (let i = 0; i < pendingItems.length; i += batchSize) {
      const chunk = pendingItems.slice(i, i + batchSize);
      const chunkIds = chunk.map((c) => c.id);

      setSyncStatusText(
        `Uploading [${chunk[0].collectionName}] items (${Math.min(i + chunk.length, totalToSync)} of ${totalToSync})...`
      );

      try {
        const res = await fetch('/api/lan-sync/cloud-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mutationIds: chunkIds }),
        });

        if (res.ok) {
          const resData = await res.json();
          totalSynced += resData.syncedCount || chunk.length;
          totalFailed += resData.failedCount || 0;
        } else {
          totalFailed += chunk.length;
        }
      } catch (chunkError) {
        console.error('Batch sync error:', chunkError);
        totalFailed += chunk.length;
      }

      // Smooth progress calculation from 0% to 100%
      const currentProgress = Math.min(
        100,
        Math.round(((i + chunk.length) / totalToSync) * 100)
      );
      setSyncProgress(currentProgress);

      // Brief delay for fluid visual feedback
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    setSyncProgress(100);
    setSyncStatusText(`Completed! ${totalSynced} items synchronized.`);
    setSyncSuccessDetails({
      count: totalSynced,
      time: new Date(),
    });

    toast({
      variant: 'default',
      title: 'Cloud Sync Successful',
      description: `Successfully synchronized ${totalSynced} records to Cloud Database.`,
    });

    // Refresh mutations table to reflect immediate synced state
    await loadMutations();
    setIsSyncing(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered mutations
  const filteredMutations = React.useMemo(() => {
    return mutations.filter((m) => {
      // Tab filter
      if (activeTab === 'pending' && m.syncedToCloud) return false;
      if (activeTab === 'synced' && !m.syncedToCloud) return false;
      if (activeTab === 'failed' && (!m.error || m.syncedToCloud)) return false;

      // Collection filter
      if (selectedCollection !== 'all' && m.collectionName !== selectedCollection) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const docMatch = m.docId.toLowerCase().includes(q);
        const colMatch = m.collectionName.toLowerCase().includes(q);
        const dataMatch = JSON.stringify(m.data || {}).toLowerCase().includes(q);
        return docMatch || colMatch || dataMatch;
      }

      return true;
    });
  }, [mutations, activeTab, selectedCollection, searchQuery]);

  // Unique collections for filter
  const collections = React.useMemo(() => {
    const set = new Set<string>();
    mutations.forEach((m) => set.add(m.collectionName));
    return Array.from(set).sort();
  }, [mutations]);

  const formatSummaryData = (record: MutationRecord) => {
    const data = record.data || {};
    if (record.collectionName === 'bookings') {
      return `Guest: ${data.guestName || 'N/A'} • Room: ${data.roomNumber || 'N/A'} • ${data.status || ''}`;
    }
    if (record.collectionName === 'stock') {
      return `Item: ${data.name || record.docId} • Qty: ${data.quantity ?? data.stockCount ?? 'N/A'}`;
    }
    if (record.collectionName === 'orders') {
      return `Order #${data.orderNumber || record.docId} • Room: ${data.roomNumber || 'N/A'} • ${data.status || 'Pending'}`;
    }
    if (record.collectionName === 'payments') {
      return `Amount: $${data.amount || '0'} • Method: ${data.paymentMethod || 'Cash'} • Guest: ${data.guestName || 'N/A'}`;
    }
    if (record.collectionName === 'rooms') {
      return `Room Type: ${data.name || record.docId}`;
    }
    if (record.collectionName === 'heldSales') {
      return `Held Sale: ${data.name || record.docId}`;
    }
    return `ID: ${record.docId}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Cloud Sync Center
            </h1>
            <Badge
              variant={isOnline ? 'default' : 'secondary'}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span>Internet Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-amber-500" />
                  <span>Local Offline Mode</span>
                </>
              )}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time synchronization between the Master PC local database and Secure Cloud Database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMutations}
            disabled={loading || isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleExecuteSync}
            disabled={masterOnlyNotice || isSyncing || summary.pendingMutationsCount === 0 || !isOnline}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CloudUpload className={`h-4 w-4 ${isSyncing ? 'animate-bounce' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
          </Button>
        </div>
      </div>

      {masterOnlyNotice && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4 sm:p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-foreground">Local Master Server Required</p>
              <p className="text-sm text-muted-foreground">
                Cloud Sync Center reads the offline mutation history stored on the Local Master
                Server. This page is currently connected to a cloud/serverless server, which
                cannot access that local queue.
              </p>
              <p className="text-sm text-muted-foreground">
                Open Cloud Sync Center using the Local Master PC address (for example,
                its localhost address on the Master PC or its LAN IP from a connected device).
                Your local records and pending sync queue have not been deleted or changed.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void loadMutations()}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Retry connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loadError && !masterOnlyNotice && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Unable to load sync history</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void loadMutations()}
                disabled={loading}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Execution & Progress Card */}
      <Card className="border-primary/20 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                Cloud Synchronization Engine
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Push all pending offline transactions, bookings, and inventory updates to Cloud Database.
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              {summary.lastCloudSync ? (
                <span>
                  Last cloud sync:{' '}
                  <strong className="text-foreground">
                    {format(new Date(summary.lastCloudSync), 'PPpp')}
                  </strong>
                </span>
              ) : (
                <span>No cloud sync recorded yet</span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Bar Container */}
          <div className="space-y-2 bg-muted/40 p-4 rounded-lg border">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold flex items-center gap-2">
                {isSyncing && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
                {isSyncing
                  ? 'Synchronizing in progress...'
                  : summary.pendingMutationsCount === 0
                  ? 'Cloud and Local Database are 100% In Sync'
                  : `${summary.pendingMutationsCount} record(s) pending sync to Cloud`}
              </span>
              <span className="font-mono font-bold text-sm">
                {isSyncing ? `${syncProgress}%` : summary.pendingMutationsCount === 0 ? '100%' : 'Ready'}
              </span>
            </div>

            <Progress
              value={isSyncing ? syncProgress : summary.pendingMutationsCount === 0 ? 100 : 0}
              className="h-3.5 bg-muted"
              indicatorClassName={
                summary.pendingMutationsCount === 0 && !isSyncing
                  ? 'bg-emerald-500'
                  : 'bg-primary'
              }
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{syncStatusText || 'Zero data loss architecture with conflict resolution.'}</span>
              <span>
                {summary.syncedMutationsCount} synced / {summary.totalMutationsCount} total records
              </span>
            </div>
          </div>

          {/* Success Banner when sync finishes */}
          {syncSuccessDetails && (
            <div className="flex items-center gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="flex-1 text-xs sm:text-sm">
                <span className="font-semibold">Successfully Synchronized!</span>{' '}
                Pushed {syncSuccessDetails.count} records to Cloud Database at{' '}
                {format(syncSuccessDetails.time, 'PPpp')}.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Records
              </p>
              <h3 className="text-2xl font-bold mt-1">{summary.totalMutationsCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">All offline mutations</p>
            </div>
            <Database className="h-8 w-8 text-muted-foreground/30" />
          </CardContent>
        </Card>

        <Card className="bg-card border-emerald-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Synced to Cloud
              </p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {summary.syncedMutationsCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Safe in Cloud</p>
            </div>
            <CheckCheck className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>

        <Card className={`bg-card ${summary.pendingMutationsCount > 0 ? 'border-red-500/30 dark:border-red-500/40 bg-red-500/5' : 'border-emerald-500/20'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${summary.pendingMutationsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                Pending (Not Synced)
              </p>
              <h3 className={`text-2xl font-bold mt-1 ${summary.pendingMutationsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {summary.pendingMutationsCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Stored on Master PC</p>
            </div>
            <Clock className={`h-8 w-8 ${summary.pendingMutationsCount > 0 ? 'text-red-500/40' : 'text-emerald-500/30'}`} />
          </CardContent>
        </Card>

        <Card className="bg-card border-destructive/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-destructive uppercase tracking-wider">
                Failed / Retry
              </p>
              <h3 className="text-2xl font-bold mt-1 text-destructive">
                {summary.failedMutationsCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Needs cloud sync</p>
            </div>
            <AlertCircle className="h-8 w-8 text-destructive/30" />
          </CardContent>
        </Card>
      </div>

      {/* Main Table & Filters */}
      <Card className="bg-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Synchronization Ledger</CardTitle>
              <CardDescription className="text-xs">
                Comprehensive audit list of every record, full date/time created offline, and cloud sync timestamp.
              </CardDescription>
            </div>

            {/* Tabs for quick filtering */}
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as any)}
              className="w-full md:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="all" className="text-xs">
                  All ({summary.totalMutationsCount})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs">
                  Pending ({summary.pendingMutationsCount})
                </TabsTrigger>
                <TabsTrigger value="synced" className="text-xs">
                  Synced ({summary.syncedMutationsCount})
                </TabsTrigger>
                <TabsTrigger value="failed" className="text-xs">
                  Failed ({summary.failedMutationsCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search & Collection Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Document ID, Guest, Product, or Room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="h-9 px-3 py-1 bg-background border rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-44"
              >
                <option value="all">All Collections ({collections.length})</option>
                {collections.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px]">Sync Status</TableHead>
                  <TableHead className="w-[180px]">Collection & Action</TableHead>
                  <TableHead className="min-w-[220px]">Record Summary</TableHead>
                  <TableHead className="w-[200px]">Created Offline Date & Time</TableHead>
                  <TableHead className="w-[200px]">Cloud Synced Date & Time</TableHead>
                  <TableHead className="w-[80px] text-right">Details</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading && mutations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading sync records from Master PC...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMutations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No synchronization records found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMutations.map((record) => {
                    const isSynced = record.syncedToCloud;
                    const isFailed = !!record.error && !isSynced;

                    return (
                      <TableRow key={record.id} className="text-xs">
                        {/* Status */}
                        <TableCell>
                          {isSynced ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold flex items-center gap-1.5 w-fit"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Synced</span>
                            </Badge>
                          ) : isFailed ? (
                            <Badge
                              variant="destructive"
                              className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 font-semibold flex items-center gap-1.5 w-fit"
                            >
                              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                              <span>Sync Failed</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 font-semibold flex items-center gap-1.5 w-fit"
                            >
                              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                              <span>Not Synced</span>
                            </Badge>
                          )}
                        </TableCell>

                        {/* Collection & Action */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                              {record.collectionName}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 uppercase font-mono"
                              >
                                {record.action}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[100px]">
                                {record.docId}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Record Summary */}
                        <TableCell>
                          <span className="text-foreground font-medium">
                            {formatSummaryData(record)}
                          </span>
                          {record.error && (
                            <p className="text-[11px] text-destructive mt-0.5">
                              Error: {record.error}
                            </p>
                          )}
                        </TableCell>

                        {/* Created Offline Date & Time */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {format(new Date(record.timestamp), 'PPpp')}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(record.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                        </TableCell>

                        {/* Cloud Synced Date & Time */}
                        <TableCell>
                          {record.syncedAt ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {format(new Date(record.syncedAt), 'PPpp')}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Successfully verified
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">
                              Pending cloud connection...
                            </span>
                          )}
                        </TableCell>

                        {/* Inspect Action */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setInspectRecord(record)}
                            className="h-8 w-8"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Inspect Record</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payload Inspector Dialog */}
      <Dialog open={!!inspectRecord} onOpenChange={(open) => !open && setInspectRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Database className="h-5 w-5 text-primary" />
              <span>
                Sync Record Details: [{inspectRecord?.collectionName}] / {inspectRecord?.docId}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mutation ID: {inspectRecord?.id}
            </DialogDescription>
          </DialogHeader>

          {inspectRecord && (
            <div className="space-y-4 text-xs pt-2">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
                <div>
                  <span className="text-muted-foreground">Collection:</span>
                  <p className="font-semibold">{inspectRecord.collectionName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Action:</span>
                  <p className="font-semibold uppercase">{inspectRecord.action}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created Offline Date & Time:</span>
                  <p className="font-semibold">
                    {format(new Date(inspectRecord.timestamp), 'PPpp')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cloud Sync Status:</span>
                  <p
                    className={`font-semibold ${
                      inspectRecord.syncedToCloud
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {inspectRecord.syncedToCloud
                      ? `Synced at ${
                          inspectRecord.syncedAt
                            ? format(new Date(inspectRecord.syncedAt), 'PPpp')
                            : 'Unknown'
                        }`
                      : 'Pending Upload'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                    Document Payload Data
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(inspectRecord.data || {}, null, 2),
                        inspectRecord.id
                      )
                    }
                  >
                    {copiedId === inspectRecord.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedId === inspectRecord.id ? 'Copied' : 'Copy JSON'}
                  </Button>
                </div>
                <pre className="p-3 bg-muted rounded-lg font-mono text-[11px] overflow-x-auto max-h-64 border">
                  {JSON.stringify(inspectRecord.data || {}, null, 2)}
                </pre>
              </div>

              {inspectRecord.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                  <span className="font-semibold">Sync Failure Reason:</span>
                  <p className="mt-1">{inspectRecord.error}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
