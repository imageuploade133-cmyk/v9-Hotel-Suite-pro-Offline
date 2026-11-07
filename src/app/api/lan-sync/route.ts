import { NextRequest, NextResponse } from 'next/server';
import { isLocalMasterServerRuntime } from '@/lib/lan-sync/is-local-master-server';

// This route reads/writes the local filesystem-backed LAN database.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function isLocalMasterRequest(req: NextRequest): boolean {
  // All requests reaching the Master Server on port 3000 are valid LAN requests
  return true;
}

export async function GET(req: NextRequest) {
  if (!isLocalMasterServerRuntime()) {
    return NextResponse.json({ success: false, code: 'LAN_MASTER_ONLY', message: 'LAN synchronization is available only on the Local Master Server.' }, { status: 503 });
  }
  try {
    const { lanStore } = await import('@/lib/lan-sync/lan-store');
    const { searchParams } = new URL(req.url);
    const collectionName = searchParams.get('collection');

    if (collectionName) {
      const data = lanStore.getCollection(collectionName);
      return NextResponse.json({ success: true, collectionName, data });
    }

    const summary = lanStore.getStateSummary();
    return NextResponse.json({
      success: true,
      mode: 'LAN_MASTER_SERVER',
      summary,
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to query LAN store';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalMasterServerRuntime()) {
    return NextResponse.json({ success: false, code: 'LAN_MASTER_ONLY', message: 'LAN synchronization is available only on the Local Master Server.' }, { status: 503 });
  }
  try {
    const { lanStore } = await import('@/lib/lan-sync/lan-store');
    const body = await req.json();

    // Accept a validated group of ledger mutations in one request. This keeps
    // the sale and its related payments together when writing to the Local Master.
    if (Array.isArray(body?.mutations)) {
      const mutations = body.mutations as Array<{
        collectionName?: string;
        docId?: string;
        action?: 'set' | 'update' | 'delete';
        data?: Record<string, unknown>;
      }>;
      const valid = mutations.length > 0 && mutations.every((mutation) =>
        typeof mutation.collectionName === 'string'
        && mutation.collectionName.length > 0
        && typeof mutation.docId === 'string'
        && mutation.docId.length > 0
        && ['set', 'update', 'delete'].includes(mutation.action || '')
        && (mutation.action === 'delete' || (mutation.data && typeof mutation.data === 'object' && !Array.isArray(mutation.data)))
      );
      if (!valid) {
        return NextResponse.json({ success: false, error: 'Invalid LAN mutation batch.' }, { status: 400 });
      }
      const saved = mutations.map((mutation) =>
        lanStore.addMutation(mutation.collectionName!, mutation.docId!, mutation.action!, mutation.data)
      );
      return NextResponse.json({
        success: true,
        message: 'Mutation batch saved locally to Master PC',
        mutationIds: saved.map((mutation) => mutation.id),
        summary: lanStore.getStateSummary(),
      });
    }

    const { collectionName, docId, action, data } = body;

    if (!collectionName || !docId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: collectionName, docId, action' },
        { status: 400 }
      );
    }

    const mutation = lanStore.addMutation(collectionName, docId, action, data);

    return NextResponse.json({
      success: true,
      message: 'Mutation saved locally to Master PC',
      mutationId: mutation.id,
      summary: lanStore.getStateSummary(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process LAN mutation';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
