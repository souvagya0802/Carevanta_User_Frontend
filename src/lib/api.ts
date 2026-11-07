/**
 * Typed client for the Carevanta API.
 *  - Access token kept in memory; refresh token in localStorage (no cookies →
 *    no CSRF surface; the API enforces CORS and all authorisation server-side).
 *  - A 401 triggers one single-flight refresh and a retry. Only a 401/403 from
 *    the refresh endpoint clears the session and notifies listeners; a 429,
 *    5xx or network failure keeps it, so a slow or busy API never signs anyone out.
 *  - Errors are normalised to ApiError with the API's error code and details.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
  }
  get code() {
    return this.body.code;
  }
  /** Structured error details from the API (e.g. `{ updatedAt }` on a CONFLICT). */
  get details(): unknown {
    return this.body.details;
  }
  /** Field-level issues from VALIDATION_FAILED responses, keyed by path without the "body." prefix. */
  get fieldErrors(): Record<string, string> {
    const issues = (this.body.details as { issues?: { path: string; message: string }[] } | undefined)?.issues ?? [];
    const out: Record<string, string> = {};
    for (const i of issues) out[i.path.replace(/^(body|query|params)\./, '')] ??= i.message;
    return out;
  }
}

export interface Page<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
}

const REFRESH_KEY = 'carevanta.refreshToken';
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
const listeners = new Set<(signedIn: boolean) => void>();

export const session = {
  get accessToken() {
    return accessToken;
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken;
    try {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l(true));
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(false));
  },
  hasRefreshToken() {
    try {
      return !!localStorage.getItem(REFRESH_KEY);
    } catch {
      return false;
    }
  },
  subscribe(fn: (signedIn: boolean) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/**
 * Swap the refresh token for a new pair. Refresh tokens are single-use, so
 * when the app is open in two tabs (or the installed app and a browser tab)
 * only one may refresh at a time: the browser lock makes the second tab wait,
 * then it reads the token the first tab just stored instead of re-using the
 * old one. The API also tolerates a just-replaced token for a few seconds.
 */
async function refresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const run = async (): Promise<boolean> => {
    let token: string | null = null;
    try {
      token = localStorage.getItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) {
        // Only a definite "this token is no longer valid" ends the session. A rate limit (429),
        // a server error or a proxy hiccup keeps it: the next request simply tries again.
        if (res.status !== 401 && res.status !== 403) return false;
        // Only sign out if no other tab replaced the token while we were asking.
        let current: string | null = null;
        try {
          current = localStorage.getItem(REFRESH_KEY);
        } catch {
          /* ignore */
        }
        if (current === token) session.clear();
        return current !== token && !!current ? run() : false;
      }
      const { data } = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
      session.set(data);
      return true;
    } catch {
      return false;
    }
  };
  const locks = typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : undefined;
  // A lock callback's promise is awaited by the browser, so the request resolves to the boolean itself.
  refreshInFlight = (locks ? (locks.request('carevanta-token-refresh', run) as unknown as Promise<boolean>) : run()).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Raw body (file upload) with its content type. */
  raw?: { data: Blob | ArrayBuffer; contentType: string };
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Skip auth header and refresh logic (login, public endpoints). */
  anonymous?: boolean;
  _retried?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (!opts.anonymous) {
    if (!accessToken && session.hasRefreshToken()) await refresh();
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  }
  let body: BodyInit | undefined;
  if (opts.raw) {
    headers['content-type'] = opts.raw.contentType;
    body = opts.raw.data;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (opts.idempotencyKey) headers['idempotency-key'] = safeIdempotencyKey(opts.idempotencyKey);

  const res = await fetch(`${API_BASE}/api/v1${path}`, { method: opts.method ?? 'GET', headers, body, signal: opts.signal });

  if (res.status === 401 && !opts.anonymous && !opts._retried && (await refresh())) {
    return request<T>(path, { ...opts, _retried: true });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = (json as { error?: ApiErrorBody } | null)?.error ?? { code: 'HTTP_ERROR', message: res.statusText || 'Request failed' };
    if (res.status === 401 && !opts.anonymous) {
      // The refresh call already cleared the session if the refresh token was rejected.
      // If a refresh token is still stored, the refresh failed for a passing reason (network,
      // 429, 5xx): drop only the stale access token and keep the user signed in.
      if (opts._retried || !session.hasRefreshToken()) session.clear();
      else accessToken = null;
    }
    throw new ApiError(res.status, err);
  }
  return json as T;
}

/** Reads anyone may make; see api.get. */
export const isPublicPath = (path: string) => /^\/(public|discovery)\//.test(path);

export const api = {
  /**
   * Public reads (/public/…, /discovery/…) go without the Authorization header: they never wait
   * for a session refresh, and as "simple" CORS requests they skip the preflight round trip.
   */
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal, anonymous: isPublicPath(path) }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) => request<T>(path, { method: 'POST', body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, data: Blob, contentType: string) => request<T>(path, { method: 'POST', raw: { data, contentType } }),
  /** Download a protected file as a Blob (reports, documents, exports). */
  async blob(path: string): Promise<{ blob: Blob; filename: string }> {
    if (!accessToken && session.hasRefreshToken()) await refresh();
    const res = await fetch(`${API_BASE}/api/v1${path}`, { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: ApiErrorBody } | null;
      throw new ApiError(res.status, json?.error ?? { code: 'HTTP_ERROR', message: res.statusText });
    }
    const cd = res.headers.get('content-disposition') ?? '';
    const filename = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? 'download';
    return { blob: await res.blob(), filename };
  },
};

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** What the API accepts in `Idempotency-Key` (see backend `IdempotencyKey` schema). */
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.]{8,80}$/;

/**
 * Make any descriptive key acceptable to the API without losing its idempotency.
 * Screens build keys from the fields that make a request unique (profile, provider, slot, lines…),
 * which easily exceeds 80 characters or contains spaces; those are folded into a stable 64-bit
 * FNV-1a digest, so the same inputs still produce the same key on retry.
 */
export function safeIdempotencyKey(key: string): string {
  if (IDEMPOTENCY_KEY_RE.test(key)) return key;
  let h1 = 0x811c9dc5, h2 = 0x01000193; // two 32-bit FNV-1a lanes with different seeds
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193 + 2 * (i & 1)) >>> 0;
  }
  const prefix = key.split(/[^A-Za-z0-9_]/, 1)[0]?.slice(0, 16) || 'ui';
  return `${prefix}-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function newIdempotencyKey(prefix = 'ui'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${rnd}`;
}
