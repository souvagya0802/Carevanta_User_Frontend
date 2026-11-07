'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Search } from 'lucide-react';
import { searchPlaces, type GeoPlace, type GeoPoint } from '@/lib/geo';
import { ApiError } from '@/lib/api';
import { Input, cx } from '@/components/ui/primitives';

/**
 * Type a town, village, landmark or address and pick from the suggestions.
 * Waits until typing pauses (one lookup per pause, never per key) so the free
 * geocoder's fair-use limits are respected.
 */
export function PlaceSearch({ near, onPick, placeholder = 'Search town, village, area or landmark', autoFocus, className }: { near?: GeoPoint | null; onPick: (p: GeoPlace) => void; placeholder?: string; autoFocus?: boolean; className?: string }) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 450);
    return () => clearTimeout(t);
  }, [text]);
  const q = useQuery({
    queryKey: ['geo-search', term, near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''],
    queryFn: ({ signal }) => searchPlaces(term, near, signal),
    enabled: term.length >= 3,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const typing = text.trim() !== term;
  const results = term.length >= 3 && !typing ? q.data ?? [] : [];
  const unavailable = q.error instanceof ApiError && q.error.status === 503;

  return (
    <div className={cx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
      <Input aria-label={placeholder} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} className="pl-10" autoFocus={autoFocus} autoComplete="off" />
      {(q.isFetching || (typing && text.trim().length >= 3)) && <Loader2 size={16} className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-muted" aria-label="Searching" />}
      {results.length > 0 && (
        <ul role="listbox" className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-card">
          {results.map((p, i) => (
            <li key={`${p.latitude},${p.longitude},${i}`}>
              <button type="button" role="option" aria-selected={false} onClick={() => { onPick(p); setText(''); setTerm(''); }} className="flex min-h-11 w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-soft">
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0"><span className="block truncate font-semibold">{p.address.locality || p.address.city || p.label.split(',')[0]}</span><span className="block truncate text-xs text-muted">{p.label}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term.length >= 3 && !typing && q.isSuccess && results.length === 0 && <p className="mt-2 text-xs text-muted">No place found for “{term}”. Try a nearby town, landmark or PIN code.</p>}
      {q.isError && !typing && <p className="mt-2 text-xs text-danger">{unavailable ? 'Place search is busy right now. Use your current location or PIN code instead.' : 'Could not search places right now.'}</p>}
    </div>
  );
}
