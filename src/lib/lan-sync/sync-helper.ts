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
  cloudCommit: () => Promise<unknown>
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
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true || result?.durable !== true) {
    throw new Error(result?.message || result?.error || 'The Master PC could not confirm a durable local save. Please retry.');
  }

  return { local: true, duplicate: Boolean(result.duplicate) };
}

