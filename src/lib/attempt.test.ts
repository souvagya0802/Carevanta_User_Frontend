import { describe, expect, it, vi } from 'vitest';
import { createAttempt } from './attempt';
import { ApiError } from './api';

const KEY = /^[A-Za-z0-9_\-:.]{8,80}$/;

describe('idempotency key per checkout attempt', () => {
  it('reuses the key for retries of the same request', () => {
    const a = createAttempt('rx');
    const k = a.keyFor('basket-1');
    expect(k).toMatch(KEY);
    expect(k.startsWith('rx-')).toBe(true);
    expect(a.keyFor('basket-1')).toBe(k);
  });

  it('starts a new key when the basket or slot changes', () => {
    const a = createAttempt('rx');
    const k = a.keyFor('basket-1');
    expect(a.keyFor('basket-2')).not.toBe(k);
  });

  it('starts a new key after a successful order, even for an identical basket', async () => {
    const a = createAttempt('rx');
    const sent: string[] = [];
    await a.run('same-basket', async (key) => { sent.push(key); return 'ok'; });
    await a.run('same-basket', async (key) => { sent.push(key); return 'ok'; });
    expect(sent).toHaveLength(2);
    expect(sent[0]).not.toBe(sent[1]);
  });

  it('keeps the key after a failure so a retry is the same attempt', async () => {
    const a = createAttempt('dx');
    const sent: string[] = [];
    await expect(a.run('sig', async (key) => { sent.push(key); throw new Error('offline'); })).rejects.toThrow('offline');
    await a.run('sig', async (key) => { sent.push(key); return 1; });
    expect(sent[0]).toBe(sent[1]);
  });

  it('sends one request for a double tap and reports busy meanwhile', async () => {
    const a = createAttempt('book');
    let release!: (v: string) => void;
    const send = vi.fn((_key: string) => new Promise<string>((r) => { release = r; }));
    const first = a.run('slot-1', send);
    const second = a.run('slot-1', send);
    expect(a.busy).toBe(true);
    release('booked');
    await expect(first).resolves.toBe('booked');
    await expect(second).resolves.toBe('booked');
    expect(send).toHaveBeenCalledTimes(1);
    expect(a.busy).toBe(false);
  });

  it('quietly retries with the same key while the API says it is still processing', async () => {
    const a = createAttempt('book', { retryDelayMs: 1 });
    const keys: string[] = [];
    const send = vi.fn(async (key: string) => {
      keys.push(key);
      if (keys.length === 1) throw new ApiError(409, { code: 'CONFLICT', message: 'A request with this Idempotency-Key is still being processed' });
      return 'booked';
    });
    await expect(a.run('slot-1', send)).resolves.toBe('booked');
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('does not retry a real conflict such as a taken slot', async () => {
    const a = createAttempt('book', { retryDelayMs: 1 });
    const send = vi.fn(async () => { throw new ApiError(409, { code: 'SLOT_UNAVAILABLE', message: 'This slot is no longer available' }); });
    await expect(a.run('slot-1', send)).rejects.toThrow('no longer available');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
