import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationProvider } from '@/lib/location';
import { ToastProvider } from '@/components/ui/toast';
import { SmartSearch } from './smart-search';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

const feverAnswer = {
  query: 'bukhar',
  understood: { label: 'Fever', kind: 'condition', corrected: false, from: 'bukhar' },
  emergency: null,
  conditions: [{ id: 'c1', name: 'Fever', kind: 'SYMPTOM', isRedFlag: false, matchedTerm: 'bukhar', corrected: false, approved: true }],
  specialities: [{ code: 'GENERAL_MEDICINE', name: 'General Medicine', doctors: 3, via: 'symptom', because: 'Fever', relevance: 'PRIMARY' }],
  awaitingReview: [],
  doctors: [{ id: 'd1', name: 'Dr. Anjali Maity', specialities: ['General Medicine'], feeMinor: 50000, rating: 4.8, city: 'Tamluk', distanceKm: null, matchedByName: false }],
  places: [],
  tests: [],
  medicines: [],
  disclaimer: 'Suggestions help you find the right kind of care.',
};
const snakeAnswer = { ...feverAnswer, query: 'snake bite', understood: { label: 'Snake bite', kind: 'condition', corrected: false, from: 'snake bite' }, emergency: { message: 'Emergency', number: '112' }, specialities: [], doctors: [] };

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><LocationProvider><SmartSearch /></LocationProvider></ToastProvider></QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const body = url.includes('snake') ? snakeAnswer : feverAnswer;
    return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('smart search box', () => {
  it('shows popular searches before typing', async () => {
    mount();
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fever' })).toBeInTheDocument();
  });

  it('explains a local word and offers the right specialists and doctors', async () => {
    mount();
    await userEvent.type(screen.getByRole('combobox'), 'bukhar');
    await waitFor(() => expect(screen.getByText(/Showing results for/)).toBeInTheDocument());
    expect(screen.getByText('Fever')).toBeInTheDocument();
    expect(screen.getByText('General Medicine')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Dr. Anjali Maity'));
    expect(push).toHaveBeenCalledWith('/doctors/d1');
    // The search is remembered for next time.
    expect(JSON.parse(localStorage.getItem('carevanta.recentSearches') ?? '[]')).toContain('Dr. Anjali Maity');
  });

  it('puts the emergency number first for red-flag words', async () => {
    mount();
    await userEvent.type(screen.getByRole('combobox'), 'snake bite');
    const call = await screen.findByText(/Call 112 now/);
    expect(call.closest('a')).toHaveAttribute('href', 'tel:112');
  });

  it('Enter opens the full results page', async () => {
    mount();
    await userEvent.type(screen.getByRole('combobox'), 'pet dard{Enter}');
    expect(push).toHaveBeenCalledWith('/search?q=pet%20dard');
  });
});
