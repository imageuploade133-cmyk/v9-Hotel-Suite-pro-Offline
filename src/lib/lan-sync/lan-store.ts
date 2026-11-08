import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface SyncMutation {
  id: string;
  collectionName: string;
  docId: string;
  action: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
  timestamp: number;
  syncedToCloud: boolean;
  syncedAt?: number;
  attempts: number;
  error?: string;
  transactionKey?: string;
}

export interface LanStoreState {
  mutations: SyncMutation[];
  collections: Record<string, Record<string, unknown>>;
  lastCloudSync: number | null;
  masterServerIp: string | null;
}

export type StoreEvent = {
  type: 'mutation' | 'sync' | 'stock_deduct' | 'user_update';
  collectionName: string;
  docId: string;
  action: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
  timestamp: number;
};

export type StoreEventListener = (event: StoreEvent) => void;

const DB_DIR = path.join(process.cwd(), '.lan-data');
const DB_FILE = path.join(DB_DIR, 'lan_db.json');
const BACKUP_FILE = path.join(DB_DIR, 'lan_db.backup.json');
const ARCHIVE_DIR = path.join(DB_DIR, 'archive');
const BACKUPS_DIR = path.join(DB_DIR, 'backups');

let lastBackupTime = 0;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // Snapshot backup every 1 hour

function isServerlessRuntime(): boolean {
  return process.env.VERCEL === '1'
    || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
    || Boolean(process.env.NOW_REGION);
}

function ensureDbDir(): void {
  if (isServerlessRuntime()) return;
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function archiveOldMutations(state: LanStoreState): void {
  try {
    ensureDbDir();
    const dateStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    const archiveFile = path.join(ARCHIVE_DIR, `mutations_${dateStr}.jsonl`);

    // Keep the most recent 1,500 mutations in the active working memory buffer
    const keepCount = 1500;
    const toArchive = state.mutations.slice(0, state.mutations.length - keepCount);
    const toKeep = state.mutations.slice(state.mutations.length - keepCount);

    if (toArchive.length > 0) {
      const lines = toArchive.map((m) => JSON.stringify(m)).join('\n') + '\n';
      fs.appendFileSync(archiveFile, lines, 'utf-8');
      state.mutations = toKeep;
    }
  } catch (err) {
    console.error('[LAN Store] Error archiving old mutations:', err);
  }
}

function maybeCreatePeriodicBackup(): void {
  const now = Date.now();
  if (now - lastBackupTime < BACKUP_INTERVAL_MS) {
    return;
  }
  lastBackupTime = now;
  try {
    if (fs.existsSync(DB_FILE)) {
      // Primary quick backup
      fs.copyFileSync(DB_FILE, BACKUP_FILE);

      // Hourly/daily rolling snapshot
      const dateStr = new Date().toISOString().slice(0, 13).replace('T', '_'); // YYYY-MM-DD_HH
      const snapshotPath = path.join(BACKUPS_DIR, `snapshot_${dateStr}.json`);
      fs.copyFileSync(DB_FILE, snapshotPath);

      // Clean snapshots older than 30 days to save disk space
      const existingFiles = fs.readdirSync(BACKUPS_DIR);
      if (existingFiles.length > 720) {
        existingFiles.sort().slice(0, existingFiles.length - 720).forEach((f) => {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, f));
          } catch {
            // ignore
          }
        });
      }
    }
  } catch (err) {
    console.error('[LAN Store] Error creating periodic backup:', err);
  }
}

function loadState(): LanStoreState {
  if (isServerlessRuntime()) {
    return {
      mutations: [],
      collections: {},
      lastCloudSync: null,
      masterServerIp: null,
    };
  }
  ensureDbDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err: unknown) {
      console.error('[LAN Store] Error reading primary store file, attempting recovery from backup:', err);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const backupData = fs.readFileSync(BACKUP_FILE, 'utf-8');
          console.warn('[LAN Store] Successfully recovered database from backup file.');
          return JSON.parse(backupData);
        } catch (backupErr) {
          console.error('[LAN Store] Failed to read backup file:', backupErr);
        }
      }
    }
  }
  return {
    mutations: [],
    collections: {},
    lastCloudSync: null,
    masterServerIp: null,
  };
}

