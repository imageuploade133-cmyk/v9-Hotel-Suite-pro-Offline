/**
 * Firestore Cache System
 *
 * A robust caching layer for Firestore that:
 * - Caches query results with configurable TTL
 * - Persists cache to localStorage for offline support
 * - Deduplicates concurrent requests
 * - Provides cache invalidation strategies
 * - Works with real-time subscriptions for live updates
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastCleanup: number;
}

const CACHE_VERSION = '1.0.0';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // Maximum number of entries
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

class FirestoreCacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, lastCleanup: Date.now() };
  private storageKey = 'firestore-cache';
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    // Guard against server-side execution
    if (typeof window === 'undefined') {
      return;
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load cache from localStorage asynchronously to avoid blocking page load
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => this.loadFromStorage(), { timeout: 2000 });
    } else {
      setTimeout(() => this.loadFromStorage(), 100);
    }

    // Schedule periodic cleanup - less frequent to reduce overhead
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL);

    // Listen for storage changes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey) {
        this.loadFromStorage();
      }
    });

    // Save cache before page unload
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
    });
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === CACHE_VERSION && Array.isArray(parsed.entries)) {
          this.cache = new Map(parsed.entries);
          this.stats.size = this.cache.size;

          // Clean up expired entries on load
          this.cleanup();
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
      this.cache = new Map();
    }
  }

  private saveToStorage() {
    try {
      const entries = Array.from(this.cache.entries());
      const data = {
        version: CACHE_VERSION,
        entries,
        stats: this.stats,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      // If storage is full, clear old entries and try again
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearOldestEntries(Math.floor(this.cache.size / 2));
        try {
          const entries = Array.from(this.cache.entries());
          localStorage.setItem(this.storageKey, JSON.stringify({
            version: CACHE_VERSION,
            entries,
          }));
        } catch {
          console.warn('Failed to save cache to storage even after cleanup');
        }
      }
    }
  }

  private clearOldestEntries(count: number) {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private cleanup() {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));

    // If cache is still too large, remove oldest entries
    if (this.cache.size > MAX_CACHE_SIZE) {
      this.clearOldestEntries(this.cache.size - MAX_CACHE_SIZE);
    }

    this.stats.size = this.cache.size;
    this.stats.lastCleanup = now;
    this.saveToStorage();
  }

  /**
   * Generate a cache key from a Firestore query or path
   */
  generateKey(path: string, ...modifiers: string[]): string {
    const baseKey = path.replace(/\//g, ':');
    if (modifiers.length === 0) return baseKey;
    return `${baseKey}:${modifiers.join(':')}`;
  }

  /**
   * Generate a key for collection queries with filters
   */
  generateQueryKey(collection: string, filters?: Record<string, any>): string {
    const filterStr = filters
      ? Object.entries(filters)
          .filter(([_, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join('&')
      : '';
    return filterStr ? `${collection}?${filterStr}` : collection;
  }

  /**
   * Get data from cache if valid
   */
  get<T>(key: string): T | null {
    // Only initialize and access cache in browser environment
    if (typeof window === 'undefined') {
      return null;
    }

    this.initialize();

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    // Only access cache in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    this.initialize();

    // Check if we need to make room
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(key)) {
      this.clearOldestEntries(1);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version: CACHE_VERSION,
    });

    this.stats.size = this.cache.size;

    // Debounce saving to storage
    this.debouncedSave();
  }

  private saveTimeout: NodeJS.Timeout | null = null;

  private debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeout = null;
    }, 1000);
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    // Only access cache in browser environment
    if (typeof window === 'undefined') {
      return false;
    }

    const result = this.cache.delete(key);
    if (result) {
      this.stats.size = this.cache.size;
      this.debouncedSave();
    }
    return result;
  }

  /**
   * Clear all cache entries matching a pattern
   */
  deletePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    });

    if (count > 0) {
      this.stats.size = this.cache.size;
      this.debouncedSave();
    }

    return count;
  }

  /**
   * Clear all cache entries for a collection
   */
  invalidateCollection(collection: string): number {
    return this.deletePattern(`^${collection.replace(/\//g, ':')}`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    // Only access cache in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    this.cache.clear();
    this.stats.size = 0;
    this.saveToStorage();
  }

  /**
   * Get or set data with a fetcher function (deduplication)
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check for pending request (deduplication)
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Create new request
    const request = fetcher()
      .then(data => {
        this.set(key, data, ttl);
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Prefetch data and store in cache
   */
  async prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL
  ): Promise<void> {
    const data = await fetcher();
    this.set(key, data, ttl);
  }

  /**
   * Update a single document in cached collections
   */
  updateDocumentInCache(collection: string, docId: string, updates: Partial<any>): void {
    // Only access cache in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    this.cache.forEach((entry, key) => {
      if (key.startsWith(collection)) {
        if (Array.isArray(entry.data)) {
          // Collection cache - update or add document
          const index = entry.data.findIndex((doc: any) => doc.id === docId);
          if (index !== -1) {
            entry.data[index] = { ...entry.data[index], ...updates };
          }
        } else if (entry.data?.id === docId) {
          // Single document cache
          entry.data = { ...entry.data, ...updates };
        }
      }
    });
    this.debouncedSave();
  }

  /**
   * Remove a document from cached collections
   */
  removeDocumentFromCache(collection: string, docId: string): void {
    // Only access cache in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    this.cache.forEach((entry, key) => {
      if (key.startsWith(collection)) {
        if (Array.isArray(entry.data)) {
          entry.data = entry.data.filter((doc: any) => doc.id !== docId);
        } else if (entry.data?.id === docId) {
          this.cache.delete(key);
        }
      }
    });
    this.debouncedSave();
  }
}

// Singleton instance
export const firestoreCache = new FirestoreCacheManager();

// TTL presets for different data types
export const CacheTTL = {
  SHORT: 30 * 1000,      // 30 seconds - for frequently changing data
  MEDIUM: 5 * 60 * 1000, // 5 minutes - default
  LONG: 30 * 60 * 1000,  // 30 minutes - for semi-static data
  HOUR: 60 * 60 * 1000,  // 1 hour - for rarely changing data
  DAY: 24 * 60 * 60 * 1000, // 1 day - for static configuration
} as const;

// Utility function to create cache keys for common patterns
export const CacheKeys = {
  collection: (name: string) => `coll:${name}`,
  document: (collection: string, id: string) => `doc:${collection}:${id}`,
  query: (collection: string, filters: string) => `query:${collection}:${filters}`,
  user: (uid: string) => `user:${uid}`,
  settings: () => 'settings:global',
  page: (pathname: string) => `page:${pathname}`,
};
