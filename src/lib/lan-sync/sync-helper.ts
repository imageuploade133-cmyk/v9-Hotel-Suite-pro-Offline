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
  if (typeof window === 'undefined') return;

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
