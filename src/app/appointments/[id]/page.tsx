'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CreditCard, MapPin, Navigation, Phone, Star, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useGet } from '@/lib/hooks';
import { money, nowMs } from '@/lib/format';
import { directionsUrl } from '@/lib/geo';
import { useLocation } from '@/lib/location';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import type { Appt } from '@/app/care/page';
import { when } from '@/app/care/page';
import { Avatar, Badge, Button, Card, Chip, ErrorState, Field, Sheet, Skeleton, StatusBadge, Textarea, cx, statusLabel } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Slot { id: string; startsAt: string; locationId: string; locationName: string; available: number }
interface Payments { activeGateway: string; publicKey: string | null; mode: string | null }
interface PaymentOrder { id: string; gateway: string; gatewayOrderId: string; amountMinor: number; currency: string; keyId: string | null; simulated: boolean }
const IST = 'Asia/Kolkata';
// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-44 rounded-[22px]" /> });
const LIVE = ['REQUESTED', 'CONFIRMED', 'CHECKED_IN'];

export default function AppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useGet<Appt & { reasonForVisit?: string | null; mode?: string; reviewed?: boolean }>(`/patient/appointments/${id}`, { refetchInterval: 30_000 });
  const payments = useGet<Payments>('/public/payments');
  const a = q.data;
  const { place } = useLocation();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [moving, setMoving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const inv = ['/patient/appointments', '/patient/summary'];
  const cancel = useAction(() => api.post(`/patient/appointments/${id}/cancel`, { reason: reason.trim() || undefined }), { success: 'Appointment cancelled', invalidate: inv, onSuccess: () => setCancelling(false) });
  const [reviewSent, setReviewSent] = useState(false);
  const review = useAction(() => api.post('/patient/reviews', { appointmentId: id, rating, comment: comment.trim() || undefined }), { success: 'Thank you — your review is sent for moderation', invalidate: [`/patient/appointments/${id}`], onSuccess: () => { setReviewing(false); setReviewSent(true); } });
  const pay = useAction(async () => {
    const { data } = await api.post<{ data: PaymentOrder }>(`/patient/transactions/${a!.transaction!.id}/payment-order`, {}, `pay-${a!.transaction!.id}`);
    if (data.simulated) { toast.success('Test gateway: no real payment is taken in this environment', 'The clinic will mark it paid or you pay at the counter.'); return; }
    if (data.gateway === 'RAZORPAY' && data.keyId) await openRazorpay(data, a!);
    else toast.error(new Error('Online payment for this gateway is being set up. Please pay at the counter.'));
  });
  const canCancel = !!a && LIVE.includes(a.status) && new Date(a.startsAt).getTime() > nowMs();
  const reviewed = !!a?.reviewed || reviewSent;
  const canReview = a?.status === 'COMPLETED' && !reviewed;
  const online = payments.data?.activeGateway && payments.data.activeGateway !== 'NONE';
  const canPay = !!a?.transaction && a.transaction.status === 'PENDING_PAYMENT' && LIVE.includes(a.status) && !!online;

  return (
    <AppShell hideTop>
      <RequireSignIn>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-3"><button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><h1 className="text-xl font-extrabold">Appointment</h1></div>
          {q.isPending ? <Skeleton card rows={3} /> : q.isError || !a ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
            <>
              <Card className="relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <Avatar name={a.doctor.displayName} size="lg" />
                  <div className="min-w-0 flex-1"><p className="truncate text-lg font-extrabold">{a.doctor.displayName}</p><p className="text-xs text-muted">{a.department?.name ? `${a.department.name} · ` : ''}{a.facility.displayName}</p><p className="mt-1 text-xs font-mono text-muted">{a.reference}</p></div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-soft p-3"><p className="text-[11px] font-semibold text-muted">When</p><p className="font-extrabold">{when(a.startsAt)}</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="text-[11px] font-semibold text-muted">For</p><p className="font-extrabold">{a.patient.fullName}</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="text-[11px] font-semibold text-muted">Where</p><p className="font-extrabold">{a.location?.name ?? a.facility.displayName}</p><p className="text-xs text-muted">{a.location?.city}</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="text-[11px] font-semibold text-muted">Fee</p><p className="tnum font-extrabold">{money(a.feeMinor)}</p>{a.transaction && <Badge tone={a.transaction.status === 'PAID' ? 'success' : 'warning'}>{statusLabel(a.transaction.status)}</Badge>}</div>
                </div>
                {a.status === 'REQUESTED' && <p className="mt-3 rounded-2xl bg-warning-soft p-3 text-sm">Waiting for the clinic to confirm. You will be notified; most confirm within an hour.</p>}
                {a.statusReason && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger">{a.statusReason}</p>}
              </Card>
              {LIVE.includes(a.status) && a.location?.latitude != null && a.location.longitude != null && (
                <Card>
                  <p className="text-sm font-extrabold">Getting there</p>
                  <p className="mt-0.5 text-xs text-muted">{[a.location.addressLine1, a.location.city, a.location.district, a.location.pincode].filter(Boolean).join(', ')}</p>
                  <MapView className="mt-3 h-44" markers={[{ id: a.location.id, lat: a.location.latitude, lng: a.location.longitude, title: a.location.name }]} you={place} label={`Map to ${a.location.name}`} />
                  <div className="mt-3 flex gap-2">
                    <a href={directionsUrl(a.location.latitude, a.location.longitude)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-white"><Navigation size={15} aria-hidden /> Directions</a>
                    {a.location.phone && <a href={`tel:${a.location.phone}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-soft px-4 text-sm font-bold"><Phone size={15} aria-hidden /> Call</a>}
                  </div>
                </Card>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {canPay && <Button onClick={() => pay.mutate()} loading={pay.isPending}><CreditCard size={16} /> Pay {money(a.feeMinor)} online</Button>}
                <a href={`/doctors/${a.doctor.id}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold shadow-card"><MapPin size={16} /> View doctor</a>
                {canCancel && <Button variant="secondary" onClick={() => setMoving(true)}><CalendarClock size={16} /> Reschedule</Button>}
                {canCancel && <Button variant="ghost" className="text-danger" onClick={() => setCancelling(true)}><XCircle size={16} /> Cancel</Button>}
                {canReview && <Button variant="soft" onClick={() => setReviewing(true)}><Star size={16} /> Rate this visit</Button>}
                {a.status === 'COMPLETED' && reviewed && <p className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-success-soft px-5 text-sm font-semibold text-success"><Star size={16} className="fill-success" aria-hidden /> You reviewed this visit</p>}
              </div>
              {a.transaction?.status === 'PAY_AT_PROVIDER' && <p className="text-xs text-muted">You chose to pay at the counter. Carry the reference above.</p>}
            </>
          )}
        </div>
        <Sheet open={cancelling} onClose={() => setCancelling(false)} title="Cancel this appointment?" description="The slot is released for someone else. If you paid online, the refund goes back the same way." footer={<><Button variant="secondary" onClick={() => setCancelling(false)}>Keep it</Button><Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>Cancel appointment</Button></>}>
          <Field label="Reason" hint="Optional"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </Sheet>
        {a && <RescheduleSheet open={moving} onClose={() => setMoving(false)} appt={a} />}
        <Sheet open={reviewing} onClose={() => setReviewing(false)} title="How was your visit?" description="Published after a quick check by the Carevanta team. Shown with your first name only." footer={<Button full onClick={() => review.mutate()} loading={review.isPending}>Send review</Button>}>
          <div className="flex justify-center gap-2 py-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} star`} onClick={() => setRating(n)} className={cx('rounded-full p-1', n <= rating ? 'text-sun' : 'text-line')}><Star size={34} className={n <= rating ? 'fill-sun' : ''} /></button>)}</div>
          <Textarea aria-label="Your review (optional)" placeholder="What went well, what could be better (optional)" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Sheet>
      </RequireSignIn>
    </AppShell>
  );
}

/** Rescheduling creates a new appointment (the old one is kept as RESCHEDULED), so on success we move to the new one. */
function RescheduleSheet({ open, onClose, appt }: { open: boolean; onClose: () => void; appt: Appt }) {
  const router = useRouter();
  const slots = useGet<Slot[]>(open ? `/discovery/doctors/${appt.doctor.id}/slots${appt.location ? `?locationId=${appt.location.id}` : ''}` : null);
  const [day, setDay] = useState('');
  const [slotId, setSlotId] = useState('');
  const days = useMemo(() => { const m = new Map<string, Slot[]>(); for (const s of slots.data ?? []) { if (s.available <= 0) continue; const k = new Date(s.startsAt).toLocaleDateString('en-CA', { timeZone: IST }); m.set(k, [...(m.get(k) ?? []), s]); } return m; }, [slots.data]);
  const activeDay = day && days.has(day) ? day : [...days.keys()][0] ?? '';
  const move = useAction(() => api.post<{ data: { id: string } }>(`/patient/appointments/${appt.id}/reschedule`, { newSlotId: slotId }), { success: 'Appointment moved', invalidate: ['/patient/appointments', '/patient/summary'], onSuccess: (r) => { onClose(); router.replace(`/appointments/${r.data.id}`); } });
  return (
    <Sheet open={open} onClose={onClose} title="Pick a new time" description="Same doctor and place. The old slot is released once the new one is confirmed." footer={<Button full onClick={() => move.mutate()} loading={move.isPending} disabled={!slotId}>Move appointment</Button>}>
      {slots.isPending ? <Skeleton rows={3} /> : days.size === 0 ? <p className="text-sm text-muted">No other open slots in the next two weeks.</p> : (
        <>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">{[...days.keys()].map((k) => <Chip key={k} active={activeDay === k} onClick={() => { setDay(k); setSlotId(''); }}>{new Date(`${k}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Chip>)}</div>
          <div className="mt-3 grid grid-cols-3 gap-2">{(days.get(activeDay) ?? []).map((s) => <button key={s.id} type="button" aria-pressed={slotId === s.id} onClick={() => setSlotId(s.id)} className={cx('tnum h-11 rounded-2xl border-2 text-sm font-bold', slotId === s.id ? 'border-primary bg-primary text-white' : 'border-line bg-white')}>{new Date(s.startsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST })}</button>)}</div>
        </>
      )}
    </Sheet>
  );
}

/** Loads Razorpay Checkout on demand and opens it. Success is confirmed only by the server webhook; the app just refreshes afterwards. */
async function openRazorpay(order: PaymentOrder, appt: Appt) {
  await new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[data-razorpay]')) return resolve();
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true; s.dataset.razorpay = '1'; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load the payment page')); document.body.appendChild(s);
  });
  const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open: () => void } }).Razorpay;
  new Razorpay({ key: order.keyId, order_id: order.gatewayOrderId, amount: order.amountMinor, currency: order.currency, name: 'Carevanta', description: `Appointment ${appt.reference}`, theme: { color: '#1E6CFF' }, handler: () => window.location.reload() }).open();
}
