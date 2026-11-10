'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { useLocation, type Place } from '@/lib/location';
import { reversePlace, shortPlaceName, type GeoPoint } from '@/lib/geo';
import { Button, Input, Sheet, cx } from '@/components/ui/primitives';
import { PlaceSearch } from './place-search';

// Leaflet needs the browser; load the map only when the sheet opens.
const MapView = dynamic(() => import('./map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-48 rounded-[22px]" /> });

interface PinResult { pincode: string; district: string; state: string; latitude: number | null; longitude: number | null; accuracy?: 'providers' | 'locality' | 'district' | 'state' | null }
type Draft = Omit<Place, 'source'> & { source: Place['source'] };

/**
 * The location chip in the header and its "Where are you?" sheet. Four ways in,
 * all ending on a map the patient can check and adjust: current GPS position,
 * a typed town/village/landmark, a PIN code, or a tap or drag on the map.
 */
export function LocationPill({ compact }: { compact?: boolean }) {
  const { place } = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx('flex h-11 min-w-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold shadow-card', compact && 'max-w-[7.5rem] min-[400px]:max-w-36')}>
        <MapPin size={16} className="shrink-0 text-primary" aria-hidden /><span className="truncate">{place?.label ?? 'Set Location'}</span>
      </button>
      {/* Mounted only while open, so each opening starts from the saved place. */}
      {open && <LocationSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function LocationSheet({ onClose }: { onClose: () => void }) {
  const { place, locate, asking, setManual, error } = useLocation();
  const [draft, setDraft] = useState<Draft | null>(place);
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const [pin, setPin] = useState('');
  const validPin = /^[1-9][0-9]{5}$/.test(pin);
  const pinLookup = useGet<PinResult | null>(validPin ? `/public/geo/pincode/${pin}` : null);
  const hit = pinLookup.data;

  /** Move the draft to a point and name it from the address there. */
  async function moveTo(p: GeoPoint, source: Place['source'], approximate = false) {
    setDraft({ ...p, label: draft?.label ?? 'Chosen spot', source, approximate });
    setNaming(true);
    const found = await reversePlace(p);
    setNaming(false);
    setDraft((d) => (d && d.lat === p.lat && d.lng === p.lng ? { ...d, label: shortPlaceName(found?.address, 'Chosen spot') } : d));
  }

  async function fromGps() {
    const p = await locate();
    if (p) await moveTo(p, 'gps');
  }

  function fromPin() {
    if (!hit || hit.latitude == null || hit.longitude == null) return;
    const approximate = hit.accuracy === 'district' || hit.accuracy === 'state';
    setDraft({ lat: hit.latitude, lng: hit.longitude, label: approximate ? `${hit.district} (approx.)` : hit.district, source: 'manual', approximate });
    setPin('');
  }

  function save() {
    if (!draft) return;
    const label = name.trim() || draft.label;
    setManual({ ...draft, label });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="Where Are You?" description="Used to show distance and what is near you. Never shared with providers until you book." footer={<Button full onClick={save} disabled={!draft || naming}>{draft ? `Use ${name.trim() || draft.label}` : 'Choose a place first'}</Button>}>
      <div className="space-y-3">
        <Button full variant="soft" onClick={() => void fromGps()} loading={asking}><Crosshair size={16} /> Use My Current Location</Button>
        {error && <p className="text-xs text-danger">{error}</p>}

        <PlaceSearch near={draft} onPick={(p) => setDraft({ lat: p.latitude, lng: p.longitude, label: shortPlaceName(p.address, p.label.split(',')[0]), source: 'manual' })} />

        <div className="flex gap-2">
          <Input aria-label="PIN code" inputMode="numeric" maxLength={6} placeholder="Or PIN code, e.g. 721636" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          <Button variant="secondary" onClick={fromPin} disabled={hit?.latitude == null} loading={validPin && pinLookup.isFetching}>Go</Button>
        </div>
        {validPin && hit && <p className="text-xs text-muted">{hit.district}, {hit.state}{hit.latitude == null ? ' · this PIN cannot be placed on the map yet. Search the town name instead.' : hit.accuracy === 'district' || hit.accuracy === 'state' ? ' · approximate area. Drag the pin to your exact spot.' : ''}</p>}
        {validPin && pinLookup.isSuccess && !hit && <p className="text-xs text-danger">We could not find PIN {pin}. Check the number.</p>}

        {draft ? (
          <div className="space-y-2">
            <MapView pin={draft} onPinMove={(p) => void moveTo(p, 'manual')} className="h-48" label="Your location. Tap or drag the pin to adjust." />
            <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin size={13} className="text-danger" aria-hidden /><span className="min-w-0 flex-1 truncate"><span className="font-bold text-ink">{naming ? 'Finding the place name…' : draft.label}</span> · tap the map or drag the pin to adjust</span></p>
            <Input aria-label="Name for this place" placeholder="Call it something (optional, e.g. Home)" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
        ) : (
          <p className="rounded-2xl bg-soft p-3 text-xs text-muted">Choose one of the options above. You will see the spot on a map before saving.</p>
        )}
      </div>
    </Sheet>
  );
}
