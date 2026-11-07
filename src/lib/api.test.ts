import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, safeIdempotencyKey, session } from './api';

const ACCEPTED = /^[A-Za-z0-9_\-:.]{8,80}$/;

describe('safeIdempotencyKey', () => {
  it('passes a valid key through unchanged', () => {
    expect(safeIdempotencyKey('pay-01a1b4f9-06df-73e1-a3b5-d1bd9532954b')).toBe('pay-01a1b4f9-06df-73e1-a3b5-d1bd9532954b');
  });

  it('folds an over-long descriptive key into an accepted, stable digest', () => {
    const long = `dx-${'0'.repeat(36)}-${'1'.repeat(36)}-${'2'.repeat(36)}-2026-11-13T17:26`;
    const key = safeIdempotencyKey(long);
    expect(key).toMatch(ACCEPTED);
    expect(key.startsWith('dx-')).toBe(true);
    expect(safeIdempotencyKey(long)).toBe(key); // same request → same key on retry
    expect(safeIdempotencyKey(long.replace('17:26', '17:27'))).not.toBe(key); // different request → different key
  });

  it('handles spaces, unicode and short keys', () => {
    for (const raw of ['rx a b c', 'sos-₹', 'ab', '']) expect(safeIdempotencyKey(raw)).toMatch(ACCEPTED);
  });
});

describe('session robustness', () => {
  afterEach(() => vi.restoreAllMocks());
  const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it.each([429, 500, 503])('keeps the session when the refresh endpoint answers %i', async (status) => {
    localStorage.setItem('carevanta.refreshToken', 'r'.repeat(40));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (String(input).includes('/auth/refresh') ? reply(status) : reply(401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in' } })));
    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(session.hasRefreshToken()).toBe(true);
  });

  it('keeps the session when the network fails during refresh', async () => {
    localStorage.setItem('carevanta.refreshToken', 'r'.repeat(40));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => { if (String(input).includes('/auth/refresh')) throw new TypeError('Failed to fetch'); return reply(401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }); });
    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    expect(session.hasRefreshToken()).toBe(true);
  });

  it.each([401, 403])('clears the session when the refresh token is rejected (%i)', async (status) => {
    localStorage.setItem('carevanta.refreshToken', 'r'.repeat(40));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (String(input).includes('/auth/refresh') ? reply(status) : reply(401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in' } })));
    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(session.hasRefreshToken()).toBe(false);
  });
});
