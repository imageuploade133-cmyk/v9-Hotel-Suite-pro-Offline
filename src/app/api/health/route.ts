import { NextResponse } from 'next/server';

// Lightweight, public reachability endpoint for the client connectivity banner.
// Do not attach Firebase, database, authentication, or LAN-store work here.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: Date.now() },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
