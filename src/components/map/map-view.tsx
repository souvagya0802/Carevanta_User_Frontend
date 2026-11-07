'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import { MAP_TILES, roundCoord, type GeoPoint } from '@/lib/geo';
import { cx } from '@/components/ui/primitives';

export interface MapMarker { id: string; lat: number; lng: number; title: string; colour?: string }

interface Props {
  /** Places to show as coloured pins. The map zooms to fit them (and `you`). */
  markers?: MapMarker[];
  /** The patient's own position, drawn as a blue dot. */
  you?: GeoPoint | null;
  /** A draggable pin for choosing a spot (pickup point, home). Clicking the map moves it too. */
  pin?: GeoPoint | null;
  onPinMove?: (p: GeoPoint) => void;
  /** Tapping a place pin. */
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  /** Where to open when there is nothing to show yet: India. */
  fallbackCenter?: GeoPoint;
  className?: string;
  label?: string;
}

const INDIA: GeoPoint = { lat: 22.9734, lng: 78.6569 };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pinSvg = (fill: string, big: boolean) => {
  const w = big ? 34 : 28;
  const h = big ? 44 : 36;
  return `<svg width="${w}" height="${h}" viewBox="0 0 28 36" aria-hidden="true" style="filter:drop-shadow(0 3px 4px rgba(11,27,58,.35))"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 23.5 14 36 14 36s14-12.5 14-22.2C28 6.2 21.7 0 14 0z" fill="${fill}"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>`;
};

/**
 * Leaflet map with OpenStreetMap tiles (or NEXT_PUBLIC_MAP_TILE_URL). Leaflet
 * touches `window`, so it is loaded on the client after mount; until then the
 * box shows a soft placeholder of the same size, so nothing jumps.
 */
export function MapView({ markers = [], you, pin, onPinMove, onSelect, selectedId, fallbackCenter = INDIA, className, label = 'Map' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const pinMarker = useRef<Marker | null>(null);
  const handlers = useRef({ onPinMove, onSelect });
  const [ready, setReady] = useState(false);

  useEffect(() => { handlers.current = { onPinMove, onSelect }; });

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const leaflet = (await import('leaflet')).default;
      if (disposed || !host.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(host.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      leaflet.tileLayer(MAP_TILES.url, { maxZoom: MAP_TILES.maxZoom, attribution: MAP_TILES.attribution }).addTo(m);
      m.setView([fallbackCenter.lat, fallbackCenter.lng], 5);
      m.on('click', (e) => handlers.current.onPinMove?.({ lat: roundCoord(e.latlng.lat), lng: roundCoord(e.latlng.lng) }));
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
      // Sheets and cards animate in; lay the tiles out again once the box has its final size.
      setTimeout(() => m.invalidateSize(), 120);
    })();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      pinMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; content is synced below
  }, []);

  // Place pins and the "you" dot, then fit them in view.
  const markerKey = markers.map((m) => `${m.id}:${m.lat},${m.lng}`).join('|');
  useEffect(() => {
    const leaflet = L.current;
    const m = map.current;
    const group = layer.current;
    if (!ready || !leaflet || !m || !group) return;
    group.clearLayers();
    const points: [number, number][] = [];
    for (const mk of markers) {
      const selected = mk.id === selectedId;
      const icon = leaflet.divIcon({ className: '', iconSize: selected ? [34, 44] : [28, 36], iconAnchor: selected ? [17, 44] : [14, 36], html: pinSvg(mk.colour ?? '#1E6CFF', selected) });
      const marker = leaflet.marker([mk.lat, mk.lng], { icon, title: mk.title, keyboard: true, zIndexOffset: selected ? 500 : 0 });
      marker.bindTooltip(esc(mk.title), { direction: 'top', offset: [0, -34] });
      marker.on('click', () => handlers.current.onSelect?.(mk.id));
      group.addLayer(marker);
      points.push([mk.lat, mk.lng]);
    }
    if (you) {
      group.addLayer(leaflet.circleMarker([you.lat, you.lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#1E6CFF', fillOpacity: 1 }).bindTooltip('You'));
      points.push([you.lat, you.lng]);
    }
    if (pin) points.push([pin.lat, pin.lng]);
    if (points.length === 1) m.setView(points[0]!, pin ? 15 : 14);
    else if (points.length > 1) m.fitBounds(leaflet.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markerKey stands for `markers`
  }, [ready, markerKey, selectedId, you?.lat, you?.lng]);

  // The draggable pin.
  useEffect(() => {
    const leaflet = L.current;
    const m = map.current;
    if (!ready || !leaflet || !m) return;
    if (!pin) { pinMarker.current?.remove(); pinMarker.current = null; return; }
    if (!pinMarker.current) {
      const icon = leaflet.divIcon({ className: '', iconSize: [34, 44], iconAnchor: [17, 44], html: pinSvg('#E11D48', true) });
      pinMarker.current = leaflet.marker([pin.lat, pin.lng], { draggable: !!handlers.current.onPinMove, icon, keyboard: true, title: 'Chosen spot', zIndexOffset: 1000 }).addTo(m);
      pinMarker.current.on('dragend', () => { const ll = pinMarker.current!.getLatLng(); handlers.current.onPinMove?.({ lat: roundCoord(ll.lat), lng: roundCoord(ll.lng) }); });
      m.setView([pin.lat, pin.lng], Math.max(m.getZoom(), 15));
    } else {
      pinMarker.current.setLatLng([pin.lat, pin.lng]);
      m.panTo([pin.lat, pin.lng]);
    }
  }, [ready, pin?.lat, pin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps -- pin is compared by value

  return (
    <div className={cx('relative isolate overflow-hidden rounded-[22px] bg-soft', className ?? 'h-56')}>
      <div ref={host} className="h-full w-full" role="application" aria-label={label} />
      {!ready && <div className="shimmer absolute inset-0" aria-hidden />}
    </div>
  );
}
