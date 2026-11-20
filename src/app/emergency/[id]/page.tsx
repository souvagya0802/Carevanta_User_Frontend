'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { Ambulance, ArrowLeft, CheckCircle2, Clock, Phone, Siren } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { dateTime, title } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { InvoiceDownloads, type InvoiceMeta } from '@/components/invoices';
import { Card, ErrorState, Skeleton, StatusBadge, cx } from '@/components/ui/primitives';

// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-44 rounded-[22px]" /> });

interface Dispatch {
  pickupLatitude?: number | null; pickupLongitude?: number | null; pickupAddress?: string | null;
  id: string; reference: string; status: string; pickupDistrict: string | null; requiredVehicleType: string | null; ambulanceConfirmed: boolean; emergencyNumber: string;
  confirmedBy: { operator: { id: string; displayName: string }; vehicle: { registrationNumber: string; vehicleType: string } | null; confirmationSource: string; etaMinutes: number | null } | null;
  escalatedAt: string | null; escalationNote: string | null; closedAt: string | null; createdAt: string;
  /** Additive fields from the invoice API; absent until a trip is billed through Carevanta. */
  transaction?: { id: string; status: string } | null; invoices?: InvoiceMeta[];
  events: { fromStatus: string | null; toStatus: string; actorKind: string; note: string | null; createdAt: string }[];
}
const OPEN = ['RECEIVED', 'SEARCHING', 'OFFERED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'PATIENT_ONBOARD', 'AT_DESTINATION'];
const HEADLINE: Record<string, string> = {
  RECEIVED: 'Request received. Alerting operators near you…',
  SEARCHING: 'Looking for an available ambulance…',
  OFFERED: 'Operators have been alerted. Waiting for one to accept…',
  ACCEPTED: 'An ambulance is confirmed and getting ready.',
  EN_ROUTE: 'The ambulance is on its way.',
  ARRIVED: 'The ambulance has arrived at the pickup point.',
  PATIENT_ONBOARD: 'Patient is on board, heading to the hospital.',
  AT_DESTINATION: 'Arrived at the hospital.',
  COMPLETED: 'Trip completed.',
  CANCELLED: 'This request was cancelled.',
  ESCALATED: 'No operator could accept in time. Please call the emergency number.',
  NO_OPERATOR: 'No operator was available. Please call the emergency number.',
};

/** Live status of one emergency request; polls every 10 seconds while open. */
export default function EmergencyStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useGet<Dispatch>(`/patient/emergency/${id}`, { refetchInterval: 10_000 });
  const d = q.data;
  const open = !!d && OPEN.includes(d.status);
  const fallback = !!d && !d.ambulanceConfirmed && !OPEN.slice(0, 3).includes(d.status) && d.status !== 'COMPLETED';
  return (
    <AppShell hideTop>
      <RequireSignIn>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-3"><button type="button" onClick={() => router.push('/emergency')} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><h1 className="text-xl font-extrabold">Ambulance Request</h1></div>
          {q.isPending ? <Skeleton card rows={3} /> : q.isError || !d ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
            <>
              <section className={cx('relative overflow-hidden rounded-[32px] p-6 text-white', d.ambulanceConfirmed ? 'bg-gradient-to-br from-success to-emerald-500' : fallback || d.status === 'CANCELLED' ? 'bg-gradient-to-br from-slate-600 to-slate-800' : 'bg-gradient-to-br from-danger to-rose-500')}>
                <span className="orb absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15" aria-hidden />
                <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide opacity-90"><Siren size={16} /> {d.reference}</p><StatusBadge status={d.status} /></div>
                <h2 className="mt-3 text-2xl font-extrabold leading-tight">{HEADLINE[d.status] ?? title(d.status)}</h2>
                {open && !d.ambulanceConfirmed && <p className="mt-2 flex items-center gap-2 text-sm text-white/90"><span className="pulse-ring inline-block h-2.5 w-2.5 rounded-full bg-white" /> Updating live. Keep this screen open and keep your phone free for the operator&apos;s call.</p>}
                <a href={`tel:${d.emergencyNumber}`} className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-extrabold text-ink shadow-lg"><Phone size={18} /> Call {d.emergencyNumber}</a>
              </section>

              {d.confirmedBy && (
                <Card className="border-2 border-success/40">
                  <p className="flex items-center gap-2 text-base font-extrabold"><CheckCircle2 size={18} className="text-green-ink" /> Confirmed by {d.confirmedBy.operator.displayName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-soft p-3"><p className="text-[11px] font-semibold text-muted">Vehicle</p><p className="font-extrabold">{d.confirmedBy.vehicle?.registrationNumber ?? '—'}</p><p className="text-xs text-muted">{d.confirmedBy.vehicle ? title(d.confirmedBy.vehicle.vehicleType) : ''}</p></div>
                    <div className="rounded-2xl bg-soft p-3"><p className="text-[11px] font-semibold text-muted">Estimated arrival</p><p className="tnum font-extrabold">{d.confirmedBy.etaMinutes != null ? `${d.confirmedBy.etaMinutes} min` : 'Operator will call'}</p></div>
                  </div>
                  <p className="mt-2 text-xs text-muted">Confirmed {d.confirmedBy.confirmationSource === 'PHONE' ? 'by phone with our team' : 'by the operator in their app'}. The operator calls you on your callback number.</p>
                </Card>
              )}

              {d.pickupLatitude != null && d.pickupLongitude != null && (
                <Card>
                  <p className="text-sm font-extrabold">Pickup point</p>
                  {d.pickupAddress && <p className="mt-0.5 text-xs text-muted">{d.pickupAddress}</p>}
                  <MapView className="mt-3 h-44" pin={{ lat: d.pickupLatitude, lng: d.pickupLongitude }} label="Where the ambulance will pick you up" />
                  <p className="mt-2 text-xs text-muted">This is the spot sent to the operator. If you have moved, call them or {d.emergencyNumber}.</p>
                </Card>
              )}
              {d.escalationNote && <Card className="bg-warning-soft"><p className="text-sm font-bold">Note from Carevanta</p><p className="mt-1 text-sm">{d.escalationNote}</p></Card>}

              <Card>
                <p className="flex items-center gap-2 text-sm font-extrabold"><Clock size={16} className="text-primary" /> Timeline</p>
                <ol className="mt-3 space-y-3">
                  {[...d.events].reverse().map((e, i) => (
                    <li key={`${e.createdAt}-${i}`} className="flex gap-3 text-sm">
                      <span className={cx('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', i === 0 ? 'bg-brand' : 'bg-line')} />
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{title(e.toStatus)}</span>{e.note && <span className="block text-xs text-muted">{e.note}</span>}<span className="block text-xs text-muted">{dateTime(e.createdAt)}</span></span>
                    </li>
                  ))}
                  <li className="flex gap-3 text-sm"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-line" /><span><span className="block font-semibold">Request sent</span><span className="block text-xs text-muted">{dateTime(d.createdAt)}{d.pickupDistrict ? ` · ${d.pickupDistrict}` : ''}</span></span></li>
                </ol>
              </Card>
              <InvoiceDownloads transaction={d.transaction} invoices={d.invoices} />
              <p className="flex items-center gap-1 text-xs text-muted"><Ambulance size={12} /> An ambulance is only shown as confirmed when the operator actually accepted. We never guess.</p>
            </>
          )}
        </div>
      </RequireSignIn>
    </AppShell>
  );
}
