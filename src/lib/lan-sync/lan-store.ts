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
  attempts: number;
  error?: string;
}

export interface LanStoreState {
  mutations: SyncMutation[];
  collections: Record<string, Record<string, unknown>>;
  lastCloudSync: number | null;
  masterServerIp: string | null;
}

const DB_DIR = path.join(process.cwd(), '.lan-data');
const DB_FILE = path.join(DB_DIR, 'lan_db.json');

function ensureDbDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function loadState(): LanStoreState {
  ensureDbDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err: unknown) {
      console.error('[LAN Store] Error reading local store file:', err);
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
  ensureDbDir();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: unknown) {
    console.error('[LAN Store] Error writing local store file:', err);
  }
}

export class LanStore {
  private static instance: LanStore;
  private readonly collectionsMap = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly mutationsList: SyncMutation[] = [];
  private lastCloudSyncTime: number | null = null;
  private masterIpAddress: string | null = null;

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

  private persist(): void {
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

  public addMutation(
    collectionName: string,
    docId: string,
    action: 'set' | 'update' | 'delete',
    data?: Record<string, unknown>
  ): SyncMutation {
    const mutation: SyncMutation = {
      id: crypto.randomUUID(),
      collectionName,
      docId,
      action,
      data,
      timestamp: Date.now(),
      syncedToCloud: false,
      attempts: 0,
    };

    let docMap = this.collectionsMap.get(collectionName);
    if (!docMap) {
      docMap = new Map<string, Record<string, unknown>>();
      this.collectionsMap.set(collectionName, docMap);
    }

    if (action === 'delete') {
      docMap.delete(docId);
    } else if (action === 'set') {
      docMap.set(docId, { id: docId, ...(data || {}) });
    } else if (action === 'update') {
      const existingDoc = docMap.get(docId) || { id: docId };
      docMap.set(docId, { ...existingDoc, ...(data || {}) });
    }

    this.mutationsList.push(mutation);
    this.persist();
    return mutation;
  }

  public getPendingMutations(): SyncMutation[] {
    return this.mutationsList.filter((m) => !m.syncedToCloud);
  }

  public markMutationSynced(id: string): void {
    const mutation = this.mutationsList.find((m) => m.id === id);
    if (mutation) {
      mutation.syncedToCloud = true;
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
