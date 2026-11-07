'use client';

import { useQuery } from '@tanstack/react-query';
import { API_BASE, request } from './api';
import { cx } from '@/components/ui/primitives';

export interface Branding {
  name: string;
  tagline: string;
  logoUrl: string | null;
  logoMimeType: string | null;
}

const DEFAULT: Branding = { name: 'Carevanta', tagline: 'Trusted care, connected.', logoUrl: null, logoMimeType: null };

/** Public branding (name, tagline, logo). Cached for 5 minutes; falls back to defaults offline. */
export function useBranding() {
  const q = useQuery({
    queryKey: ['branding'],
    queryFn: ({ signal }) => request<{ data: Branding }>('/public/branding', { anonymous: true, signal }).then((r) => r.data),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return { branding: q.data ?? DEFAULT, isLoading: q.isPending };
}

/** Absolute URL of the configured logo, or the bundled default. */
export function logoSrc(b: Branding): string {
  return b.logoUrl ? `${API_BASE}${b.logoUrl}` : '/logo.png';
}

/**
 * Logo box. Whatever image is uploaded is fitted inside a fixed-height box
 * with object-fit: contain, so any size or aspect ratio displays correctly.
 */
export function Logo({ size = 'md', onDark = false, className }: { size?: 'sm' | 'nav' | 'md' | 'lg'; onDark?: boolean; className?: string }) {
  const { branding } = useBranding();
  // nav = phone top bars, where the logo is the main brand mark.
  const h = size === 'sm' ? 'h-11' : size === 'nav' ? 'h-14' : size === 'lg' ? 'h-28' : 'h-16';
  return (
    <div className={cx('flex items-center justify-center overflow-hidden rounded-md', onDark ? 'bg-paper p-1' : '', h, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote, operator-uploaded image of unknown dimensions */}
      <img src={logoSrc(branding)} alt={`${branding.name} logo`} className="h-full w-auto max-w-full object-contain" />
    </div>
  );
}
