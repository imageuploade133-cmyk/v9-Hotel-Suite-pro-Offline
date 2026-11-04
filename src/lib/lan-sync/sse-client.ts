'use client';

import { isLocalMasterHost } from './is-local-master-host';

export interface LanSseEvent {
  type: 'mutation' | 'sync' | 'stock_deduct' | 'connected';
  collectionName?: string;
  docId?: string;
  action?: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
  timestamp?: number;
}

type SseListener = (event: LanSseEvent) => void;
type StatusListener = (status: 'connected' | 'connecting' | 'disconnected') => void;

class LanSseClient {
  private static instance: LanSseClient;
  private eventSource: EventSource | null = null;
  private readonly listeners = new Set<SseListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private status: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isStarted = false;

  public static getInstance(): LanSseClient {
    if (!LanSseClient.instance) {
      LanSseClient.instance = new LanSseClient();
    }
    return LanSseClient.instance;
  }

  public start(): void {
    if (typeof window === 'undefined' || this.isStarted) return;
    if (!isLocalMasterHost()) return;

    this.isStarted = true;
    this.connect();
  }

  private setStatus(status: 'connected' | 'connecting' | 'disconnected') {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) {
        console.error('[SSE Client] Status listener error:', e);
      }
    }
  }

  public getStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.status;
  }

  private connect(): void {
    if (typeof window === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setStatus('connecting');

    try {
      this.eventSource = new EventSource('/api/lan-sync/events');

      this.eventSource.onopen = () => {
        this.setStatus('connected');
      };

      this.eventSource.onmessage = (e) => {
        try {
          const parsed: LanSseEvent = JSON.parse(e.data);
          this.dispatch(parsed);
        } catch (err) {
          console.warn('[SSE Client] Error parsing event message:', err);
        }
      };

      this.eventSource.onerror = () => {
        this.setStatus('disconnected');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Schedule retry
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          if (this.isStarted) {
            this.connect();
          }
        }, 3000);
      };
    } catch (e) {
      this.setStatus('disconnected');
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => this.connect(), 4000);
    }
  }

  private dispatch(event: LanSseEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[SSE Client] Dispatch listener error:', err);
      }
    }
  }

  public subscribe(listener: SseListener): () => void {
    this.listeners.add(listener);
    if (!this.isStarted) {
      this.start();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }
}

export const lanSseClient = LanSseClient.getInstance();
