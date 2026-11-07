import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatientUiProvider } from '@/lib/patient-ui';
import { LocationProvider } from '@/lib/location';
import { Landing } from './landing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

const ui = {
  hero: { badge: 'Trusted care', title: 'Configured hero title', subtitle: 'Configured subtitle', ctaLabel: 'Find a Doctor', ctaHref: '/search', secondaryLabel: 'Book a Test', secondaryHref: '/tests' },
  heroImageUrl: null,
  highlights: [{ icon: 'shield', title: 'Verified providers', text: 'Every listing is checked.' }],
  categories: [{ key: 'doctors', label: 'Doctors', icon: 'stethoscope', href: '/search?type=doctors', colour: '#1E6CFF', enabled: true }],
  landing: { headline: 'Healthcare for every family in Purba Medinipur', subheadline: 'Doctors, tests, medicines and ambulances in one app.', points: ['Book in minutes'], stats: [{ label: 'Doctors', value: '120+' }], footerNote: 'Made in Bengal' },
  announcement: null,
  support: { phone: '+919000000000' },
  theme: { primary: '#1E6CFF', accent: '#12C2E9' },
  popularSearches: ['Fever'],
  emergencyNumber: '112',
  version: 3,
};
const branding = { name: 'Carevanta', tagline: 'Care near you', logoUrl: null, primaryColour: '#1E6CFF' };

const json = (payload: unknown) => new Response(JSON.stringify({ data: payload }), { status: 200, headers: { 'content-type': 'application/json' } });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const mount = () => render(<QueryClientProvider client={client()}><PatientUiProvider><LocationProvider><Landing /></LocationProvider></PatientUiProvider></QueryClientProvider>);

afterEach(() => vi.restoreAllMocks());

describe('landing page', () => {
  it('renders the super-admin configured copy from /public/patient-ui', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (String(input).includes('/public/patient-ui') ? json(ui) : json(branding)));
    mount();
    await waitFor(() => expect(screen.getByText('Healthcare for every family in Purba Medinipur')).toBeInTheDocument());
    expect(screen.getByText('Verified providers')).toBeInTheDocument();
    expect(screen.getByText('120+')).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#1E6CFF');
  });

  it('still renders with fallback copy when the API is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/112/).length).toBeGreaterThan(0);
  });
});
