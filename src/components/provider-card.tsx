'use client';

import { Clock, Home, MapPin } from 'lucide-react';
import { money, nowMs, slotLabel } from '@/lib/format';
import { TYPE_COLOUR, TYPE_LABEL } from '@/components/icons';
import { Avatar, Badge, Card, Rating } from '@/components/ui/primitives';

export interface ProviderHit { id: string; type: string; name: string; specialities: string[]; yearsOfExperience: number | null; feeMinor: number | null; rating: number | null; ratingCount: number; locationName: string | null; locality: string | null; city: string | null; distanceKm: number | null; nextSlotAt: string | null; homeService: boolean; priceMinor: number | null; latitude?: number | null; longitude?: number | null }


/** One search result: works for doctors, facilities, labs and pharmacies. */
/** Links to the profile by default; with `onSelect` it becomes a choice in a booking flow instead of navigating away. */
export function ProviderCard({ p, priceLabel, onSelect, selected }: { p: ProviderHit; priceLabel?: string; onSelect?: () => void; selected?: boolean }) {
  const href = p.type === 'DOCTOR' ? `/doctors/${p.id}` : `/providers/${p.id}`;
  const slot = p.type === 'DOCTOR' && p.nextSlotAt ? slotLabel(p.nextSlotAt, nowMs()) : null;
  const where = [p.locationName, p.locality ?? p.city].filter(Boolean).join(' · ');
  return (
    <Card href={onSelect ? undefined : href} onClick={onSelect} className={`flex gap-3${selected ? ' ring-2 ring-primary' : ''}`}>
      <Avatar name={p.name} size="lg" tone={TYPE_COLOUR[p.type]} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="truncate text-[15px] font-extrabold">{p.name}</p><p className="truncate text-xs text-muted">{p.type === 'DOCTOR' ? `${p.specialities.join(', ') || 'Doctor'}${p.yearsOfExperience != null ? ` · ${p.yearsOfExperience} yrs` : ''}` : TYPE_LABEL[p.type] ?? p.type}</p></div>
          <span className="shrink-0"><Rating value={p.rating} count={p.ratingCount} /></span>
        </div>
        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted"><MapPin size={12} className="shrink-0" aria-hidden />{where || 'Location on request'}{p.distanceKm != null && <span className="tnum font-semibold text-ink"> · {p.distanceKm} km</span>}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {slot ? <Badge tone="success"><Clock size={11} className="mr-1 inline" aria-hidden />{slot}</Badge> : p.type === 'DOCTOR' ? <Badge tone="muted">No open slot</Badge> : null}
          {p.homeService && <Badge tone="violet"><Home size={11} className="mr-1 inline" aria-hidden />{p.type === 'PHARMACY' ? 'Delivers' : 'Home collection'}</Badge>}
          <span className="ml-auto tnum text-sm font-extrabold">{p.priceMinor != null ? <>{priceLabel ? `${priceLabel} ` : ''}{money(p.priceMinor)}</> : p.feeMinor != null ? <>{p.type === 'DOCTOR' && <span className="text-xs font-semibold text-muted">from </span>}{money(p.feeMinor)}</> : ''}</span>
        </div>
      </div>
    </Card>
  );
}
