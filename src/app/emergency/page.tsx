'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Ambulance, ChevronRight, MapPin, Phone, ShieldAlert, Siren } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAttempt } from '@/lib/attempt';
import { useAction, useGet } from '@/lib/hooks';
import { useLocation } from '@/lib/location';
import { usePatientUi } from '@/lib/patient-ui';
import { relative } from '@/lib/format';
import { reversePlace, type GeoAddress, type GeoPoint } from '@/lib/geo';
import { PlaceSearch } from '@/components/map/place-search';
import { AppShell } from '@/components/layout/app-shell';
import { Button, Card, Field, Input, StatusBadge, Textarea } from '@/components/ui/primitives';

interface Past { id: string; reference: string; status: string; pickupDistrict: string | null; createdAt: string; closedAt: string | null }
interface Opened { requestId: string; reference: string; message: string; callNow: string; ambulanceConfirmed: boolean; operatorsNotified: number }
const PHONE = /^[6-9]\d{9}$/;

// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-52 rounded-[22px]" /> });
const addressLine = (a: GeoAddress) => [a.addressLine1, a.locality, a.city].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(', ');

/**
 * Emergency screen. The public number always comes first and works signed out;
 * the in-app request is a second channel that alerts nearby ambulance operators.
 */
export default function EmergencyPage() {
  const ui = usePatientUi();
  const { me, loading } = useAuth();
  const router = useRouter();
  const { place, locate } = useLocation();
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState(me?.phone?.replace(/^\+91/, '') ?? '');
  const [locating, setLocating] = useState(false);
  // The pickup point: starts at the saved location and moves with GPS, search or a drag on the map.
  const [pickup, setPickup] = useState<GeoPoint | null>(place ? { lat: place.lat, lng: place.lng } : null);
  const [looking, setLooking] = useState(false);
  const number = ui.emergencyNumber || '112';
  const past = useGet<Past[]>(me ? '/patient/emergency?limit=5' : null);
  // One key per request attempt: a double tap or a retry on a bad connection never opens two SOS requests.
  const attempt = useAttempt('sos');
  const open = useAction(async () => {
    const body = { latitude: pickup?.lat, longitude: pickup?.lng, address: address.trim() || undefined, district: district.trim() || undefined, callbackPhone: PHONE.test(phone) ? `+91${phone}` : undefined };
    const { data } = await attempt.run(JSON.stringify(body), (key) => api.post<{ data: Opened }>('/patient/emergency', body, key));
    return data;
  }, { onSuccess: (d) => router.push(`/emergency/${d.requestId}`) });
  const canSend = !!pickup || district.trim().length >= 2 || address.trim().length >= 5;
  /** Move the pickup pin and fill the address and district from the map (the patient can still edit them). */
  async function movePickup(p: GeoPoint, known?: GeoAddress) {
    setPickup(p);
    setLooking(true);
    const a = known ?? (await reversePlace(p))?.address;
    setLooking(false);
    if (a) { setAddress(addressLine(a)); if (a.district) setDistrict(a.district); }
  }
  const shareGps = async () => { setLocating(true); try { const p = await locate(); if (p) await movePickup(p); } finally { setLocating(false); } };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-danger to-rose-500 p-6 text-white shadow-glow">
          <span className="orb absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15" aria-hidden />
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide opacity-90"><Siren size={16} /> Emergency</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">If someone is in danger, call {number} now.</h1>
          <p className="mt-2 text-sm text-white/90">The national emergency line connects you to ambulance, police and fire. Use it first. The button below is an extra channel that alerts ambulance operators on Carevanta near you.</p>
          <a href={`tel:${number}`} className="pulse-ring mt-5 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-lg font-extrabold text-danger shadow-lg"><Phone size={20} /> Call {number}</a>
        </section>

        <Card className="relative">
          <p className="flex items-center gap-2 text-base font-extrabold"><Ambulance size={18} className="text-danger" /> Also request an ambulance through Carevanta</p>
          <p className="mt-1 text-sm text-muted">Nearby verified operators get an alert with your location. You will see who accepts and their estimated arrival. This does not replace calling {number}.</p>
          {loading ? null : !me ? (
            <div className="mt-4 rounded-2xl bg-soft p-3 text-sm"><p>Sign in so the operator can reach you and you can follow the ambulance.</p><div className="mt-2 flex gap-2"><Link href="/login?next=/emergency"><Button size="sm">Sign In</Button></Link><Link href="/signup?next=/emergency"><Button size="sm" variant="secondary">Create Account</Button></Link></div></div>
          ) : (
            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-soft p-3 text-sm">
                <MapPin size={16} className="text-primary" />
                <span className="flex-1 font-semibold">{pickup ? (looking ? 'Finding the address…' : 'Pickup point set on the map') : 'Location not shared yet'}</span>
                <Button size="sm" variant="secondary" onClick={() => void shareGps()} loading={locating}>{pickup ? 'Use GPS again' : 'Share GPS location'}</Button>
              </div>
              <PlaceSearch near={pickup} onPick={(p) => void movePickup({ lat: p.latitude, lng: p.longitude }, p.address)} placeholder="Or search the pickup place or landmark" />
              {pickup && <MapView pin={pickup} onPinMove={(p) => void movePickup(p)} className="h-52" label="Pickup point. Tap or drag the pin to the exact spot." />}
              {pickup && <p className="-mt-1 text-xs text-muted">Drag the red pin to the exact gate or door, so the driver finds you.</p>}
              <Field label="Pickup address or landmark" hint="Street, village, landmark. Helps the driver when GPS is off."><Textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} placeholder="Near Moyna bus stand, opposite the school" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="District"><Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Your district" maxLength={80} /></Field>
                <Field label="Callback number" hint="10-digit mobile the operator can call"><Input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98300 00000" aria-invalid={phone.length > 0 && !PHONE.test(phone)} /></Field>
              </div>
              <Button variant="danger" size="lg" full onClick={() => { if (!attempt.busy) open.mutate(); }} loading={open.isPending} disabled={!canSend}><ShieldAlert size={18} /> Request an ambulance</Button>
              {!canSend && <p className="text-xs text-muted">Share your GPS location or type the district or address first.</p>}
            </div>
          )}
        </Card>

        {me && (past.data?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-base font-extrabold">Your recent requests</h2>
            <div className="stagger grid gap-2">{past.data!.map((r) => <Card key={r.id} href={`/emergency/${r.id}`} className="flex items-center gap-3"><Siren size={18} className="text-danger" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{r.reference}</span><span className="block text-xs text-muted">{r.pickupDistrict ?? ''} · {relative(r.createdAt)}</span></span><StatusBadge status={r.status} /><ChevronRight size={16} className="text-muted" /></Card>)}</div>
          </section>
        )}
        <p className="text-xs text-muted">Carevanta is a marketplace, not an emergency service. Ambulance operators are independent and confirm each request themselves. Fares are agreed with the operator.</p>
      </div>
    </AppShell>
  );
}
