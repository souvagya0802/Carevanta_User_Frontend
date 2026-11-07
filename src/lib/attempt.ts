'use client';

import { useState } from 'react';
import { ApiError, newIdempotencyKey } from './api';

/**
 * One Idempotency-Key per checkout attempt.
 *
 * Keys used to be built from the basket or slot, so ordering the same thing
 * again within the API's 24 h retention silently replayed the old order (even
 * a cancelled one). Now a random key is created when an attempt starts and is
 * reused only while that attempt is the same request: a retry after a network
 * error, or a second tap while the first is still in flight. Changing anything
 * in the request (basket, slot, patient, PIN, prescription…) or a successful
 * submit starts a fresh attempt with a new key.
 */
export interface Attempt {
  /** The key for this request signature (same signature → same key until success). */
  keyFor(signature: string): string;
  /**
   * Run one submit. A second call while one is in flight returns the same promise
   * (double taps send one request). A 409 "still being processed" from the API is
   * retried quietly with the same key. On success the next call gets a new key.
   */
  run<T>(signature: string, send: (key: string) => Promise<T>): Promise<T>;
  /** True while a submit is in flight. */
  readonly busy: boolean;
  /** Forget the current key (e.g. the user left the screen). */
  reset(): void;
}

const IN_FLIGHT_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The API answers 409 CONFLICT while a request with the same key is still running. */
export const isStillProcessing = (e: unknown) => e instanceof ApiError && e.status === 409 && e.code === 'CONFLICT';

export function createAttempt(prefix: string, opts: { retryDelayMs?: number } = {}): Attempt {
  let key: string | null = null;
  let sig: string | null = null;
  let pending: Promise<unknown> | null = null;
  const delay = opts.retryDelayMs ?? 1200;
  const keyFor = (signature: string) => {
    if (key === null || sig !== signature) {
      key = newIdempotencyKey(prefix);
      sig = signature;
    }
    return key;
  };
  return {
    keyFor,
    run<T>(signature: string, send: (key: string) => Promise<T>): Promise<T> {
      if (pending) return pending as Promise<T>;
      const k = keyFor(signature);
      const go = async (): Promise<T> => {
        for (let i = 0; ; i++) {
          try {
            const out = await send(k);
            if (key === k) { key = null; sig = null; } // done: the next order is a new attempt
            return out;
          } catch (e) {
            if (isStillProcessing(e) && i < IN_FLIGHT_RETRIES) { await sleep(delay); continue; }
            throw e;
          }
        }
      };
      const p = go().finally(() => { pending = null; });
      pending = p;
      return p;
    },
    get busy() { return pending !== null; },
    reset() { key = null; sig = null; },
  };
}

/** Per-screen attempt holder; stable for the component's lifetime. */
export function useAttempt(prefix: string): Attempt {
  const [attempt] = useState(() => createAttempt(prefix));
  return attempt;
}
