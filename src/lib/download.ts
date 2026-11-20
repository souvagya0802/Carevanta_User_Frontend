'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { API_BASE, ApiError, authorizedFetch, type ApiErrorBody } from './api';
import { useToast } from '@/components/ui/toast';

/**
 * Authenticated file downloads (invoices, credit notes, statements).
 * The API needs the bearer token, so a bare <a href> cannot be used: the file is fetched with the
 * session, checked to really be a PDF, turned into a temporary object URL, clicked as a hidden
 * anchor with the server's file name, and the URL is revoked again.
 */

/** Accepts `/api/v1/invoices/x/pdf`, `/invoices/x/pdf` or an absolute API URL; returns the path after /api/v1. */
export function apiPath(path: string): string {
  let p = path.startsWith(API_BASE) ? path.slice(API_BASE.length) : path;
  if (/^https?:\/\//.test(p)) p = new URL(p).pathname;
  return p.replace(/^\/api\/v1(?=\/)/, '');
}

/** File name from a Content-Disposition header (`filename*=` wins over `filename=`). */
export function filenameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition)?.[1];
  if (star) {
    try {
      return decodeURIComponent(star.trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through */
    }
  }
  return /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)?.[1]?.trim() || fallback;
}

const FRIENDLY: Record<number, string> = {
  403: 'You do not have access to this document.',
  404: 'This document is not available yet.',
};

/** Fetch a protected PDF. Throws ApiError (HTTP failure) or Error (not a PDF / network). */
export async function fetchPdf(path: string, fallbackName = 'document.pdf'): Promise<{ blob: Blob; filename: string }> {
  const res = await authorizedFetch(apiPath(path), { headers: { accept: 'application/pdf' } });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: ApiErrorBody } | null;
    const body = json?.error ?? { code: 'HTTP_ERROR', message: res.statusText || 'Download failed' };
    throw new ApiError(res.status, { ...body, message: FRIENDLY[res.status] ?? body.message ?? 'Download failed' });
  }
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!type.includes('application/pdf')) throw new Error('The server did not return a PDF. Please try again.');
  return { blob: await res.blob(), filename: filenameFrom(res.headers.get('content-disposition'), fallbackName) };
}

/** Save a blob through a temporary object URL and a hidden anchor click. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    // Revoke after the click has been handed to the browser.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** True on touch devices whose browser can share files (the system share sheet). */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array([37])], 'x.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

let shareCache: boolean | undefined;
const canShareFilesCached = () => (shareCache ??= canShareFiles());
const noopSubscribe = () => () => {};

export interface DownloadOptions {
  /** Used when the server sends no file name. */
  fallbackName?: string;
  /** Open the system share sheet instead of downloading (falls back to a download where unsupported). */
  share?: boolean;
}

/** Download (or share) a protected PDF. Resolves to what happened; throws on failure. */
export async function downloadPdf(path: string, opts: DownloadOptions = {}): Promise<'downloaded' | 'shared' | 'cancelled'> {
  const { blob, filename } = await fetchPdf(path, opts.fallbackName);
  if (opts.share && canShareFiles()) {
    const file = new File([blob], filename, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Share refused for another reason: fall back to a normal download.
    }
  }
  saveBlob(blob, filename);
  return 'downloaded';
}

/**
 * Hook for download buttons: tracks which document is busy and shows the app's toast (top right)
 * on failure. Only an explicit click calls this, so a failure toast never appears on page load.
 */
export function useDownload() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  // Server render and first paint: no Share button; the browser then reports whether it can share files.
  const shareable = useSyncExternalStore(noopSubscribe, canShareFilesCached, () => false);
  const download = useCallback(
    async (path: string, opts: DownloadOptions = {}) => {
      setBusy(path);
      try {
        return await downloadPdf(path, opts);
      } catch (e) {
        toast.error(e, 'Could not download the document');
        return 'failed' as const;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { download, busy, shareable };
}
