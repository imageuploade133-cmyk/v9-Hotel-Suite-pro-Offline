import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, DocumentData } from 'firebase/firestore';


function isLocalMasterRequest(req: NextRequest): boolean {
  const hostname = req.nextUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local') || !hostname.includes('.')) return true;
  const ipv4 = hostname.match(/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/);
  if (!ipv4) return false;
  const first = Number(ipv4[1]);
  const second = Number(ipv4[2]);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export async function POST(req: NextRequest) {
  if (!isLocalMasterRequest(req)) return NextResponse.json({ success: false, error: 'Cloud sync worker is available only on the local Master PC.' }, { status: 404 });
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

export async function GET(req: NextRequest) {
  if (!isLocalMasterRequest(req)) return NextResponse.json({ success: false, error: 'Cloud sync worker is available only on the local Master PC.' }, { status: 404 });
  const { lanStore } = await import('@/lib/lan-sync/lan-store');
  return NextResponse.json({ success: true, summary: lanStore.getStateSummary() });
}
