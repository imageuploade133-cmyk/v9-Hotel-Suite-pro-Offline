import { collection, doc, Firestore, setDoc, Timestamp } from 'firebase/firestore';
import { commitLocalFirstMutations } from '@/lib/lan-sync/sync-helper';

export type AuditAction =
  | 'Login' | 'Logout' | 'Create' | 'Update' | 'Delete' | 'Restock'
  | 'Sale' | 'Refund' | 'Transfer' | 'Check-in' | 'Check-out'
  | 'Cancel' | 'Bill' | 'Print' | 'Reprint' | 'Payment' | 'Status Change';

export interface AuditChange { field: string; before: unknown; after: unknown; }

export interface AuditEventInput {
  action: AuditAction;
  module: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  branchId?: string;
  branchName?: string;
  description: string;
  changes?: AuditChange[];
  details?: Record<string, unknown>;
  status?: 'Success' | 'Failed' | 'Pending' | 'Reversed';
  collectionName?: string;
  documentId?: string;
}

/** Queue an immutable audit event in Firestore. Never let audit failure interrupt the primary business action. */
export async function logAuditEvent(firestore: Firestore | null | undefined, event: AuditEventInput): Promise<boolean> {
  if (!firestore || !event.userId || !event.userName || !event.module || !event.description) return false;
  const searchable = [
    event.action, event.module, event.entityType, event.entityId, event.entityName,
    event.userName, event.userEmail, event.userRole, event.branchName, event.description,
    ...(event.changes || []).flatMap(change => [change.field, printable(change.before), printable(change.after)]),
  ];
  const keywords = Array.from(new Set(searchable
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .flatMap(value => value.toLowerCase().split(/[^a-z0-9@._-]+/g))
    .filter(value => value.length > 1))).slice(0, 200);
  const auditRef = doc(collection(firestore, 'globalAuditLog'));
  const auditRecord = {
      changeType: event.action, action: event.action, module: event.module,
      entityType: event.entityType, entityId: event.entityId || event.documentId || '',
      entityName: event.entityName || '', collectionName: event.collectionName || '',
      documentId: event.documentId || event.entityId || '', userId: event.userId,
      userName: event.userName, userEmail: event.userEmail || '', userRole: event.userRole || '',
      branchId: event.branchId || 'global', branchName: event.branchName || 'Global',
      description: event.description, details: event.details || {}, changes: event.changes || [],
      status: event.status || 'Success', timestamp: Timestamp.now(), keywords, schemaVersion: 2,
  };

  try {
    await commitLocalFirstMutations(
      [{ collectionName: 'globalAuditLog', docId: auditRef.id, action: 'set', data: auditRecord }],
      `global-audit:${auditRef.id}`,
      () => setDoc(auditRef, auditRecord)
    );
    return true;
  } catch (error) {
    console.error('[GlobalAudit] Could not queue activity record:', error);
    return false;
  }
}

function printable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return ''; }
}
