import { StorageChange, StoragePort } from '../storage/storage.port';

/** Deterministic in-memory StoragePort for specs and demos. */
export class MemoryStorage implements StoragePort {
  private readonly entries = new Map<string, string>();
  private readonly listeners = new Set<(change: StorageChange) => void>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  subscribe(handler: (change: StorageChange) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /**
   * Simulates a change applied by another tab/window. Own writes never notify
   * subscribers, matching the browser `storage` event semantics.
   */
  emitExternalChange(key: string, value: string | null): void {
    for (const listener of [...this.listeners]) {
      listener({ key, value });
    }
  }

  snapshot(): ReadonlyMap<string, string> {
    return this.entries;
  }
}
