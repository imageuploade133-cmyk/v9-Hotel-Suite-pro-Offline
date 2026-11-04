import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, DocumentData } from 'firebase/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { lanStore } = await import('@/lib/lan-sync/lan-store');
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        success: false,
        message: 'Firestore is not initialized on the Master Server or network is offline',
        summary: lanStore.getStateSummary(),
      });
    }

    const body = await req.json().catch(() => ({}));
    const allPending = lanStore.getPendingMutations();
    if (allPending.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All local LAN mutations are fully synchronized with Cloud Firestore',
        syncedCount: 0,
        failedCount: 0,
        totalPendingBefore: 0,
        remainingPending: 0,
        summary: lanStore.getStateSummary(),
      });
    }

    let mutationsToSync = allPending;
    if (Array.isArray(body?.mutationIds) && body.mutationIds.length > 0) {
      const idSet = new Set(body.mutationIds);
      mutationsToSync = allPending.filter((m) => idSet.has(m.id));
    } else if (typeof body?.batchSize === 'number' && body.batchSize > 0) {
      mutationsToSync = allPending.slice(0, body.batchSize);
    }

    let syncedCount = 0;
    let failedCount = 0;
    const syncedIds: string[] = [];
    const failedIds: string[] = [];

    for (const mutation of mutationsToSync) {
      try {
        const docRef = doc(db, mutation.collectionName, mutation.docId);

        if (mutation.action === 'delete') {
          await deleteDoc(docRef);
        } else {
          const payload = (mutation.data || {}) as DocumentData;

          // Conflict resolution: check cloud doc timestamp if available
          try {
            const cloudSnap = await getDoc(docRef);
            if (cloudSnap.exists()) {
              const cloudData = cloudSnap.data();
              const cloudTimestamp = cloudData?.updatedAt || cloudData?.timestamp || 0;
              const localTimestamp = mutation.timestamp || 0;

              // If cloud is strictly newer, skip overwriting and accept cloud as winner
              if (typeof cloudTimestamp === 'number' && cloudTimestamp > localTimestamp) {
                lanStore.markMutationSynced(mutation.id);
                syncedCount++;
                continue;
              }
            }
          } catch {
            // If getDoc fails, proceed with standard setDoc
          }

          if (mutation.action === 'set') {
            await setDoc(docRef, payload, { merge: true });
          } else if (mutation.action === 'update') {
            await updateDoc(docRef, payload);
          }
        }

        lanStore.markMutationSynced(mutation.id);
        syncedCount++;
        syncedIds.push(mutation.id);
      } catch (err: unknown) {
        failedCount++;
        failedIds.push(mutation.id);
        const errorMessage = err instanceof Error ? err.message : 'Cloud Firestore push failed';
        lanStore.markMutationFailed(mutation.id, errorMessage);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cloud sync executed: ${syncedCount} synced, ${failedCount} pending/failed`,
      syncedCount,
      failedCount,
      totalPendingBefore: allPending.length,
      remainingPending: lanStore.getPendingMutations().length,
      syncedIds,
      failedIds,
      summary: lanStore.getStateSummary(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error processing Cloud Sync';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { lanStore } = await import('@/lib/lan-sync/lan-store');
  return NextResponse.json({ success: true, summary: lanStore.getStateSummary() });
}
