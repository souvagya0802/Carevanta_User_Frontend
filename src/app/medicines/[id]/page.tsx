'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, ChevronDown, FileText, Info, Store } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { geoQuery, useLocation } from '@/lib/location';
import { medicineLabel, money } from '@/lib/format';
import { AppShell } from '@/components/layout/app-shell';
import { LocationPill } from '@/components/map/location-pill';
import type { ProviderHit } from '@/components/provider-card';
import { availabilityText, bestPrice, CDCI_ATTRIBUTION, infoSections, ingredientChips, MedicineImage, PhotoCredit, savingsText, type MedicineDetail } from '@/components/medicine/medicine-ui';
import { BasketLink } from '@/components/medicine/basket-link';
import { AddToBasketControl, CartLineStepper } from '@/components/medicine/qty-stepper';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives';

const TONE_TEXT = { success: 'text-success', warning: 'text-warning', muted: 'text-muted' } as const;
const surface = 'card-3d min-w-0 rounded-[5px] p-4';

export default function MedicinePage() {
  return <Suspense fallback={<AppShell hideTop><Skeleton card rows={4} /></AppShell>}><MedicineInner /></Suspense>;
}

/**
 * One medicine, the way large Indian pharmacy apps present it: photo, name and composition, prescription status,
 * price and where it is available near the patient, pharmacies to order from, information sections, substitutes
 * (same salt, same strength; information only, never switched automatically) and other strengths.
 */
function MedicineInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const preferred = params.get('provider');
  const router = useRouter();
  const { place } = useLocation();
  const geo = geoQuery(place);
  const q = useGet<MedicineDetail>(`/public/catalogue/medicines/${id}${geo ? `?${geo.slice(1)}` : ''}`);
  const shops = useGet<{ items: (ProviderHit & { beyondRadius?: boolean })[]; radiusKm: number | null; beyondRadius?: boolean }>(q.data ? `/discovery/providers?medicineId=${id}&limit=20${geo}` : null);
  const d = q.data;

  const header = (
    <div className="mb-4 flex items-center gap-3">
      <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button>
      <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold">Medicine Details</h1>
      <BasketLink />
    </div>
  );

  if (q.isPending) return <AppShell hideTop><div className="mx-auto max-w-3xl">{header}<Skeleton card rows={5} /></div></AppShell>;
  if (q.isError || !d) return <AppShell hideTop><div className="mx-auto max-w-3xl">{header}<ErrorState error={q.error} retry={() => q.refetch()} /></div></AppShell>;

  const a = availabilityText(d.availability);
  const price = bestPrice(d.availability);
  const sections = infoSections(d);
  const items = shops.data ? [...shops.data.items].sort((x, y) => (x.id === preferred ? -1 : y.id === preferred ? 1 : 0)) : [];
  const label = medicineLabel(d.name, d.strength);

  return (
    <AppShell hideTop>
      <div className="mx-auto max-w-3xl space-y-4">
        {header}

        {/* Summary */}
        <section className={surface} aria-labelledby="med-name">
          <MedicineImage imageUrl={d.imageUrl} name={d.name} dosageForm={d.dosageForm} size="lg" className="bg-soft" representative={!!d.imageUrl && d.imageIsRepresentative} />
          {d.imageUrl && <PhotoCredit credit={d.imageCredit} licence={d.imageLicence} sourceUrl={d.imageSourceUrl} representative={d.imageIsRepresentative} />}
          <div className="mb-4" />
          <div className="flex flex-wrap items-center gap-1.5">{d.requiresPrescription && <Badge tone="violet">Rx</Badge>}{d.therapeuticClass && <Badge tone="primary">{d.therapeuticClass}</Badge>}</div>
          <h2 id="med-name" className="mt-2 text-2xl leading-tight font-extrabold tracking-tight break-words">{label}</h2>
          <p className="mt-1 text-sm text-muted">{[d.dosageForm, d.packSize ? `Pack of ${d.packSize}` : null, d.route].filter(Boolean).join(' · ')}</p>
          {d.manufacturer && <p className="mt-0.5 text-sm"><span className="text-muted">By </span><span className="font-semibold">{d.manufacturer}</span></p>}
          {d.composition && (
            <div className="mt-3">
              <p className="text-xs font-bold text-muted">Composition</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{ingredientChips(d.composition).map((c) => <span key={c} className="rounded-[5px] border border-line bg-soft px-2.5 py-1 text-xs font-semibold">{c}</span>)}{d.strength && <span className="rounded-[5px] border border-line bg-soft px-2.5 py-1 text-xs font-semibold">{d.strength}</span>}</div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-line pt-3">
            <div className="min-w-0">
              <p className={`text-sm font-bold ${TONE_TEXT[a.tone]}`}>{a.text}</p>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted"><span className="shrink-0">Near</span><LocationPill /></div>
            </div>
            {price != null && <p className="tnum text-lg font-extrabold">from {money(price)}</p>}
          </div>
        </section>

        {d.requiresPrescription && (
          <div role="note" className="flex items-start gap-3 rounded-[5px] border border-violet/30 bg-violet-soft p-3 text-sm">
            <FileText size={18} className="mt-0.5 shrink-0 text-violet" aria-hidden />
            <p><span className="font-bold">Prescription Required.</span> Attach a valid prescription at checkout; a registered pharmacist checks it before the order is accepted.</p>
          </div>
        )}

        {/* Pharmacies */}
        <section className={surface} aria-labelledby="med-shops">
          <h2 id="med-shops" className="text-lg font-extrabold">Pharmacies Near You</h2>
          {shops.data?.beyondRadius && <p className="mt-1 text-sm text-warning">None within {shops.data.radiusKm ?? 15} km. These are the nearest pharmacies that have it.</p>}
          <div className="mt-3">
            {shops.isPending ? <Skeleton rows={2} /> : shops.isError ? <ErrorState error={shops.error} retry={() => shops.refetch()} /> : !items.length ? <EmptyState icon={Store} title="No pharmacy has it in stock" description={d.substitutesTotal ? 'See the substitutes below, and ask your doctor or pharmacist.' : 'Try again later.'} /> : (
              <ul className="grid grid-cols-1 gap-2">
                {items.map((s) => (
                  <li key={s.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-[5px] border border-line p-3 sm:flex-nowrap">
                    <Avatar name={s.name} tone="#F59E0B" />
                    <span className="min-w-0 flex-1 basis-[calc(100%-60px)] sm:basis-auto"><Link href={`/providers/${s.id}`} className="block truncate text-sm font-extrabold">{s.name}</Link><span className="block truncate text-xs text-muted">{[s.locality ?? s.city, s.distanceKm != null ? `${s.distanceKm} km` : null, s.homeService ? 'Delivers' : 'Pickup'].filter(Boolean).join(' · ')}</span></span>
                    <span className="ml-auto flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <span className="tnum text-sm font-extrabold">{money(s.priceMinor)}</span>
                      <AddToBasketControl shop={s} medicine={{ ...d, fromMinor: d.availability.fromMinor }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Information */}
        <section className={surface} aria-labelledby="med-info">
          <h2 id="med-info" className="text-lg font-extrabold">About This Medicine</h2>
          {sections.length ? (
            <div className="mt-2 divide-y divide-line">
              {sections.map((s, i) => (
                <details key={s.key} open={i === 0} className="group py-1">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold [&::-webkit-details-marker]:hidden">{s.title}<ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden /></summary>
                  <p className="pb-3 text-sm leading-relaxed whitespace-pre-line text-ink/85">{s.text}</p>
                </details>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-muted">Detailed information is not available for this medicine yet.</p>}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden /><span>{d.infoSourceLine ? `${d.infoSourceLine}. ` : ''}{d.disclaimer}</span></p>
        </section>

        {/* Substitutes */}
        {d.substitutes.length > 0 && (
          <section className={surface} aria-labelledby="med-subs">
            <h2 id="med-subs" className="text-lg font-extrabold">Substitutes (Same Salt, Same Strength)</h2>
            <p className="mt-1 text-sm text-muted">{d.substituteNote}{d.substitutesTotal > d.substitutes.length ? ` Showing ${d.substitutes.length} of ${d.substitutesTotal}.` : ''}</p>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {d.substitutes.map((s) => {
                const sa = availabilityText(s);
                const sp = bestPrice(s);
                const save = savingsText(s.savingsMinor, s.savingsPercent);
                return (
                  <li key={s.id} className="flex min-w-0 flex-col">
                    <Link href={`/medicines/${s.id}`} className="flex h-full min-w-0 items-start gap-3 rounded-[5px] border border-line p-3 hover:bg-soft">
                      <MedicineImage imageUrl={s.imageUrl} name={s.name} dosageForm={s.dosageForm} representative={s.imageIsRepresentative} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold">{medicineLabel(s.name, s.strength)}</span>
                        <span className="block truncate text-xs text-muted">{[s.manufacturer, s.packSize ? `Pack of ${s.packSize}` : null].filter(Boolean).join(' · ') || s.dosageForm}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">{sp != null && <span className="tnum text-sm font-extrabold">from {money(sp)}</span>}{save && <Badge tone="success">{save}</Badge>}</span>
                        <span className={`mt-1 block text-xs font-semibold ${TONE_TEXT[sa.tone]}`}>{sa.text}</span>
                      </span>
                    </Link>
                    {/* Only when this substitute is already in the basket (the patient chose it); never switched automatically. */}
                    <CartLineStepper medicineId={s.id} className="mt-1 self-end" />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Other strengths */}
        {d.similarGenerics.length > 0 && (
          <section className={surface} aria-labelledby="med-strengths">
            <h2 id="med-strengths" className="text-lg font-extrabold">Other Strengths</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {d.similarGenerics.map((g) => (
                <li key={g.compositionKey}><Link href={`/medicines/${g.exampleId}`} className="inline-flex min-h-11 items-center gap-2 rounded-[5px] border border-line bg-surface px-3 text-sm font-semibold hover:bg-soft"><span>{g.strength ?? g.exampleName}</span><span className="text-xs font-normal text-muted">{g.medicines} {g.medicines === 1 ? 'brand' : 'brands'}</span></Link></li>
              ))}
            </ul>
          </section>
        )}

        {d.attribution && <p className="px-1 text-[11px] leading-snug text-muted">{d.attribution || CDCI_ATTRIBUTION}</p>}
      </div>
    </AppShell>
  );
}
