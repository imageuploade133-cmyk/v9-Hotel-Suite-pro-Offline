import { NextRequest, NextResponse } from 'next/server';
import { lanStore } from '@/lib/lan-sync/lan-store';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Cache user credentials from online login for future offline use
    if (body.action === 'cache_user') {
      const { user, password } = body;
      if (!user || !user.email) {
        return NextResponse.json({ success: false, error: 'Missing user data' }, { status: 400 });
      }

      let passwordHash: string | undefined;
      if (password) {
        passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      }

      lanStore.cacheUser({
        uid: user.uid,
        email: user.email,
        name: user.name || user.displayName || user.email.split('@')[0],
        ...(user.role ? { role: user.role } : {}),
        ...(Array.isArray(user.permissions) ? { permissions: user.permissions } : {}),
        ...(Array.isArray(user.assignedBranches) ? { assignedBranches: user.assignedBranches } : {}),
        ...(user.isFirebaseOnlyAdmin === true ? { isFirebaseOnlyAdmin: true, accountType: 'firebase-only-admin' } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      });

      return NextResponse.json({
        success: true,
        message: `User ${user.email} cached for offline login.`,
      });
    }

    // 2. Perform offline verification
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required for login.' },
        { status: 400 }
      );
    }

    const verification = lanStore.verifyOfflineCredentials(email, password);

    if (!verification.success || !verification.user) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    // Generate local offline session token
    const sessionToken = crypto.randomBytes(24).toString('hex');

    return NextResponse.json({
      success: true,
      message: 'Offline login successful',
      token: sessionToken,
      user: verification.user,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Offline login service error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  try {
    const usersMap = lanStore.getCollection('users');
    const safeUsers = Object.entries(usersMap).map(([uid, u]: [string, any]) => ({
      uid,
      email: u.email,
      name: u.name,
      role: u.role,
      permissions: u.permissions || [],
      assignedBranches: u.assignedBranches || [],
    }));

    return NextResponse.json({
      success: true,
      cachedUsersCount: safeUsers.length,
      users: safeUsers,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to query cached users';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
