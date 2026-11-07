import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceKm, roundCoord, shortPlaceName } from './geo';

describe('geo helpers', () => {
  it('names a place by locality or town, then district, without repeating', () => {
    expect(shortPlaceName({ locality: null, city: 'Mayna', district: 'Purba Medinipur' })).toBe('Mayna, Purba Medinipur');
    expect(shortPlaceName({ locality: 'Padumbasan', city: 'Tamluk', district: 'Purba Medinipur' })).toBe('Padumbasan, Purba Medinipur');
    expect(shortPlaceName({ city: 'Tamluk', district: 'Tamluk' })).toBe('Tamluk');
    expect(shortPlaceName({ district: 'Purba Medinipur' })).toBe('Purba Medinipur');
  });

  it('falls back when the address is unknown', () => {
    expect(shortPlaceName(null)).toBe('Near you');
    expect(shortPlaceName({}, 'Chosen spot')).toBe('Chosen spot');
  });

  it('measures straight-line distance in km (Moyna to Tamluk is about 15 km)', () => {
    const d = distanceKm({ lat: 22.2716, lng: 87.7752 }, { lat: 22.3, lng: 87.918 });
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(16);
    expect(distanceKm({ lat: 22.27, lng: 87.77 }, { lat: 22.27, lng: 87.77 })).toBe(0);
  });

  it('rounds coordinates to about a metre and builds a directions link', () => {
    expect(roundCoord(22.2716349)).toBe(22.27163);
    expect(directionsUrl(22.3, 87.918)).toBe('https://www.google.com/maps/dir/?api=1&destination=22.3,87.918');
  });
});
