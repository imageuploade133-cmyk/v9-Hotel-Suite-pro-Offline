/**
 * Unified Refund Service
 *
 * This service provides a centralized way to process refunds across the entire application.
 * It ensures consistency in:
 * - Updating stock quantities
 * - Creating refund records
 * - Creating refund payment records
 * - Updating original payment statuses
 * - Logging audit trails
 * - Triggering financial data refresh
 *
 * All refund operations should use this service to ensure financial data consistency.
 */

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
  query,
  where,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import type { StockSale, StockReturn, StockItem, Payment, UserProfile } from '@/lib/types';

// Event name for refund completion - used to trigger UI updates
export const REFUND_COMPLETED_EVENT = 'refund:completed';

export interface RefundItem {
  itemId: string;
  quantity: number;
  itemName: string;
  sellingPrice: number;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  totalRefundAmount: number;
  error?: string;
}

export interface RefundOptions {
  firestore: Firestore;
  getCollectionPath: (collectionName: string) => string;
  userProfile: UserProfile;
  formatCurrency: (value: number) => string;
}

/**
 * Process a refund for a stock sale
 * This function handles all aspects of a refund in a single transaction:
 * 1. Returns items to stock
 * 2. Updates the original sale status
 * 3. Creates a refund record
 * 4. Creates a refund payment record
 * 5. Updates original payment statuses to 'Refunded'
 * 6. Creates an audit log entry
 */
export async function processRefund(
  saleToRefund: StockSale,
  itemsToReturn: RefundItem[],
  reason: string,
  options: RefundOptions
): Promise<RefundResult> {
  const { firestore, getCollectionPath, userProfile, formatCurrency } = options;

  if (!firestore || !userProfile) {
    return { success: false, totalRefundAmount: 0, error: 'User or Firestore not available.' };
  }

  if (!itemsToReturn || itemsToReturn.length === 0) {
    return { success: false, totalRefundAmount: 0, error: 'No items selected for refund.' };
  }

  const totalRefundAmount = itemsToReturn.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0
  );

  try {
    const refundId = `REF-${Math.random().toString(36).substr(2, 7).toUpperCase()}`;

    await runTransaction(firestore, async (transaction) => {
      // PHASE 1: Read all necessary documents
      const itemRefsAndDataPromises = itemsToReturn.map((item) => {
        const itemRef = doc(firestore, getCollectionPath('stock'), item.itemId);
        return transaction.get(itemRef).then((itemDoc) => ({
          ref: itemRef,
          doc: itemDoc,
          returnQuantity: item.quantity,
          itemData: item,
        }));
      });

      const itemRefsAndDocs = await Promise.all(itemRefsAndDataPromises);

      // Validate all items exist
      for (const item of itemRefsAndDocs) {
        if (!item.doc.exists()) {
          throw new Error(`Stock item ${item.itemData.itemName} not found.`);
        }
      }

      const saleRef = doc(firestore, getCollectionPath('stockSales'), saleToRefund.id);
      const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
      const returnRef = doc(collection(firestore, getCollectionPath('stockReturns')));
      const refundPaymentRef = doc(collection(firestore, getCollectionPath('payments')));

      // Find and update all original payments linked to this sale that are still "Paid"
      const paymentsQuery = query(
        collection(firestore, getCollectionPath('payments')),
        where('bookingId', '==', saleToRefund.id),
        where('status', '==', 'Paid')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      const paymentsToUpdate: { ref: ReturnType<typeof doc>; id: string }[] = [];
      paymentsSnapshot.forEach((paymentDoc) => {
        const paymentRef = doc(firestore, getCollectionPath('payments'), paymentDoc.id);
        paymentsToUpdate.push({ ref: paymentRef, id: paymentDoc.id });
      });

      // PHASE 2: Perform all writes

      // 1. Return items to stock
      itemRefsAndDocs.forEach((item) => {
        const currentData = item.doc.data() as StockItem;
        const newQuantity = currentData.quantity + item.returnQuantity;
        transaction.update(item.ref, { quantity: newQuantity });
      });

      // 2. Calculate new refund status for the sale
      const existingRefundedItems = saleToRefund.refundedItems || [];
      const newRefundedItems = [
        ...existingRefundedItems,
        ...itemsToReturn.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      ];

      const allItemsRefunded = saleToRefund.items.every((originalItem) => {
        const totalRefunded = newRefundedItems
          .filter((rf) => rf.itemId === originalItem.itemId)
          .reduce((sum, rf) => sum + rf.quantity, 0);
        return totalRefunded >= originalItem.quantity;
      });

      const newStatus = allItemsRefunded ? 'Refunded' : 'Partially Refunded';

      // Update the sale with new status and refunded items
      transaction.update(saleRef, {
        status: newStatus,
        refundedItems: newRefundedItems,
        updatedAt: serverTimestamp(),
      });

      // 3. Update all original payments to 'Refunded' status
      paymentsToUpdate.forEach(({ ref }) => {
        transaction.update(ref, {
          status: 'Refunded',
          refundedAt: serverTimestamp(),
          refundReason: reason || 'Sale refunded',
        });
      });

      // 4. Create the refund record
      const returnData: Omit<StockReturn, 'id'> = {
        refundId,
        originalSaleId: saleToRefund.id,
        returnedAt: serverTimestamp() as Timestamp,
        returnedByUid: userProfile.uid,
        returnedByName: userProfile.name,
        items: itemsToReturn.map((i) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          quantity: i.quantity,
          sellingPrice: i.sellingPrice,
          refundAmount: i.sellingPrice * i.quantity,
        })),
        totalRefundAmount,
        customerName: saleToRefund.customerName || 'Walk-in Customer',
        customerId: saleToRefund.customerId,
        reason,
        keywords: ['refund', saleToRefund.saleId.toLowerCase(), ...itemsToReturn.map((i) => i.itemName.toLowerCase())],
      };
      transaction.set(returnRef, returnData);

      // 5. Create the refund payment record
      const refundPaymentData: Omit<Payment, 'id'> = {
        amount: totalRefundAmount,
        transactionDate: new Date(),
        paymentMethod: (saleToRefund.paymentMethod === 'Credit' ? 'Cash' : saleToRefund.paymentMethod) as any,
        status: 'Refunded',
        type: 'POS',
        createdByUid: userProfile.uid,
        createdByName: userProfile.name,
        guestName: saleToRefund.customerName || 'Walk-in Customer',
        guestEmail: saleToRefund.customerEmail || null,
        bookingId: saleToRefund.id,
        items: itemsToReturn.map((i) => ({ name: i.itemName, price: i.sellingPrice, quantity: i.quantity })),
        context: saleToRefund.context === 'hotel' ? 'hotel' : 'pos',
        originalPaymentId: saleToRefund.id,
        notes: reason || null,
      };
      transaction.set(refundPaymentRef, refundPaymentData);

      // 6. Create audit log entry
      transaction.set(auditLogRef, {
        timestamp: serverTimestamp(),
        userId: userProfile.uid,
        userName: userProfile.name,
        changeType: 'Refund',
        entityType: 'Stock Sale',
        entityId: saleToRefund.id,
        details: `Processed refund for ${saleToRefund.customerName || 'Walk-in Customer'}.`,
        changes: itemsToReturn.map((i) => ({
          field: `refunded ${i.itemName}`,
          before: 0,
          after: i.quantity,
        })),
        notes: `Total: ${formatCurrency(totalRefundAmount)}`,
      });
    });

    // Dispatch event to trigger UI updates across the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(REFUND_COMPLETED_EVENT, {
          detail: {
            refundId,
            saleId: saleToRefund.id,
            totalRefundAmount,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    return {
      success: true,
      refundId,
      totalRefundAmount,
    };
  } catch (err: any) {
    console.error('Refund processing error:', err);
    return {
      success: false,
      totalRefundAmount,
      error: err.message || 'Failed to process refund',
    };
  }
}

