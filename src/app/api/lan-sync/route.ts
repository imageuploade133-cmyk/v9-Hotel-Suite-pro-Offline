import { NextRequest, NextResponse } from 'next/server';


function isLocalMasterRequest(req: NextRequest): boolean {
  const hostname = req.nextUrl.hostname.toLowerCase().replace(/^\\[|\\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    !hostname.includes('.')
  ) return true;

  const ipv4 = hostname.match(/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/);
  if (!ipv4) return false;
  const first = Number(ipv4[1]);
  const second = Number(ipv4[2]);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export async function GET(req: NextRequest) {
  if (!isLocalMasterRequest(req)) {
    return NextResponse.json({ success: false, error: 'LAN sync is available only on the local Master PC.' }, { status: 404 });
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
  if (!isLocalMasterRequest(req)) {
    return NextResponse.json({ success: false, error: 'LAN sync is available only on the local Master PC.' }, { status: 404 });
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
