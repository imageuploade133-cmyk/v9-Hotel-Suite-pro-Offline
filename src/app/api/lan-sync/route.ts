import { NextRequest, NextResponse } from 'next/server';
import { lanStore } from '@/lib/lan-sync/lan-store';

export async function GET(req: NextRequest) {
  try {
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
  try {
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
