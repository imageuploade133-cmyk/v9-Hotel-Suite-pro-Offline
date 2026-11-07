import { NextRequest, NextResponse } from 'next/server';
import { lanStore } from '@/lib/lan-sync/lan-store';
import { isLocalMasterServerRuntime } from '@/lib/lan-sync/is-local-master-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isLocalMasterServerRuntime()) {
    return NextResponse.json({ success: false, code: 'LAN_MASTER_ONLY', message: 'Local stock deduction is available only on the Local Master Server.' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { items, salePayload, paymentPayload } = body;

    // Supports single item { itemId, quantity } or array of items [{ itemId, quantity }]
    if (items && Array.isArray(items)) {
      // Multi-item cart deduction
      for (const item of items) {
        const result = lanStore.deductStock(item.itemId, Number(item.quantity || 1));
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error, itemId: item.itemId },
            { status: 400 }
          );
        }
      }

      // If sale payload is provided, save it
      if (salePayload) {
        const saleId = salePayload.id || crypto.randomUUID();
        lanStore.addMutation('stockSales', saleId, 'set', { ...salePayload, id: saleId });
      }

      // If payment payload is provided, save it
      if (paymentPayload) {
        const paymentId = paymentPayload.id || crypto.randomUUID();
        lanStore.addMutation('payments', paymentId, 'set', { ...paymentPayload, id: paymentId });
      }

      return NextResponse.json({
        success: true,
        message: 'Cart stock deducted successfully and broadcast to all devices.',
        summary: lanStore.getStateSummary(),
      });
    }

    const { itemId, quantity = 1 } = body;
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: itemId' },
        { status: 400 }
      );
    }

    const result = lanStore.deductStock(itemId, Number(quantity), salePayload, paymentPayload);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, remainingQuantity: result.remainingQuantity },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stock deducted successfully',
      remainingQuantity: result.remainingQuantity,
      saleId: result.saleId,
      summary: lanStore.getStateSummary(),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Stock deduction failed';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
