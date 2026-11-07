'use client';

import { useSyncExternalStore } from 'react';

/**
 * A JSON value kept in localStorage and read through useSyncExternalStore.
 *
 * Reading localStorage in a useState initialiser makes the first client render
 * differ from the server HTML (hydration error). With an external store the
 * server snapshot is always `null`, React hydrates with that, then re-renders
 * with the stored value: no mismatch and no setState-in-effect. Other tabs'
 * changes arrive through the `storage` event. Private mode falls back to memory.
 */
export interface Stored<T> {
  get(): T | null;
  set(value: T | null): void;
  subscribe(listener: () => void): () => void;
}

export function stored<T>(key: string): Stored<T> {
  const listeners = new Set<() => void>();
  let memory: string | null = null;
  let useMemory = false;
  let lastRaw: string | null | undefined;
  let lastValue: T | null = null;
  const readRaw = (): string | null => {
    if (useMemory) return memory;
    try {
      return localStorage.getItem(key);
    } catch {
      return memory;
    }
  };
  return {
    get() {
      const raw = readRaw();
      // Same string → same object, so React sees a stable snapshot.
      if (raw !== lastRaw) {
        lastRaw = raw;
        try {
          lastValue = raw ? (JSON.parse(raw) as T) : null;
        } catch {
          lastValue = null;
        }
      }
      return lastValue;
    },
    set(value) {
      const raw = value == null ? null : JSON.stringify(value);
      memory = raw;
      try {
        if (raw == null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
        useMemory = false;
      } catch {
        useMemory = true; // private mode or quota: keep it for this tab
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => { if (e.key === key || e.key === null) listener(); };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}

const serverSnapshot = () => null;

/** The stored value; `null` on the server and during hydration. */
export function useStored<T>(store: Stored<T>): T | null {
  return useSyncExternalStore(store.subscribe, store.get, serverSnapshot);
}
