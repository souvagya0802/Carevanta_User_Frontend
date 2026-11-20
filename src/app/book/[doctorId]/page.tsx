'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, CheckCircle2, CreditCard, MapPin, Store, UserRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAttempt } from '@/lib/attempt';
import { useAction, useGet } from '@/lib/hooks';
import { money } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import type { DoctorProfile } from '@/app/doctors/[id]/page';
import { Avatar, Button, Card, Chip, ErrorState, Field, OptionCard, Skeleton, StepBar, Textarea, cx } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Slot { id: string; startsAt: string; endsAt: string; locationId: string; locationName: string; available: number; feeMinor: number; currency: string }
interface Profile { id: string; fullName: string; relationship: string }
interface Payments { activeGateway: string; publicKey: string | null; mode: string | null }

const IST = 'Asia/Kolkata';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: IST });
const dayLabel = (key: string) => { const d = new Date(`${key}T00:00:00+05:30`); const today = new Date().toLocaleDateString('en-CA', { timeZone: IST }); return key === today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); };
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST });

export default function BookPage() {
  return <Suspense fallback={<AppShell><Skeleton card rows={3} /></AppShell>}><BookInner /></Suspense>;
}

/** Four short steps: where, when, for whom, confirm. The slot is held only when the booking is placed. */
function BookInner() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const doctor = useGet<DoctorProfile>(`/discovery/providers/${doctorId}`);
  const slots = useGet<Slot[]>(`/discovery/doctors/${doctorId}/slots`);
  const profiles = useGet<Profile[]>(me ? '/patient/profiles' : null);
  const payments = useGet<Payments>('/public/payments');
  const [locationId, setLocationId] = useState(params.get('location') ?? '');
  const [day, setDay] = useState('');
  const [slotId, setSlotId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [reason, setReason] = useState('');
  const [payAtProvider, setPayAtProvider] = useState(true);
  const [done, setDone] = useState<{ id: string; reference: string; status: string } | null>(null);

  const byLocation = useMemo(() => { const m = new Map<string, { name: string; slots: Slot[] }>(); for (const s of slots.data ?? []) m.set(s.locationId, { name: s.locationName, slots: [...(m.get(s.locationId)?.slots ?? []), s] }); return m; }, [slots.data]);
  const activeLocation = locationId && byLocation.has(locationId) ? locationId : [...byLocation.keys()][0] ?? '';
  const days = useMemo(() => { const m = new Map<string, Slot[]>(); for (const s of byLocation.get(activeLocation)?.slots ?? []) { const k = dayKey(s.startsAt); m.set(k, [...(m.get(k) ?? []), s]); } return m; }, [byLocation, activeLocation]);
  const activeDay = day && days.has(day) ? day : [...days.keys()][0] ?? '';
  const chosen = (days.get(activeDay) ?? []).find((s) => s.id === slotId) ?? null;
  const selfProfile = profiles.data?.find((p) => p.relationship === 'SELF');
  const activeProfile = profileId || selfProfile?.id || '';
  const onlineAvailable = payments.data?.activeGateway && payments.data.activeGateway !== 'NONE';
  // The last step is done only once the clinic has confirmed; a request that is still waiting keeps it highlighted as pending.
  const step = done ? (done.status === 'CONFIRMED' ? 4 : 3) : !chosen ? (activeLocation ? 1 : 0) : !activeProfile ? 2 : 3;
  const place = doctor.data?.doctor?.practisesAt.find((a) => a.locationId === activeLocation);

  // One random key per booking attempt (lib/attempt.ts): a double tap or retry reuses it and sends one
  // request; a different slot, patient or note, or a new booking after this one, gets a fresh key.
  const attempt = useAttempt('book');
  const book = useAction(() => {
    const body = { slotId: chosen!.id, patientProfileId: activeProfile, reasonForVisit: reason.trim() || undefined, payAtProvider: !onlineAvailable || payAtProvider };
    return attempt.run(JSON.stringify(body), (key) => api.post<{ data: { id: string; reference: string; status: string } }>('/patient/appointments', body, key));
  }, {
    onSuccess: (r) => { setDone(r.data); toast.success(r.data.status === 'CONFIRMED' ? 'Appointment confirmed' : 'Request sent — the clinic will confirm shortly'); },
    // A single message per failure. Only a real slot conflict says "taken"; anything else is shown as the API put it.
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE') { toast.error(new Error(/too soon|started/i.test(e.message) ? 'That time is too close to book now. Pick a later slot.' : 'That slot was just taken. Pick another time.')); void slots.refetch(); setSlotId(''); }
      else toast.error(e);
    },
  });

  return (
    <AppShell hideTop>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3"><button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><h1 className="text-xl font-extrabold">Book an Appointment</h1></div>
        {doctor.data?.doctor && <Card className="flex items-center gap-3"><Avatar name={doctor.data.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{doctor.data.name}</p><p className="truncate text-xs text-muted">{doctor.data.doctor.specialities[0]?.name ?? 'Doctor'}</p></div></Card>}
        <StepBar steps={['Place', 'Time', 'Patient', 'Confirm']} current={step} />

        {done ? (
          <Card className="animate-scale-in text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-green-ink"><CheckCircle2 size={34} aria-hidden /></span>
            <h2 className="mt-3 text-xl font-extrabold">{done.status === 'CONFIRMED' ? 'You are booked' : 'Request sent'}</h2>
            <p className="mt-1 text-sm text-muted">Reference <span className="font-mono font-semibold text-ink">{done.reference}</span>. {done.status === 'CONFIRMED' ? 'A confirmation is on its way.' : 'The clinic confirms shortly; you will be notified.'}</p>
            {chosen && <p className="mt-2 text-sm font-semibold">{dayLabel(activeDay)} · {time(chosen.startsAt)} · {chosen.locationName}</p>}
            <div className="mt-5 grid gap-2"><Link href={`/appointments/${done.id}`}><Button full>View Appointment</Button></Link><Link href="/"><Button full variant="ghost">Back to Home</Button></Link></div>
          </Card>
        ) : slots.isPending || doctor.isPending ? <Skeleton card rows={3} /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : byLocation.size === 0 ? (
          <Card className="text-center"><p className="font-bold">No open slots in the next two weeks</p><p className="mt-1 text-sm text-muted">The doctor has not published timings yet, or everything is taken. Try another doctor nearby.</p><Link href="/search?type=doctors"><Button className="mt-4" variant="soft">Find Another Doctor</Button></Link></Card>
        ) : (
          <>
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold"><MapPin size={16} className="text-primary" aria-hidden /> Where</h2>
              <div className="grid gap-2">{[...byLocation.entries()].map(([id, l]) => <OptionCard key={id} selected={activeLocation === id} onSelect={() => { setLocationId(id); setDay(''); setSlotId(''); }} title={l.name} description={`${l.slots.length} open slot${l.slots.length === 1 ? '' : 's'} · fee ${money(l.slots[0]?.feeMinor ?? null)}`} />)}</div>
              {place && <p className="mt-1.5 text-xs text-muted">{place.facilityName}{place.department ? ` · ${place.department}` : ''}</p>}
            </section>
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold"><CalendarCheck size={16} className="text-primary" aria-hidden /> When</h2>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{[...days.keys()].map((k) => <Chip key={k} active={activeDay === k} onClick={() => { setDay(k); setSlotId(''); }}>{dayLabel(k)} <span className="text-[11px] opacity-70">{days.get(k)!.length}</span></Chip>)}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(days.get(activeDay) ?? []).map((s) => <button key={s.id} type="button" aria-pressed={slotId === s.id} onClick={() => setSlotId(s.id)} className={cx('tnum h-11 rounded-2xl border-2 text-sm font-bold', slotId === s.id ? 'border-primary bg-primary text-white shadow-glow' : 'border-line bg-white hover:border-primary/50')}>{time(s.startsAt)}{s.available > 1 && <span className="block text-[10px] font-medium opacity-70">{s.available} left</span>}</button>)}
              </div>
            </section>
            {chosen && (
              <RequireSignIn message="Sign in so the appointment is saved to your account and the clinic can reach you.">
                <section>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold"><UserRound size={16} className="text-primary" aria-hidden /> Who is this for?</h2>
                  {profiles.isPending ? <Skeleton rows={2} /> : <div className="grid gap-2">{(profiles.data ?? []).map((p) => <OptionCard key={p.id} selected={activeProfile === p.id} onSelect={() => setProfileId(p.id)} title={p.fullName} description={p.relationship === 'SELF' ? 'You' : p.relationship.toLowerCase()} />)}<Link href={`/family?next=${encodeURIComponent(`/book/${doctorId}`)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">+ Add a Family Member</Link></div>}
                  <Field label="Reason for Visit" hint="Optional. Helps the doctor prepare." className="mt-3"><Textarea placeholder="e.g. Fever for 3 days, follow-up on reports" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                </section>
                <section>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold"><CreditCard size={16} className="text-primary" aria-hidden /> Payment</h2>
                  <div className="grid gap-2">
                    <OptionCard selected={payAtProvider || !onlineAvailable} onSelect={() => setPayAtProvider(true)} title="Pay at the counter" description="Pay the fee when you reach. No platform fee is added." right={<Store size={18} className="text-muted" aria-hidden />} />
                    <OptionCard selected={!payAtProvider && !!onlineAvailable} onSelect={() => setPayAtProvider(false)} disabled={!onlineAvailable} title="Pay online now" description={onlineAvailable ? `UPI, cards and net banking${payments.data?.mode === 'test' ? ' (test mode — no real money moves)' : ''}` : 'Online payment is not switched on yet'} right={<CreditCard size={18} className="text-muted" aria-hidden />} />
                  </div>
                </section>
                <Card className="bg-primary-soft">
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">{dayLabel(activeDay)} · {time(chosen.startsAt)}</span><span className="tnum text-base font-extrabold">{money(chosen.feeMinor)}</span></div>
                  <p className="mt-1 text-xs text-muted">{chosen.locationName}. Free cancellation until the clinic&apos;s cut-off; after that the clinic&apos;s policy applies.</p>
                  <Button full size="lg" className="mt-3" onClick={() => { if (!attempt.busy) book.mutate(); }} loading={book.isPending} disabled={!activeProfile || book.isPending}>{!onlineAvailable || payAtProvider ? 'Confirm Booking' : 'Confirm & Pay'}</Button>
                </Card>
              </RequireSignIn>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
