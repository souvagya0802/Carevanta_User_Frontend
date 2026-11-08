'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, CheckCircle2, FlaskConical, Home, Info, MapPin, Store } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAttempt } from '@/lib/attempt';
import { useAction, useGet } from '@/lib/hooks';
import { useLocation, geoQuery } from '@/lib/location';
import { money, nowMs } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { ProviderCard, type ProviderHit } from '@/components/provider-card';
import { PrescriptionPicker, usePrescriptions } from '@/components/prescriptions';
import type { ProviderProfile } from '@/app/providers/[id]/page';
import { Avatar, Button, Card, EmptyState, ErrorState, Field, Input, OptionCard, Skeleton, StepBar } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Service { code: string; name: string; category: string; requiresPrescription: boolean; fastingRequired: boolean | null; preparationInstructions: string | null; providers: number; fromMinor: number | null }
interface Profile { id: string; fullName: string; relationship: string }

export default function TestPage() {
  return <Suspense fallback={<AppShell><Skeleton card rows={3} /></AppShell>}><TestInner /></Suspense>;
}

/**
 * One test: what it is, who offers it near you, then a short booking:
 * centre → where/when → who → (prescription, for scans that need one) → confirm.
 */
function TestInner() {
  const { code } = useParams<{ code: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const { place } = useLocation();
  const serviceCode = decodeURIComponent(code);
  const info = useGet<Service[]>(`/public/catalogue/services?codes=${encodeURIComponent(serviceCode)}`);
  const service = info.data?.find((s) => s.code === serviceCode) ?? null;
  const labs = useGet<{ items: ProviderHit[] }>(`/discovery/providers?serviceCode=${encodeURIComponent(serviceCode)}&limit=40${geoQuery(place)}`);
  const [providerId, setProviderId] = useState(params.get('provider') ?? '');
  const lab = useGet<ProviderProfile>(providerId ? `/discovery/providers/${providerId}` : null);
  const offering = lab.data?.services.find((s) => s.code === serviceCode) ?? null;
  const profiles = useGet<Profile[]>(me && providerId ? '/patient/profiles' : null);
  const [mode, setMode] = useState<'CENTRE_VISIT' | 'HOME_COLLECTION'>('CENTRE_VISIT');
  const [pincode, setPincode] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [profileId, setProfileId] = useState('');
  const [rxId, setRxId] = useState('');
  const [rxError, setRxError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; reference: string; status?: string } | null>(null);
  const attempt = useAttempt('dx');

  const activeProfile = profileId || profiles.data?.find((p) => p.relationship === 'SELF')?.id || '';
  const activeProfileName = profiles.data?.find((p) => p.id === activeProfile)?.fullName ?? 'this patient';
  // Scans such as MRI, CT and X-ray need a doctor's prescription; the lab's own listing wins over the catalogue.
  const requiresRx = offering?.requiresPrescription ?? service?.requiresPrescription ?? false;
  const rx = usePrescriptions(activeProfile, !!me && requiresRx);
  // The chosen prescription, else the most recent usable one for this person.
  const activeRx = requiresRx ? (rx.usable.some((r) => r.id === rxId) ? rxId : rx.usable[0]?.id ?? '') : '';
  const isImaging = service?.category === 'IMAGING' || lab.data?.type === 'IMAGING_CENTRE' || /^(IMG|SCAN)_/i.test(serviceCode);
  const steps = requiresRx ? ['Choose centre', 'Details', 'Prescription', 'Confirm'] : [isImaging ? 'Choose centre' : 'Choose lab', 'Details', 'Confirm'];
  // Final step is done only once the lab has confirmed the order; until then it stays highlighted as pending.
  const step = done ? (done.status === 'CONFIRMED' ? steps.length : steps.length - 1) : !providerId ? 0 : !activeProfile ? 1 : requiresRx && !activeRx ? 2 : steps.length - 1;
  const minWhen = new Date(nowMs() + 2 * 3_600_000).toISOString().slice(0, 16);
  const pinOk = /^[1-9][0-9]{5}$/.test(pincode);

  const body = () => ({ patientProfileId: activeProfile, providerId, providerServiceIds: [offering!.id], collectionMode: mode, collectionPincode: mode === 'HOME_COLLECTION' ? pincode : undefined, scheduledAt: when ? new Date(when).toISOString() : undefined, prescriptionId: activeRx || undefined });
  const order = useAction(() => { const b = body(); return attempt.run(JSON.stringify(b), (key) => api.post<{ data: { id: string; reference: string } }>('/patient/diagnostic-orders', b, key)); }, {
    onSuccess: (r) => { setDone(r.data); toast.success(isImaging ? 'Scan booked — the centre will confirm the time' : 'Test booked — the lab will confirm the time'); },
    // One message per failure: next to the field it concerns, otherwise a single toast.
    onError: (e) => {
      if (e instanceof ApiError && /PIN/i.test(e.message)) setPinError(e.message);
      else if (e instanceof ApiError && /prescription/i.test(e.message)) setRxError(e.message);
      else toast.error(e);
    },
  });
  // Exact lookup by code; if the catalogue has not answered yet, fall back to the lab's own
  // service name, then to a readable version of the code (LAB_URINE_RE → "Urine Re").
  const title = service?.name ?? offering?.name ?? serviceCode.replace(/^(LAB|IMG|SCAN|TEST)_/i, '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const place0 = lab.data?.locations[0];

  return (
    <AppShell hideTop>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3"><button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><h1 className="truncate text-xl font-extrabold">{title}</h1></div>
        {service && (service.fastingRequired || service.preparationInstructions || requiresRx) && (
          <div className="flex items-start gap-3 rounded-3xl bg-warning-soft p-3 text-sm"><Info size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden /><div>{service.fastingRequired && <p className="font-bold">Fasting required — usually 8 to 12 hours. Water is fine.</p>}{service.preparationInstructions && <p className="mt-0.5 text-muted">{service.preparationInstructions}</p>}{requiresRx && <p className="mt-0.5 font-semibold">Needs a doctor&apos;s prescription. You can choose or upload it while booking.</p>}</div></div>
        )}
        <StepBar steps={steps} current={step} />

        {done ? (
          <Card className="animate-scale-in text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 size={34} aria-hidden /></span>
            <h2 className="mt-3 text-xl font-extrabold">{isImaging ? 'Scan booked' : 'Test booked'}</h2>
            <p className="mt-1 text-sm text-muted">Reference <span className="font-mono font-semibold text-ink">{done.reference}</span>. {mode === 'HOME_COLLECTION' ? 'The lab will confirm the collection time at your PIN code.' : `The ${isImaging ? 'centre' : 'lab'} will confirm your visit time.`} Your report appears under My Care when published.</p>
            <div className="mt-5 grid gap-2"><Link href={`/orders/lab/${done.id}`}><Button full>View order</Button></Link><Link href="/tests"><Button full variant="ghost">Book another test</Button></Link></div>
          </Card>
        ) : !providerId ? (
          <section>
            <p className="mb-2 text-sm font-extrabold">{isImaging ? 'Scan centres' : 'Labs'} offering this{place ? ` near ${place.label}` : ''}</p>
            {labs.isPending ? <Skeleton card rows={3} /> : labs.isError ? <ErrorState error={labs.error} retry={() => labs.refetch()} /> : !labs.data?.items.length ? <EmptyState icon={FlaskConical} title={isImaging ? 'No centre offers this yet' : 'No lab offers this yet'} description="Try a nearby town or a related test." /> : (
              <div className="stagger grid grid-cols-1 gap-3">{labs.data.items.map((p) => <ProviderCard key={p.id} p={p} onSelect={() => setProviderId(p.id)} selected={providerId === p.id} />)}</div>
            )}
          </section>
        ) : lab.isPending ? <Skeleton card rows={3} /> : !lab.data || !offering ? <ErrorState error={new Error(`This ${isImaging ? 'centre' : 'lab'} no longer offers the test`)} retry={() => setProviderId('')} /> : (
          <>
            <Card className="flex items-center gap-3"><Avatar name={lab.data.name} tone="#7C3AED" /><span className="min-w-0 flex-1"><span className="line-clamp-2 block text-sm font-extrabold leading-snug">{lab.data.name}</span><span className="line-clamp-2 block text-xs text-muted">{offering.name}{offering.turnaroundHours ? ` · report in ${offering.turnaroundHours} h` : ''}</span></span><span className="tnum text-base font-extrabold">{money(offering.priceMinor)}</span><button type="button" className="flex h-10 items-center px-1 text-xs font-bold text-primary" onClick={() => { setProviderId(''); setPinError(null); }}>Change</button></Card>
            <RequireSignIn message="Sign in so the report is saved to your account.">
              <section>
                <p className="mb-2 text-sm font-extrabold">How would you like it done?</p>
                <div className="grid gap-2">
                  <OptionCard selected={mode === 'CENTRE_VISIT'} onSelect={() => setMode('CENTRE_VISIT')} title="Visit the centre" description={place0 ? `${place0.name}, ${place0.locality ?? place0.city}` : 'At the centre'} right={<Store size={18} className="text-muted" aria-hidden />} />
                  <OptionCard selected={mode === 'HOME_COLLECTION'} onSelect={() => { setMode('HOME_COLLECTION'); setPinError(null); }} disabled={!offering.homeServiceAvailable} title="Home sample collection" description={offering.homeServiceAvailable ? 'A phlebotomist comes to you; the lab confirms the time.' : 'Not offered for this test'} right={<Home size={18} className="text-muted" aria-hidden />} />
                </div>
                {mode === 'HOME_COLLECTION' && <Field label="PIN code for collection" required className="mt-3" error={pinError ?? undefined} hint={lab.data.coverage.length ? `Covered: ${[...new Set(lab.data.coverage.filter((c) => c.purpose === 'HOME_COLLECTION').map((c) => c.pincode ?? c.district))].join(', ')}` : undefined}><Input inputMode="numeric" maxLength={6} value={pincode} aria-invalid={!!pinError || undefined} onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '')); setPinError(null); }} placeholder="721636" /></Field>}
                <Field label="Preferred date and time" className="mt-3" hint={`Optional. The ${isImaging ? 'centre' : 'lab'} confirms or suggests another time.`}><Input type="datetime-local" min={minWhen} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
              </section>
              <section>
                <p className="mb-2 text-sm font-extrabold">Who is the test for?</p>
                {profiles.isPending ? <Skeleton rows={2} /> : <div className="grid gap-2">{(profiles.data ?? []).map((p) => <OptionCard key={p.id} selected={activeProfile === p.id} onSelect={() => { setProfileId(p.id); setRxError(null); }} title={p.fullName} description={p.relationship === 'SELF' ? 'You' : p.relationship.toLowerCase()} />)}<Link href="/family" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary">+ Add a family member</Link></div>}
              </section>
              {requiresRx && activeProfile && (
                <PrescriptionPicker
                  rx={rx}
                  value={activeRx}
                  onChange={(id) => { setRxId(id); setRxError(null); }}
                  profileId={activeProfile}
                  profileName={activeProfileName}
                  intro={`${offering.name} needs a doctor's prescription or referral for ${activeProfileName}. Choose one you uploaded, or add a clear photo or PDF now. The centre checks it before the scan.`}
                  error={rxError}
                />
              )}
              <Card className="bg-primary-soft">
                <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 font-semibold">{offering.name}</span><span className="tnum text-base font-extrabold">{money(offering.priceMinor)}</span></div>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin size={12} className="shrink-0" aria-hidden />{mode === 'HOME_COLLECTION' ? `Home collection at ${pincode || 'your PIN'}` : 'At the centre'} · pay at the {isImaging ? 'centre' : 'lab'} or online once confirmed</p>
                <Button full size="lg" className="mt-3" onClick={() => { if (!attempt.busy) order.mutate(); }} loading={order.isPending} disabled={!activeProfile || (mode === 'HOME_COLLECTION' && !pinOk) || (requiresRx && !activeRx)}>{isImaging ? 'Book Scan' : 'Book Test'}</Button>
                {requiresRx && !activeRx && !rx.isPending && <p className="mt-2 text-center text-xs text-muted">Add the prescription above to continue.</p>}
              </Card>
            </RequireSignIn>
          </>
        )}
      </div>
    </AppShell>
  );
}