/**
 * Calculate the net amount for a sale after refunds
 */
export function calculateNetSaleAmount(sale: StockSale): number {
  if (!sale.refundedItems || sale.refundedItems.length === 0) {
    return sale.totalAmount;
  }

  const totalRefunded = sale.refundedItems.reduce((sum, item) => {
    const saleItem = sale.items.find((si) => si.itemId === item.itemId);
    return sum + (saleItem?.sellingPrice || 0) * item.quantity;
  }, 0);

  return Math.max(0, sale.totalAmount - totalRefunded);
}

/**
 * Check if a sale has been fully refunded
 */
export function isFullyRefunded(sale: StockSale): boolean {
  // Use paymentStatus field which is the correct field in StockSale type
  return sale.paymentStatus === 'Refunded';
}

/**
 * Calculate total refunds for a list of returns
 */
export function calculateTotalRefunds(returns: StockReturn[]): number {
  return returns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
}

/**
 * Filter sales to exclude fully refunded ones for income calculations
 */
export function filterActiveSales(sales: StockSale[]): StockSale[] {
  return sales.filter((sale) => sale.paymentStatus !== 'Refunded');
}

/**
 * Calculate net revenue from sales after refunds
 */
export function calculateNetRevenue(
  sales: StockSale[],
  returns: StockReturn[],
  dateRange?: { from?: Date; to?: Date }
): number {
  const filteredSales = dateRange?.from
    ? sales.filter((sale) => {
        const saleDate = sale.soldAt as unknown as Date;
        return saleDate >= dateRange.from! && saleDate <= (dateRange.to || dateRange.from!);
      })
    : sales;

  const filteredReturns = dateRange?.from
    ? returns.filter((ret) => {
        const returnDate = ret.returnedAt as unknown as Date;
        return returnDate >= dateRange.from! && returnDate <= (dateRange.to || dateRange.from!);
      })
    : returns;

  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalRefunds = filteredReturns.reduce((sum, ret) => sum + ret.totalRefundAmount, 0);

  return Math.max(0, totalSales - totalRefunds);
}
