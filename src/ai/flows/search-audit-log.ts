
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  Firestore,
  QueryConstraint,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import type { StockAuditLog } from "@/lib/types";

interface SearchAuditLogParams {
  firestore: Firestore;
  prompt?: string;
  entityType?: 'Stock' | 'Global' | 'All';
  dateRange?: { from?: Date; to?: Date };
  staffId?: string;
  changeType?: string;
  searchTerm?: string;
  direction?: 'next' | 'prev' | 'initial';
  lastVisibleDoc?: QueryDocumentSnapshot<DocumentData> | null;
  firstVisibleDoc?: QueryDocumentSnapshot<DocumentData> | null;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;

export async function searchAuditLog({
  firestore,
  prompt,
  entityType = 'All',
  dateRange,
  staffId,
  changeType,
  searchTerm,
  direction = 'initial',
  lastVisibleDoc,
  firstVisibleDoc,
  pageSize = DEFAULT_PAGE_SIZE,
}: SearchAuditLogParams) {

  let constraints: QueryConstraint[] = [];

  if (entityType === 'Stock') {
    constraints.push(where('entityType', 'in', ['Stock Item', 'Stock Sale', 'Stock Transfer', 'Stock Keeper']));
  }

  if (prompt) {
      const keywords = prompt.toLowerCase().split(/\s+/).filter(Boolean);
      if (keywords.length > 0) {
          constraints.push(where('keywords', 'array-contains-any', keywords));
      }
  }

  if (dateRange?.from) constraints.push(where('timestamp', '>=', Timestamp.fromDate(dateRange.from)));
  if (dateRange?.to) constraints.push(where('timestamp', '<=', Timestamp.fromDate(dateRange.to)));
  if (staffId && staffId !== 'all') constraints.push(where('userId', '==', staffId));
  if (changeType && changeType !== 'All') constraints.push(where('changeType', '==', changeType));
  if (searchTerm) constraints.push(where('keywords', 'array-contains', searchTerm.toLowerCase()));

  const baseQuery = query(collection(firestore, 'globalAuditLog'), ...constraints, orderBy('timestamp', 'desc'));

  let paginatedQuery = baseQuery;

  if (direction === 'next' && lastVisibleDoc) {
    paginatedQuery = query(baseQuery, startAfter(lastVisibleDoc), limit(pageSize));
  } else if (direction === 'prev' && firstVisibleDoc) {
    paginatedQuery = query(baseQuery, endBefore(firstVisibleDoc), limitToLast(pageSize));
  } else {
    paginatedQuery = query(baseQuery, limit(pageSize));
  }

  try {
    const snapshot = await getDocs(paginatedQuery);
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAuditLog));

    let hasMore = false;
    if (!snapshot.empty) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        const nextQuery = query(baseQuery, startAfter(lastDoc), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = !nextSnapshot.empty;
    }

    return {
      logs,
      firstVisible: snapshot.docs[0] || null,
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore,
    };

  } catch (error) {
    console.error("Error searching audit logs:", error);
    if (prompt) {
        return "I couldn't retrieve the audit logs. There might be a database configuration issue.";
    }
    throw error;
  }
}
