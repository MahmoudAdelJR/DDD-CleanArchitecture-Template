import { BrowserStorageAdapter } from './browser-storage.adapter';
import { StorageChange } from './storage.port';

describe('BrowserStorageAdapter', () => {
  it('forwards cross-tab storage events and stops after unsubscribe', () => {
    const adapter = new BrowserStorageAdapter();
    const changes: StorageChange[] = [];
    const unsubscribe = adapter.subscribe((change) => changes.push(change));

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'app.session.v1', newValue: '{"a":1}' }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'app.session.v1', newValue: null }));

    expect(changes).toEqual([
      { key: 'app.session.v1', value: '{"a":1}' },
      { key: 'app.session.v1', value: null },
    ]);

    unsubscribe();
    window.dispatchEvent(new StorageEvent('storage', { key: 'app.session.v1', newValue: 'x' }));

    expect(changes.length).toBe(2);
  });

  it('reads, writes and removes through the browser backend', () => {
    const adapter = new BrowserStorageAdapter();

    adapter.setItem('spec.key', 'value');
    expect(adapter.getItem('spec.key')).toBe('value');

    adapter.removeItem('spec.key');
    expect(adapter.getItem('spec.key')).toBeNull();
  });
});
