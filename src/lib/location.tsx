'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { stored, useStored } from './stored';
import { reversePlace, roundCoord, shortPlaceName } from './geo';

/**
 * Where the patient is. Asked for lazily (only when a screen needs distance),
 * remembered per browser, and always overridable with a typed town or PIN so
 * the app works with location permission refused. The saved place is read
 * after hydration (external store), so the server HTML always matches.
 */
/** `approximate`: the point is only the district or state centre (PIN lookup), so searches go wider. */
export interface Place { lat: number; lng: number; label: string; source: 'gps' | 'manual'; approximate?: boolean }
interface LocationState { place: Place | null; asking: boolean; error: string | null; locate: () => Promise<Place | null>; setManual: (p: Place) => void; clear: () => void }

const store = stored<Place>('carevanta.place');
const Ctx = createContext<LocationState | null>(null);
const remember = (p: Place | null) => store.set(p);

export function LocationProvider({ children }: { children: ReactNode }) {
  const place = useStored(store);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(async (): Promise<Place | null> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) { setError('Location is not available on this device'); return null; }
    setAsking(true); setError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Save the point at once, then name it ("Moyna, Purba Medinipur") when the address lookup answers.
          const p: Place = { lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude), label: 'Near you', source: 'gps' };
          remember(p);
          setAsking(false);
          resolve(p);
          void reversePlace(p).then((found) => { if (found && store.get()?.lat === p.lat && store.get()?.lng === p.lng) remember({ ...p, label: shortPlaceName(found.address) }); });
        },
        (err) => { setAsking(false); setError(err.code === 1 ? 'Location permission was refused. Type your town or PIN instead.' : 'Could not get your location right now.'); resolve(null); },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 2 * 60_000 },
      );
    });
  }, []);

  const value = useMemo<LocationState>(() => ({ place, asking, error, locate, setManual: (p) => remember({ ...p, source: 'manual' }), clear: () => remember(null) }), [place, asking, error, locate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
}

/** Query-string fragment for the discovery endpoints. */
export const geoQuery = (place: Place | null, radiusKm?: number) => (place ? `&lat=${place.lat}&lng=${place.lng}${radiusKm ? `&radiusKm=${radiusKm}` : ''}` : '');
