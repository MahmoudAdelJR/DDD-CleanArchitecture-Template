import { InjectionToken } from '@angular/core';

/** A change made to a storage key by another browsing context. */
export interface StorageChange {
  key: string;
  /** The new value, or `null` when the key was removed. */
  value: string | null;
}

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /**
   * Subscribes to changes made by *other* contexts (tabs/windows), never the
   * caller's own writes — mirroring the browser `storage` event. Optional:
   * adapters without cross-context support omit it, and callers must treat a
   * missing `subscribe` as "no cross-tab sync". Returns an unsubscribe fn.
   */
  subscribe?(handler: (change: StorageChange) => void): () => void;
}

export const STORAGE = new InjectionToken<StoragePort>('core.Storage');