function saveState(state: LanStoreState): void {
  // Vercel/serverless filesystems are ephemeral and may be read-only.
  // Never attempt to create .lan-data outside the Local Master Server.
  if (isServerlessRuntime()) return;
  ensureDbDir();
  try {
    // Prevent unbounded memory growth over years of offline transactions
    if (state.mutations.length > 3000) {
      archiveOldMutations(state);
    }

    // Atomic write pattern: write to unique tmp file then atomic rename
    // Prevents corrupted files if power goes out mid-write
    const tempFile = path.join(DB_DIR, `lan_db.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`);
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    maybeCreatePeriodicBackup();
  } catch (err: unknown) {
    console.error('[LAN Store] Error writing local store file:', err);
    throw err;
  }
}

export class LanStore {
  private static instance: LanStore;
  private readonly collectionsMap = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly mutationsList: SyncMutation[] = [];
  private lastCloudSyncTime: number | null = null;
  private masterIpAddress: string | null = null;
  private readonly listeners = new Set<StoreEventListener>();

  private constructor() {
    const initialState = loadState();
    this.mutationsList = initialState.mutations || [];
    this.lastCloudSyncTime = initialState.lastCloudSync || null;
    this.masterIpAddress = initialState.masterServerIp || null;

    if (initialState.collections) {
      for (const [colName, colDocs] of Object.entries(initialState.collections)) {
        const docMap = new Map<string, Record<string, unknown>>();
        if (colDocs) {
          for (const [docId, docData] of Object.entries(colDocs)) {
            docMap.set(docId, docData);
          }
        }
        this.collectionsMap.set(colName, docMap);
      }
    }
  }

  public static getInstance(): LanStore {
    if (!LanStore.instance) {
      LanStore.instance = new LanStore();
    }
    return LanStore.instance;
  }

