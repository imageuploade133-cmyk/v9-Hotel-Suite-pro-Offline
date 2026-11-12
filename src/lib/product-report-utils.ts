import type { StockItem, StockSale, StockReturn } from '@/lib/types';
import { endOfDay, startOfDay } from 'date-fns';

export interface ProductRestockMovement {
  itemId: string;
  quantityAdded: number;
  restockedAt: unknown;
}

export function toReportDate(value: unknown): Date | null {
  if (!value) return null;
  try {
    const candidate = value as { toDate?: () => Date };
    const date = typeof candidate?.toDate === 'function' ? candidate.toDate() : new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function getProductMovementSummary(
  product: Pick<StockItem, 'id' | 'quantity' | 'reservedQuantity'>,
  sales: StockSale[],
  returns: StockReturn[],
  restocks: ProductRestockMovement[],
  from: Date,
  to: Date,
) {
  const start = startOfDay(from);
  const end = endOfDay(to);
  let soldInRange = 0;
  let returnedInRange = 0;
  let soldAfterStart = 0;
  let returnedAfterStart = 0;
  let restockedAfterStart = 0;
  let soldAfterEnd = 0;
  let returnedAfterEnd = 0;
  let restockedAfterEnd = 0;

  for (const sale of sales) {
    const date = toReportDate(sale.soldAt);
    if (!date) continue;
    const quantity = (sale.items || []).reduce((sum, item) =>
      sum + (item.itemId === product.id && !item.isService ? Math.max(0, Number(item.quantity) || 0) : 0), 0);
    if (!quantity) continue;
    if (date >= start && date <= end) soldInRange += quantity;
    if (date >= start) soldAfterStart += quantity;
    if (date > end) soldAfterEnd += quantity;
  }

  for (const refund of returns) {
    const date = toReportDate(refund.returnedAt);
    if (!date) continue;
    const quantity = (refund.items || []).reduce((sum, item) =>
      sum + (item.itemId === product.id ? Math.max(0, Number(item.quantity) || 0) : 0), 0);
    if (!quantity) continue;
    if (date >= start && date <= end) returnedInRange += quantity;
    if (date >= start) returnedAfterStart += quantity;
    if (date > end) returnedAfterEnd += quantity;
  }

  for (const restock of restocks) {
    if (restock.itemId !== product.id) continue;
    const date = toReportDate(restock.restockedAt);
    if (!date) continue;
    const quantity = Math.max(0, Number(restock.quantityAdded) || 0);
    if (date >= start) restockedAfterStart += quantity;
    if (date > end) restockedAfterEnd += quantity;
  }

  const currentOnHand = Number(product.quantity) || 0;
  // Reconstruct historical balances by reversing movements recorded after each boundary.
  // This is exact only to the extent that all stock adjustments/transfers were ledgered.
  const openingStock = currentOnHand - restockedAfterStart + soldAfterStart - returnedAfterStart;
  const availableAtEnd = currentOnHand - restockedAfterEnd + soldAfterEnd - returnedAfterEnd;

  return {
    openingStock,
    availableAtEnd,
    soldInRange,
    returnedInRange,
    netSoldInRange: soldInRange - returnedInRange,
    currentOnHand,
    reservedNow: Math.max(0, Number(product.reservedQuantity) || 0),
    currentlyAvailable: currentOnHand - Math.max(0, Number(product.reservedQuantity) || 0),
  };
}
