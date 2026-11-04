import { NextRequest, NextResponse } from 'next/server';
import { lanStore } from '@/lib/lan-sync/lan-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter'); // 'all', 'pending', 'synced', 'failed'
    const limit = parseInt(url.searchParams.get('limit') || '500', 10);
    const collection = url.searchParams.get('collection');

    let allMutations = lanStore.getAllMutations();

    if (collection) {
      allMutations = allMutations.filter((m) => m.collectionName === collection);
    }

    if (filter === 'pending') {
      allMutations = allMutations.filter((m) => !m.syncedToCloud);
    } else if (filter === 'synced') {
      allMutations = allMutations.filter((m) => m.syncedToCloud);
    } else if (filter === 'failed') {
      allMutations = allMutations.filter((m) => !!m.error && !m.syncedToCloud);
    }

    const total = lanStore.getAllMutations().length;
    const pending = lanStore.getPendingMutations().length;
    const synced = total - pending;
    const failed = lanStore.getAllMutations().filter((m) => !!m.error && !m.syncedToCloud).length;

    const summary = {
      totalMutationsCount: total,
      pendingMutationsCount: pending,
      syncedMutationsCount: synced,
      failedMutationsCount: failed,
      lastCloudSync: lanStore.getStateSummary().lastCloudSync,
    };

    return NextResponse.json({
      success: true,
      summary,
      mutations: allMutations.slice(0, limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error retrieving mutations';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ids, id, error } = body;

    if (action === 'mark-synced' && Array.isArray(ids)) {
      for (const mutId of ids) {
        lanStore.markMutationSynced(mutId);
      }
      return NextResponse.json({
        success: true,
        message: `Marked ${ids.length} mutation(s) as synced`,
        summary: lanStore.getStateSummary(),
      });
    }

    if (action === 'mark-failed' && id) {
      lanStore.markMutationFailed(id, error || 'Sync failed');
      return NextResponse.json({
        success: true,
        message: `Marked mutation ${id} as failed`,
        summary: lanStore.getStateSummary(),
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error processing mutation update';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
