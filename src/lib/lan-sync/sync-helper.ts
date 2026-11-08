import { isLocalMasterHost } from './is-local-master-host';

/**
 * Broadcasts a local data mutation to the Master Server PC LAN store.
 * The Master Server persists the change to disk, streams it instantly via SSE
 * to all connected Wi-Fi devices, and queues it for Cloud Sync when internet returns.
 */
export async function pushLanMutation(
  collectionName: string,
  docId: string,
  action: 'set' | 'update' | 'delete',
  data?: Record<string, unknown>
): Promise<void> {
  // Public/hosted deployments (including Vercel) are not LAN Master Servers.
  // Avoid unnecessary requests to filesystem-backed LAN endpoints there.
  if (typeof window === 'undefined' || !isLocalMasterHost()) return;

  try {
    // Strip functions or complex objects that cannot be serialized
    const cleanData = data
      ? JSON.parse(
          JSON.stringify(data, (key, value) => {
            if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
              return value.toDate().toISOString();
            }
            return value;
          })
        )
      : undefined;

    fetch('/api/lan-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectionName,
        docId,
        action,
        data: cleanData,
      }),
    }).catch((err) => {
      console.warn(`[LAN Sync] Background push failed for ${collectionName}/${docId}:`, err);
    });
  } catch (err) {
    console.warn(`[LAN Sync] Serialization error for ${collectionName}/${docId}:`, err);
  }
}

export type LanMutationInput = {
  collectionName: string;
  docId: string;
  action: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
};

/**
 * Commit a related group of records through the Local Master before reporting
 * success. Hosted deployments keep their existing Firestore write path.
 * A failed local request is surfaced to the caller; it is never silently
 * converted into a Firestore-only success while running on the Master PC.
 */
export async function commitLocalFirstMutations(
  mutations: LanMutationInput[],
  transactionKey: string,
  cloudCommit: () => Promise<unknown>,
  stockAdjustments: Array<{ collectionName: string; itemId: string; quantityDelta: number; initialData?: Record<string, unknown> }> = []
): Promise<{ local: boolean; duplicate?: boolean }> {
  if (typeof window === 'undefined' || !isLocalMasterHost()) {
    await cloudCommit();
    return { local: false };
  }

  const cleanValue = (value: any): any => {
    if (value === undefined) return undefined;
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' && !Number.isFinite(value)) return value === Infinity ? '__LAN_INFINITY__' : value === -Infinity ? '__LAN_NEG_INFINITY__' : '__LAN_NAN__';
    if (Array.isArray(value)) return value.map(cleanValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cleanValue(child)]));
    }
    return value;
  };

  const response = await fetch('/api/lan-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionKey,
      mutations: mutations.map((mutation) => ({
        ...mutation,
        data: mutation.data ? cleanValue(mutation.data) : undefined,
      })),
      stockAdjustments,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true || result?.durable !== true) {
    throw new Error(result?.message || result?.error || 'The Master PC could not confirm a durable local save. Please retry.');
  }

  return { local: true, duplicate: Boolean(result.duplicate) };
}



/** Read the durable Local Master collection for offline validation and UI fallbacks. */
export async function fetchLocalLanCollection<T = Record<string, unknown>>(
  collectionName: string
): Promise<T[]> {
  if (typeof window === 'undefined' || !isLocalMasterHost()) return [];
  const response = await fetch('/api/lan-sync?collection=' + encodeURIComponent(collectionName), {
    method: 'GET',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not read the Local Master database.');
  const result = await response.json();
  if (result?.success !== true || !result?.data || typeof result.data !== 'object') {
    throw new Error('The Local Master returned an invalid collection response.');
  }
  const restore = (value: any): any => {
    if (value === '__LAN_INFINITY__') return Infinity;
    if (value === '__LAN_NEG_INFINITY__') return -Infinity;
    if (value === '__LAN_NAN__') return NaN;
    if (Array.isArray(value)) return value.map(restore);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, restore(child)]));
    return value;
  };
  return Object.entries(result.data).map(([id, value]) => ({ id, ...restore(value as object) })) as T[];
}
