'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Pill, Search, ShoppingBag, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useDebounced, useGet } from '@/lib/hooks';
import { useLocation, geoQuery } from '@/lib/location';
import { medicineLabel, money } from '@/lib/format';
import { AppShell } from '@/components/layout/app-shell';
import type { ProviderProfile } from '@/app/providers/[id]/page';
import type { ProviderHit } from '@/components/provider-card';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Sheet, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Medicine { id: string; name: string; genericName: string | null; strength: string | null; dosageForm: string | null; packSize: string | null; manufacturer: string | null; requiresPrescription: boolean; schedule: string; pharmacies: number; fromMinor: number | null }

export default function PharmacyPage() {
  return <Suspense fallback={<AppShell><Skeleton card rows={3} /></AppShell>}><PharmacyInner /></Suspense>;
}

/** Search a medicine → pick a pharmacy that has it in stock → add to the basket. Prescription medicines are flagged up front. */
function PharmacyInner() {
  const params = useSearchParams();
  const toast = useToast();
  const { place } = useLocation();
  const cart = useCart();
  // Smart search links here with ?q=<medicine name> so the patient lands on the right medicine.
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q.trim(), 300);
  const preferred = params.get('provider');
  const meds = useGet<Medicine[]>(dq.length >= 2 ? `/public/catalogue/medicines?q=${encodeURIComponent(dq)}&limit=30` : null);
  const [picking, setPicking] = useState<Medicine | null>(null);
  const shops = useGet<{ items: ProviderHit[] }>(picking ? `/discovery/providers?medicineId=${picking.id}&limit=20${geoQuery(place)}` : null);
  const [adding, setAdding] = useState<string | null>(null);

  const add = async (shop: ProviderHit) => {
    if (!picking) return;
    setAdding(shop.id);
    try {
      const { data: profile } = await api.get<{ data: ProviderProfile }>(`/discovery/providers/${shop.id}`);
      const locationId = profile.locations[0]?.id;
      if (!locationId) throw new Error('This pharmacy has no store location');
      const result = cart.add({ id: shop.id, name: shop.name, locationId }, { medicineId: picking.id, name: picking.name, strength: picking.strength, packSize: picking.packSize, requiresPrescription: picking.requiresPrescription, unitPriceMinor: shop.priceMinor ?? picking.fromMinor ?? 0 });
      toast.success(result === 'replaced' ? `Started a new basket at ${shop.name}` : `${medicineLabel(picking.name, picking.strength)} added to your basket`, picking.requiresPrescription ? 'You will attach a prescription at checkout' : undefined);
      setPicking(null);
    } catch (e) { toast.error(e); } finally { setAdding(null); }
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-extrabold tracking-tight">Medicines</h1><p className="mt-0.5 text-sm text-muted">Search by brand or generic name. Prices are the pharmacy&apos;s own; MRP is never exceeded.</p></div>
        <Link href="/cart" aria-label="Basket" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-card"><ShoppingBag size={20} />{cart.count > 0 && <span className="tnum absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{cart.count}</span>}</Link>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-card"><Search size={18} className="shrink-0 text-muted" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paracetamol, Dolo, metformin…" aria-label="Search medicines" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus /></div>
      {cart.cart && <Link href="/cart" className="mt-3 flex items-center gap-3 rounded-3xl bg-primary-soft p-3 text-sm"><Store size={18} className="text-primary" aria-hidden /><span className="flex-1"><span className="font-bold">Basket at {cart.cart.pharmacyName}</span><span className="block text-xs text-muted">{cart.count} item{cart.count === 1 ? '' : 's'} · {money(cart.totalMinor)}</span></span><span className="font-bold text-primary">Checkout</span></Link>}
      <div className="mt-4">
        {dq.length < 2 ? <EmptyState icon={Pill} title="Type a medicine name" description="At least two letters. Try the generic name if the brand is not found." /> : meds.isPending ? <Skeleton card rows={4} /> : meds.isError ? <ErrorState error={meds.error} retry={() => meds.refetch()} /> : !meds.data?.length ? <EmptyState icon={Pill} title="Not in the catalogue yet" description="Ask your pharmacy to list it, or search the generic name." /> : (
          <div className="stagger grid gap-2 lg:grid-cols-2">
            {meds.data.map((m) => (
              <Card key={m.id} onClick={() => setPicking(m)} className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning"><Pill size={22} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold">{medicineLabel(m.name, m.strength)}</span>
                  <span className="block truncate text-xs text-muted">{[m.genericName, m.dosageForm, m.packSize ? `pack of ${m.packSize}` : null, m.manufacturer].filter(Boolean).join(' · ')}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">{m.requiresPrescription && <Badge tone="violet">Prescription needed</Badge>}<Badge tone={m.pharmacies ? 'success' : 'muted'}>{m.pharmacies ? `In stock at ${m.pharmacies}` : 'Out of stock nearby'}</Badge></span>
                </span>
                <span className="tnum text-sm font-extrabold">{m.fromMinor != null ? `from ${money(m.fromMinor)}` : ''}</span>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!picking} onClose={() => setPicking(null)} title={picking ? medicineLabel(picking.name, picking.strength) : ''} description="Choose a pharmacy. One basket goes to one pharmacy.">
        {shops.isPending ? <Skeleton card rows={2} /> : !shops.data?.items.length ? <EmptyState icon={Store} title="No pharmacy has it in stock" description="Try again later or search a substitute by generic name." /> : (
          <div className="grid gap-2">
            {[...shops.data.items].sort((a, b) => (a.id === preferred ? -1 : b.id === preferred ? 1 : 0)).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <Avatar name={s.name} tone="#F59E0B" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{s.name}</span><span className="block truncate text-xs text-muted">{[s.locality ?? s.city, s.distanceKm != null ? `${s.distanceKm} km` : null, s.homeService ? 'delivers' : 'pickup'].filter(Boolean).join(' · ')}</span></span>
                <span className="tnum text-sm font-extrabold">{money(s.priceMinor)}</span>
                <Button size="sm" onClick={() => void add(s)} loading={adding === s.id}>Add</Button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </AppShell>
  );
}
