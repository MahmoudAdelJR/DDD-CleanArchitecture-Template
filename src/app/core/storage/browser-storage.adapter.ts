import { Injectable } from '@angular/core';
import { StorageChange, StoragePort } from './storage.port';

/**
 * localStorage with an in-memory fallback for non-browser contexts (SSR, tests).
 */
@Injectable()
export class BrowserStorageAdapter implements StoragePort {
  private readonly memoryFallback = new Map<string, string>();
  private readonly backend: Storage | null = this.resolveBackend();

  getItem(key: string): string | null {
    return this.backend?.getItem(key) ?? this.memoryFallback.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.backend) {
      this.backend.setItem(key, value);
    } else {
      this.memoryFallback.set(key, value);
    }
  }

  removeItem(key: string): void {
    if (this.backend) {
      this.backend.removeItem(key);
    } else {
      this.memoryFallback.delete(key);
    }
  }

  subscribe(handler: (change: StorageChange) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const listener = (event: StorageEvent): void => {
      // Ignore events from a different storage area (e.g. sessionStorage).
      if (event.storageArea && event.storageArea !== this.backend) {
        return;
      }
      handler({ key: event.key ?? '', value: event.newValue });
    };

    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  private resolveBackend(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }
}