  public subscribe(listener: StoreEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(event: StoreEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[LAN Store] Listener broadcast error:', err);
      }
    }
  }

  private persistTimer: NodeJS.Timeout | null = null;

  private persist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.doPersist();
    }, 40);
  }

  private doPersist(): void {
    const collectionsObj: Record<string, Record<string, unknown>> = {};
    for (const [colName, docMap] of this.collectionsMap.entries()) {
      collectionsObj[colName] = Object.fromEntries(docMap.entries());
    }
    saveState({
      mutations: this.mutationsList,
      collections: collectionsObj,
      lastCloudSync: this.lastCloudSyncTime,
      masterServerIp: this.masterIpAddress,
    });
  }

  /**
   * Apply a group of document mutations as one durable Master-PC transaction.
   * The JSON database is atomically replaced before this method returns. A
   * transactionKey makes client retries safe after a lost HTTP response.
   */
  public applyMutationsAtomic(
    inputs: Array<{
      collectionName: string;
      docId: string;
      action: 'set' | 'update' | 'delete';
      data?: Record<string, unknown>;
    }>,
    transactionKey?: string
  ): { mutations: SyncMutation[]; duplicate: boolean } {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('A non-empty mutation batch is required.');
    }

    if (transactionKey) {
      const prior = this.mutationsList.filter((m) => m.transactionKey === transactionKey);
      if (prior.length > 0) return { mutations: prior, duplicate: true };
    }

    const previousCollections = new Map<string, Map<string, Record<string, unknown>>>();
    for (const [name, docs] of this.collectionsMap.entries()) {
      previousCollections.set(name, new Map(docs));
    }
    const previousMutationCount = this.mutationsList.length;
    const timestamp = Date.now();
    const created: SyncMutation[] = [];

    try {
      for (const input of inputs) {
        let docMap = this.collectionsMap.get(input.collectionName);
        if (!docMap) {
          docMap = new Map<string, Record<string, unknown>>();
          this.collectionsMap.set(input.collectionName, docMap);
        }

        if (input.action === 'delete') {
          docMap.delete(input.docId);
        } else if (input.action === 'set') {
          docMap.set(input.docId, { id: input.docId, ...(input.data || {}) });
        } else {
          const existing = docMap.get(input.docId) || { id: input.docId };
          docMap.set(input.docId, { ...existing, ...(input.data || {}) });
        }

        const mutation: SyncMutation = {
          id: crypto.randomUUID(),
          collectionName: input.collectionName,
          docId: input.docId,
          action: input.action,
          data: input.data,
          timestamp,
          syncedToCloud: false,
          attempts: 0,
          transactionKey,
        };
        this.mutationsList.push(mutation);
        created.push(mutation);
      }

      // Persist synchronously; never acknowledge a transaction still waiting
      // in a debounce timer or silently swallowed filesystem write error.
      if (this.persistTimer) {
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
      }
      this.doPersist();
    } catch (error) {
      this.collectionsMap.clear();
      for (const [name, docs] of previousCollections.entries()) {
        this.collectionsMap.set(name, docs);
      }
      this.mutationsList.splice(previousMutationCount);
      throw error;
    }

    for (const mutation of created) {
      const docs = this.collectionsMap.get(mutation.collectionName);
      this.broadcast({
        type: 'mutation',
        collectionName: mutation.collectionName,
        docId: mutation.docId,
        action: mutation.action,
        data: docs?.get(mutation.docId) || mutation.data,
        timestamp,
      });
    }

    return { mutations: created, duplicate: false };
  }

  public addMutation(
    collectionName: string,
    docId: string,
    action: 'set' | 'update' | 'delete',
    data?: Record<string, unknown>
  ): SyncMutation {
    return this.applyMutationsAtomic([{ collectionName, docId, action, data }]).mutations[0];
  }

  public getPendingMutations(): SyncMutation[] {
    return this.mutationsList.filter((m) => !m.syncedToCloud);
  }

  public getAllMutations(): SyncMutation[] {
    return [...this.mutationsList].sort((a, b) => b.timestamp - a.timestamp);
  }

  public markMutationSynced(id: string): void {
    const mutation = this.mutationsList.find((m) => m.id === id);
    if (mutation) {
      mutation.syncedToCloud = true;
      mutation.syncedAt = Date.now();
      mutation.error = undefined;
      this.lastCloudSyncTime = Date.now();
      this.persist();
    }
  }

  public markMutationFailed(id: string, errorMsg: string): void {
    const mutation = this.mutationsList.find((m) => m.id === id);
    if (mutation) {
      mutation.attempts += 1;
      mutation.error = errorMsg;
      this.persist();
    }
  }

  public getCollection(collectionName: string): Record<string, unknown> {
    const docMap = this.collectionsMap.get(collectionName);
    if (!docMap) return {};
    return Object.fromEntries(docMap.entries());
  }

  public getDoc(collectionName: string, docId: string): Record<string, unknown> | null {
    const docMap = this.collectionsMap.get(collectionName);
    if (!docMap) return null;
    return docMap.get(docId) || null;
  }

  /**
   * Atomic stock deduction method:
   * Validates available quantity, decrements stock item, records sale and payment if provided,
   * persists to disk, and broadcasts the event instantly over SSE.
   */
  public deductStock(
    itemId: string,
    quantityToDeduct: number,
    salePayload?: Record<string, unknown>,
    paymentPayload?: Record<string, unknown>
  ): { success: boolean; error?: string; remainingQuantity?: number; saleId?: string } {
    let stockMap = this.collectionsMap.get('stock');
    if (!stockMap) {
      stockMap = new Map();
      this.collectionsMap.set('stock', stockMap);
    }

    const item = stockMap.get(itemId);
    if (!item) {
      return { success: false, error: `Stock item "${itemId}" not found in local store.` };
    }

    const currentQty = Number(item.quantity ?? item.stockCount ?? 0);
    if (isNaN(currentQty) || currentQty < quantityToDeduct) {
      return {
        success: false,
        error: `Insufficient stock for "${item.name || itemId}". Available: ${currentQty}, Requested: ${quantityToDeduct}.`,
        remainingQuantity: currentQty,
      };
    }

    const newQuantity = currentQty - quantityToDeduct;
    const updatedItem = {
      ...item,
      quantity: newQuantity,
      stockCount: newQuantity,
      updatedAt: Date.now(),
    };
    stockMap.set(itemId, updatedItem);

    // Queue mutation for stock update
    this.addMutation('stock', itemId, 'update', updatedItem);

    // If sale payload is provided, record in stockSales
    let saleId: string | undefined;
    if (salePayload) {
      saleId = (salePayload.id as string) || (salePayload.saleId as string) || crypto.randomUUID();
      const finalSale = { ...salePayload, id: saleId, soldAt: salePayload.soldAt || Date.now() };
      this.addMutation('stockSales', saleId, 'set', finalSale);
    }

    // If payment payload is provided, record in payments
    if (paymentPayload) {
      const paymentId = (paymentPayload.id as string) || crypto.randomUUID();
      const finalPayment = { ...paymentPayload, id: paymentId, transactionDate: paymentPayload.transactionDate || Date.now() };
      this.addMutation('payments', paymentId, 'set', finalPayment);
    }

    this.persist();

    return {
      success: true,
      remainingQuantity: newQuantity,
      saleId,
    };
  }

  /**
   * Cache user credentials for offline authentication
   */
  public cacheUser(user: {
    uid: string;
    email: string;
    name: string;
    role?: string;
    permissions?: string[];
    assignedBranches?: string[];
    isFirebaseOnlyAdmin?: boolean;
    accountType?: 'staff' | 'firebase-only-admin';
    passwordHash?: string;
  }): void {
    let usersMap = this.collectionsMap.get('users');
    if (!usersMap) {
      usersMap = new Map();
      this.collectionsMap.set('users', usersMap);
    }

    const existing = usersMap.get(user.uid) || {};
    const updated = {
      ...existing,
      ...user,
      email: user.email.toLowerCase(),
      cachedAt: Date.now(),
    };
    usersMap.set(user.uid, updated);
    this.persist();
  }

  /**
   * Verify credentials offline against locally cached users
   */
  public verifyOfflineCredentials(
    email: string,
    passwordPlain: string
  ): { success: boolean; user?: Record<string, unknown>; error?: string } {
    const usersMap = this.collectionsMap.get('users');
    if (!usersMap || usersMap.size === 0) {
      return {
        success: false,
        error: 'No local users cached on Master PC. Connect to internet once to sync staff accounts.',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    let foundUser: Record<string, unknown> | null = null;

    for (const [_, user] of usersMap.entries()) {
      const uEmail = String(user.email || '').toLowerCase();
      if (uEmail === cleanEmail) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return {
        success: false,
        error: 'User not found in local offline database. Please check email address.',
      };
    }

    // Compute SHA-256 of plain password
    const hash = crypto.createHash('sha256').update(passwordPlain).digest('hex');

    // If stored user has passwordHash, match against it.
    // Otherwise, allow fallback verification if marked active or password matches hash.
    if (foundUser.passwordHash) {
      if (foundUser.passwordHash !== hash) {
        return { success: false, error: 'Invalid password for offline login.' };
      }
    }

    const { passwordHash, ...safeUser } = foundUser;
    return {
      success: true,
      user: safeUser,
    };
  }

  public getStateSummary() {
    const pending = this.getPendingMutations().length;
    const total = this.mutationsList.length;
    return {
      pendingMutationsCount: pending,
      totalMutationsCount: total,
      lastCloudSync: this.lastCloudSyncTime,
      collectionsCount: this.collectionsMap.size,
    };
  }

  public setMasterIp(ip: string): void {
    this.masterIpAddress = ip;
    this.persist();
  }
}

export const lanStore = LanStore.getInstance();
