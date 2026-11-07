'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useOptionalAuth } from './auth';
import { useToast } from '@/components/ui/toast';

/** Paths that need a signed-in patient. They wait for the session instead of firing a 401. */
const PROTECTED = /^\/(patient|portal)(\/|\?|$)/;
export const isProtectedPath = (path: string) => PROTECTED.test(path);

/**
 * GET helper returning the unwrapped `data`. Pass `null` to disable.
 * Account paths (/patient/…, /portal/…) only run once someone is signed in,
 * so screens behind <RequireSignIn> never fire 401s for signed-out visitors.
 */
export function useGet<T>(path: string | null, opts: { enabled?: boolean; refetchInterval?: number } = {}) {
  const auth = useOptionalAuth();
  const allowed = !!path && (!auth || !isProtectedPath(path) || !!auth.me);
  return useQuery({
    queryKey: ['get', path],
    queryFn: ({ signal }) => api.get<{ data: T }>(path!, signal).then((r) => r.data),
    enabled: allowed && (opts.enabled ?? true),
    refetchInterval: opts.refetchInterval,
  });
}

/**
 * Mutation with toast feedback and query invalidation. `invalidate` entries
 * are path prefixes matched against ['get', path] and ['table', path] keys.
 * Errors are toasted here, once, unless the screen passes its own `onError`:
 * then the screen owns the message (inline next to a field, or its own toast),
 * so one failure never shows up twice.
 */
export function useAction<TVars = void, TData = unknown>(
  fn: (vars: TVars) => Promise<TData>,
  opts: { success?: string; invalidate?: string[]; onSuccess?: (data: TData, vars: TVars) => void; onError?: (err: unknown, vars: TVars) => void } & Omit<UseMutationOptions<TData, unknown, TVars>, 'mutationFn' | 'onSuccess' | 'onError'> = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  const { success, invalidate, onSuccess, onError, ...rest } = opts;
  return useMutation<TData, unknown, TVars>({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      if (success) toast.success(success);
      for (const prefix of invalidate ?? []) {
        void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[1] === 'string' && (q.queryKey[1] as string).startsWith(prefix) });
      }
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      if (onError) onError(err, vars);
      else toast.error(err);
    },
    ...rest,
  });
}

/** Controlled filter state for list pages. */
export function useFilters<T extends Record<string, string>>(initial: T) {
  const [filters, setFilters] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setFilters((f) => ({ ...f, [key]: value })), []);
  const reset = useCallback(() => setFilters(initial), [initial]);
  return { filters, set, reset };
}

/** Debounced copy of a value (search inputs). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
