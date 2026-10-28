import fs from 'fs';
import path from 'path';

export interface SyncMutation {
  id: string;
  collectionName: string;
  docId: string;
  action: 'set' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  syncedToCloud: boolean;
  attempts: number;
  error?: string;
}

export interface LanStoreState {
  mutations: SyncMutation[];
  collections: Record<string, Record<string, any>>;
  lastCloudSync: number | null;
  masterServerIp: string | null;
}

const DB_DIR = path.join(process.cwd(), '.lan-data');
const DB_FILE = path.join(DB_DIR, 'lan_db.json');

function ensureDbDir() {
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
    } catch (err) {
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

function saveState(state: LanStoreState) {
  ensureDbDir();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[LAN Store] Error writing local store file:', err);
  }
}

export class LanStore {
  private static instance: LanStore;
  private state: LanStoreState;

  private constructor() {
    this.state = loadState();
  }

  public static getInstance(): LanStore {
    if (!LanStore.instance) {
      LanStore.instance = new LanStore();
    }
    return LanStore.instance;
  }

  public addMutation(collectionName: string, docId: string, action: 'set' | 'update' | 'delete', data?: any): SyncMutation {
    const mutation: SyncMutation = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      collectionName,
      docId,
      action,
      data,
      timestamp: Date.now(),
      syncedToCloud: false,
      attempts: 0,
    };

    // Update local document copy for instant LAN response
    if (!this.state.collections[collectionName]) {
      this.state.collections[collectionName] = {};
    }

    if (action === 'delete') {
      delete this.state.collections[collectionName][docId];
    } else if (action === 'set') {
      this.state.collections[collectionName][docId] = { id: docId, ...data };
    } else if (action === 'update') {
      this.state.collections[collectionName][docId] = {
        ...(this.state.collections[collectionName][docId] || { id: docId }),
        ...data,
      };
    }

    this.state.mutations.push(mutation);
    saveState(this.state);
    return mutation;
  }

  public getPendingMutations(): SyncMutation[] {
    return this.state.mutations.filter((m) => !m.syncedToCloud);
  }

  public markMutationSynced(id: string) {
    const mutation = this.state.mutations.find((m) => m.id === id);
    if (mutation) {
      mutation.syncedToCloud = true;
      this.state.lastCloudSync = Date.now();
      saveState(this.state);
    }
  }

  public markMutationFailed(id: string, errorMsg: string) {
    const mutation = this.state.mutations.find((m) => m.id === id);
    if (mutation) {
      mutation.attempts += 1;
      mutation.error = errorMsg;
      saveState(this.state);
    }
  }

  public getCollection(collectionName: string): Record<string, any> {
    return this.state.collections[collectionName] || {};
  }

  public getStateSummary() {
    const pending = this.getPendingMutations().length;
    const total = this.state.mutations.length;
    return {
      pendingMutationsCount: pending,
      totalMutationsCount: total,
      lastCloudSync: this.state.lastCloudSync,
      collectionsCount: Object.keys(this.state.collections).length,
    };
  }

  public setMasterIp(ip: string) {
    this.state.masterServerIp = ip;
    saveState(this.state);
  }
}

export const lanStore = LanStore.getInstance();
