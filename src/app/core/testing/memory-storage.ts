import { StoragePort } from '../storage/storage.port';

/** Deterministic in-memory StoragePort for specs and demos. */
export class MemoryStorage implements StoragePort {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  snapshot(): ReadonlyMap<string, string> {
    return this.entries;
  }
}
