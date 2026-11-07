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
