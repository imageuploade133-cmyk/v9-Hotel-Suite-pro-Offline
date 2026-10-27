import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { branchId } = await request.json();

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Note: Services initialization is now handled client-side in the branch creation page
    // This API endpoint exists as a placeholder for future server-side operations
    // Client-side initialization is more reliable and doesn't require Firebase Admin SDK

    return NextResponse.json({
      success: true,
      message: 'Branch initialization request acknowledged',
      branchId,
    });

  } catch (error: any) {
    console.error('[v0] Error in branch initialization:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Initialization request failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
