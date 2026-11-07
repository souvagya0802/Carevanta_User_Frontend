'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from './api';

/**
 * Content and theme of the app, set by the platform's super-admin
 * (Settings → Patient App). Loaded once, cached, and applied as CSS variables
 * so every component picks up the brand colours without knowing about them.
 */
export type IconKey = 'stethoscope' | 'flask' | 'pill' | 'ambulance' | 'hospital' | 'heart' | 'shield' | 'clock' | 'map' | 'star' | 'phone' | 'file' | 'home' | 'baby' | 'eye' | 'tooth' | 'bone' | 'brain';
export interface PatientUi {
  hero: { badge: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string; secondaryLabel: string; secondaryHref: string };
  heroImageUrl: string | null;
  highlights: { icon: IconKey; title: string; text: string }[];
  categories: { key: string; label: string; icon: IconKey; href: string; colour?: string; enabled?: boolean }[];
  landing: { headline: string; subheadline: string; points: string[]; stats: { label: string; value: string }[]; footerNote: string };
  announcement: { text: string; tone: 'info' | 'warning' | 'success'; until?: string; link?: string } | null;
  support: { phone?: string; whatsapp?: string; email?: string; hours?: string };
  theme: { primary: string; accent: string };
  /** Quick chips under the search box, editable in Super Admin → Settings → Patient App. */
  popularSearches: string[];
  emergencyNumber: string;
}

export const FALLBACK_UI: PatientUi = {
  hero: { badge: 'Trusted care near you', title: 'Find the right doctor, test or medicine in minutes', subtitle: 'Verified doctors, labs, pharmacies and ambulances near you. Book, pay and keep every report in one place.', ctaLabel: 'Find a Doctor', ctaHref: '/search?type=doctors', secondaryLabel: 'Book a Lab Test', secondaryHref: '/tests' },
  heroImageUrl: null,
  highlights: [],
  categories: [
    { key: 'doctors', label: 'Doctors', icon: 'stethoscope', href: '/search?type=doctors', colour: '#1E6CFF' },
    { key: 'labs', label: 'Lab Tests', icon: 'flask', href: '/tests', colour: '#7C3AED' },
    { key: 'pharmacy', label: 'Medicines', icon: 'pill', href: '/pharmacy', colour: '#F59E0B' },
    { key: 'ambulance', label: 'Ambulance', icon: 'ambulance', href: '/emergency', colour: '#E11D48' },
  ],
  landing: { headline: 'Healthcare for your family, all in one app', subheadline: 'Carevanta connects you with verified doctors, hospitals, labs, pharmacies and ambulances around you.', points: [], stats: [], footerNote: 'In an emergency, call 112 first.' },
  announcement: null,
  support: {},
  theme: { primary: '#1E6CFF', accent: '#12C2E9' },
  popularSearches: ['Fever', 'Stomach pain', 'Child doctor', 'Sugar test', 'Skin doctor', 'Back pain'],
  emergencyNumber: '112',
};

const Ctx = createContext<PatientUi>(FALLBACK_UI);

/** Mixes a hex colour towards white (0..1) or black (negative), for soft and dark variants. */
function mix(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const to = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  const c = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function PatientUiProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ['public', '/public/patient-ui'], queryFn: ({ signal }) => request<{ data: PatientUi }>('/public/patient-ui', { anonymous: true, signal }).then((r) => r.data), staleTime: 5 * 60_000, retry: 1 });
  const ui = q.data ?? FALLBACK_UI;
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--brand-primary', ui.theme.primary);
    root.setProperty('--brand-primary-dark', mix(ui.theme.primary, -0.22));
    root.setProperty('--brand-primary-soft', mix(ui.theme.primary, 0.88));
    root.setProperty('--brand-accent', ui.theme.accent);
    root.setProperty('--brand-accent-soft', mix(ui.theme.accent, 0.86));
  }, [ui.theme.primary, ui.theme.accent]);
  return <Ctx.Provider value={ui}>{children}</Ctx.Provider>;
}

export const usePatientUi = () => useContext(Ctx);
