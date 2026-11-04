import { NextRequest } from 'next/server';
import { lanStore, StoreEvent } from '@/lib/lan-sync/lan-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let cleanupListener: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection acknowledgement
      const initMessage = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        summary: lanStore.getStateSummary(),
      })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));

      // Subscribe to all mutations and updates happening on the Master PC
      cleanupListener = lanStore.subscribe((event: StoreEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.error('[SSE EventStream] Error enqueueing event:', err);
        }
      });

      // Keep connection alive with periodic heartbeats
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {"time":${Date.now()}}\n\n`));
        } catch (err) {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15000);
    },
    cancel() {
      if (cleanupListener) {
        cleanupListener();
        cleanupListener = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
