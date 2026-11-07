import { api } from './api';

/**
 * Maps and place lookups for the patient app.
 *
 * Place search and address lookup go through our API (/public/geo/search and
 * /public/geo/reverse), which picks the geocoder (free OpenStreetMap Nominatim by
 * default, or a keyed provider such as LocationIQ) and keeps any key on the server.
 * Map tiles come from NEXT_PUBLIC_MAP_TILE_URL, OpenStreetMap when it is not set.
 */
export interface GeoPoint { lat: number; lng: number }
export interface GeoAddress { addressLine1: string | null; locality: string | null; city: string | null; district: string | null; state: string | null; pincode: string | null }
export interface GeoPlace { label: string; latitude: number; longitude: number; address: GeoAddress }

export const MAP_TILES = {
  url: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

/** Five decimals is about one metre: plenty for a doorstep, and stable to compare. */
export const roundCoord = (n: number) => Math.round(n * 1e5) / 1e5;

/** Find towns, villages, landmarks or addresses in India, nearest to `near` first. */
export async function searchPlaces(q: string, near?: GeoPoint | null, signal?: AbortSignal): Promise<GeoPlace[]> {
  const term = q.trim();
  if (term.length < 3) return [];
  const bias = near ? `&lat=${near.lat}&lng=${near.lng}` : '';
  const { data } = await api.get<{ data: GeoPlace[] }>(`/public/geo/search?q=${encodeURIComponent(term)}${bias}&limit=6`, signal);
  return data;
}

/** The address at a point, or null when nothing is known there. Never throws. */
export async function reversePlace(p: GeoPoint): Promise<GeoPlace | null> {
  try {
    const { data } = await api.get<{ data: GeoPlace | null }>(`/public/geo/reverse?lat=${roundCoord(p.lat)}&lng=${roundCoord(p.lng)}`);
    return data;
  } catch {
    return null;
  }
}

/** A short everyday name for a place: "Moyna, Purba Medinipur". */
export function shortPlaceName(a: Partial<GeoAddress> | null | undefined, fallback = 'Near you'): string {
  if (!a) return fallback;
  const where = a.locality || a.city;
  const parts = [where, a.district && a.district !== where ? a.district : undefined].filter(Boolean);
  return parts.length ? parts.join(', ') : fallback;
}

/** Opens turn-by-turn directions in the phone's maps app (Google Maps; no key needed). */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Straight-line distance in km, for showing "2.4 km away" without a server round trip. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
