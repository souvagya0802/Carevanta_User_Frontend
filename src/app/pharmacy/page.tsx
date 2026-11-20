'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Pill, Search, Store } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useDebounced, useGet } from '@/lib/hooks';
import { useLocation, geoQuery } from '@/lib/location';
import { medicineLabel, money } from '@/lib/format';
import { AppShell } from '@/components/layout/app-shell';
import { availabilityText, bestPrice, CDCI_ATTRIBUTION, MedicineImage, type MedicineHit } from '@/components/medicine/medicine-ui';
import { CartLineStepper } from '@/components/medicine/qty-stepper';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives';

export default function PharmacyPage() {
  return <Suspense fallback={<AppShell><Skeleton card rows={3} /></AppShell>}><PharmacyInner /></Suspense>;
}

/**
 * Search a medicine → open its detail (information, pharmacies near you, substitutes) → add to the basket there.
 * Availability is counted near the patient's place with the same radius the pharmacy list uses.
 */
function PharmacyInner() {
  const params = useSearchParams();
  const { place } = useLocation();
  const cart = useCart();
  // Smart search links here with ?q=<medicine name> so the patient lands on the right medicine.
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q.trim(), 300);
  const preferred = params.get('provider');
  const meds = useGet<MedicineHit[]>(dq.length >= 2 ? `/public/catalogue/medicines?q=${encodeURIComponent(dq)}&limit=30${geoQuery(place)}` : null);
  const detailHref = (id: string) => `/medicines/${id}${preferred ? `?provider=${encodeURIComponent(preferred)}` : ''}`;

  return (
    <AppShell>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-extrabold tracking-tight">Medicines</h1><p className="mt-0.5 text-sm text-muted">Search by brand or generic name. Prices are the pharmacy&apos;s own; MRP is never exceeded.</p></div>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-white p-1 pl-4 shadow-card"><Search size={18} className="shrink-0 text-muted" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paracetamol, Dolo, metformin…" aria-label="Search medicines" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus /></div>
      {/* Phones get the sticky View Basket bar instead. */}
      {cart.cart && <Link href="/cart" className="mt-3 hidden items-center lg:flex gap-3 rounded-[5px] bg-primary-soft p-3 text-sm"><Store size={18} className="text-primary" aria-hidden /><span className="min-w-0 flex-1"><span className="block truncate font-bold">Basket at {cart.cart.pharmacyName}</span><span className="block text-xs text-muted">{cart.count} item{cart.count === 1 ? '' : 's'} · {money(cart.totalMinor)}</span></span><span className="font-bold text-primary">Checkout</span></Link>}
      <div className="mt-4">
        {dq.length < 2 ? <EmptyState icon={Pill} title="Type a medicine name" description="At least two letters. Try the generic name if the brand is not found." /> : meds.isPending ? <Skeleton card rows={4} /> : meds.isError ? <ErrorState error={meds.error} retry={() => meds.refetch()} /> : !meds.data?.length ? <EmptyState icon={Pill} title="Not in the catalogue yet" description="Ask your pharmacy to list it, or search the generic name." /> : (
          <>
            <div className="stagger grid gap-2 lg:grid-cols-2">
              {meds.data.map((m) => {
                const a = availabilityText(m);
                const price = bestPrice(m);
                const inBasket = cart.cart?.lines.some((l) => l.medicineId === m.id);
                return (
                  <div key={m.id} className="card-3d min-w-0 rounded-[5px]">
                  <Link href={detailHref(m.id)} className="flex min-w-0 items-start gap-3 p-3 text-left">
                    <MedicineImage imageUrl={m.imageUrl} name={m.name} dosageForm={m.dosageForm} representative={m.imageIsRepresentative} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-[15px] font-extrabold">{medicineLabel(m.name, m.strength)}</span>{price != null && <span className="tnum shrink-0 text-sm font-extrabold">from {money(price)}</span>}</span>
                      {m.composition && <span className="block truncate text-xs font-semibold text-ink/80">{m.composition}{m.strength ? ` ${m.strength}` : ''}</span>}
                      <span className="block truncate text-xs text-muted">{[m.dosageForm, m.packSize ? `Pack of ${m.packSize}` : null, m.manufacturer].filter(Boolean).join(' · ')}</span>
                      <span className={a.tone === 'success' ? 'mt-1 block text-xs font-bold text-success' : a.tone === 'warning' ? 'mt-1 block text-xs font-bold text-warning' : 'mt-1 block text-xs font-semibold text-muted'}>{a.text}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">{m.requiresPrescription && <Badge tone="violet">Rx</Badge>}{m.substitutes > 0 && <Badge tone="primary">Substitutes Available</Badge>}</span>
                    </span>
                  </Link>
                  {/* Already in the basket: change the quantity here (outside the link, so the buttons are not inside it). */}
                  {inBasket && <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2"><span className="min-w-0 truncate text-xs font-semibold text-muted">In Your Basket</span><CartLineStepper medicineId={m.id} /></div>}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] leading-snug text-muted">{CDCI_ATTRIBUTION}</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
