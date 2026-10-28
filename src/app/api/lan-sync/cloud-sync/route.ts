import { NextRequest, NextResponse } from 'next/server';
import { lanStore } from '@/lib/lan-sync/lan-store';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, DocumentData } from 'firebase/firestore';

export async function POST(_req: NextRequest) {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        success: false,
        message: 'Firestore is not initialized on the Master Server or network is offline',
        summary: lanStore.getStateSummary(),
      });
    }

    const pendingMutations = lanStore.getPendingMutations();
    if (pendingMutations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All local LAN mutations are fully synchronized with Cloud Firestore',
        syncedCount: 0,
        summary: lanStore.getStateSummary(),
      });
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const mutation of pendingMutations) {
      try {
        const docRef = doc(db, mutation.collectionName, mutation.docId);

        if (mutation.action === 'set') {
          const payload = (mutation.data || {}) as DocumentData;
          await setDoc(docRef, payload, { merge: true });
        } else if (mutation.action === 'update') {
          const payload = (mutation.data || {}) as DocumentData;
          await updateDoc(docRef, payload);
        } else if (mutation.action === 'delete') {
          await deleteDoc(docRef);
        }

        lanStore.markMutationSynced(mutation.id);
        syncedCount++;
      } catch (err: unknown) {
        failedCount++;
        const errorMessage = err instanceof Error ? err.message : 'Cloud Firestore push failed';
        lanStore.markMutationFailed(mutation.id, errorMessage);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cloud sync executed: ${syncedCount} synced, ${failedCount} pending/failed`,
      syncedCount,
      failedCount,
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

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    success: true,
    summary: lanStore.getStateSummary(),
  });
}
