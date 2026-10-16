import { Injectable } from '@angular/core';
import { StoragePort } from './storage.port';

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

  private resolveBackend(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }
}
