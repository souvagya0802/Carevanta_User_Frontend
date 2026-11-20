'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarCheck, ChevronRight, FileText, FlaskConical, Pill, Users } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { money, nowMs } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { Avatar, Card, Chip, EmptyState, ErrorState, PageTitle, Skeleton, StatusBadge } from '@/components/ui/primitives';

export interface Appt { id: string; reference: string; status: string; patient: { id: string; fullName: string }; doctor: { id: string; displayName: string }; facility: { id: string; displayName: string }; location: { id: string; name: string; city: string; addressLine1?: string | null; district?: string | null; pincode?: string | null; latitude?: number | null; longitude?: number | null; phone?: string | null } | null; startsAt: string; endsAt: string; feeMinor: number; statusReason: string | null; transaction: { id: string; reference: string; status: string } | null; createdAt: string; department?: { code: string; name: string } | null }
interface LabOrder { id: string; reference: string; status: string; provider: { displayName: string }; items: { serviceName: string }[]; totalMinor: number; createdAt: string; reports: { id: string }[] }
interface RxOrder { id: string; reference: string; status: string; provider: { displayName: string }; items: { medicine: { name: string }; quantity: number }[]; totalMinor: number; createdAt: string }

const LIVE = ['REQUESTED', 'CONFIRMED', 'CHECKED_IN'];
export const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export default function CarePage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const appts = useGet<Appt[]>('/patient/appointments?limit=50');
  const labs = useGet<LabOrder[]>('/patient/diagnostic-orders?limit=10');
  const rx = useGet<RxOrder[]>('/patient/pharmacy-orders?limit=10');
  // Upcoming = still live AND not yet over; a request the clinic never answered before its time belongs to the past.
  const cutoff = nowMs() - 60 * 60_000;
  const upcoming = (a: Appt) => LIVE.includes(a.status) && new Date(a.startsAt).getTime() >= cutoff;
  const list = (appts.data ?? []).filter((a) => (tab === 'upcoming' ? upcoming(a) : !upcoming(a))).sort((a, b) => (tab === 'upcoming' ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt)));
  return (
    <AppShell>
      <RequireSignIn message="Your appointments, orders and reports live here.">
        <PageTitle title="My Care" subtitle="Appointments, test orders, medicine orders and records for everyone in your family." />
        <div className="stagger mb-5 grid grid-cols-3 gap-2">
          <Link href="/records" className="card-3d flex flex-col items-center gap-1.5 rounded-3xl p-3 text-center"><span className="tile-3d flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ '--tile': '#0EA5E9' } as React.CSSProperties}><FileText size={20} /></span><span className="text-xs font-bold">Records</span></Link>
          <Link href="/orders" className="card-3d flex flex-col items-center gap-1.5 rounded-3xl p-3 text-center"><span className="tile-3d flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ '--tile': '#7C3AED' } as React.CSSProperties}><FlaskConical size={20} /></span><span className="text-xs font-bold">Orders</span></Link>
          <Link href="/family" className="card-3d flex flex-col items-center gap-1.5 rounded-3xl p-3 text-center"><span className="tile-3d flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ '--tile': '#16A34A' } as React.CSSProperties}><Users size={20} /></span><span className="text-xs font-bold">Family</span></Link>
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Appointments</h2><div className="flex gap-2"><Chip active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming</Chip><Chip active={tab === 'past'} onClick={() => setTab('past')}>Past</Chip></div></div>
          {appts.isPending ? <Skeleton card rows={2} /> : appts.isError ? <ErrorState error={appts.error} retry={() => appts.refetch()} /> : list.length === 0 ? <EmptyState icon={CalendarCheck} title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'} description={tab === 'upcoming' ? 'Find a doctor and pick a slot that suits you.' : undefined} action={tab === 'upcoming' ? <Link href="/search?type=doctors" className="text-sm font-bold text-primary">Find a Doctor</Link> : undefined} /> : (
            <div className="stagger grid gap-2 lg:grid-cols-2">
              {list.map((a) => (
                <Card key={a.id} href={`/appointments/${a.id}`} className="flex items-center gap-3">
                  <Avatar name={a.doctor.displayName} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{a.doctor.displayName}</span><span className="block truncate text-xs text-muted">{when(a.startsAt)} · {a.location?.name ?? a.facility.displayName}{a.patient ? ` · ${a.patient.fullName}` : ''}</span></span>
                  <span className="flex flex-col items-end gap-1"><StatusBadge status={a.status} /><span className="tnum text-xs font-bold">{money(a.feeMinor)}</span></span>
                </Card>
              ))}
            </div>
          )}
        </section>
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Recent Orders</h2><Link href="/orders" className="-mr-2 inline-flex h-11 items-center rounded-[5px] px-2 text-sm font-semibold text-primary">All Orders</Link></div>
          {labs.isPending || rx.isPending ? <Skeleton card rows={2} /> : (
            <div className="stagger grid gap-2 lg:grid-cols-2">
              {(labs.data ?? []).slice(0, 3).map((o) => <Card key={o.id} href={`/orders/lab/${o.id}`} className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-soft text-violet"><FlaskConical size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{o.items.map((i) => i.serviceName).join(', ')}</span><span className="block truncate text-xs text-muted">{o.provider.displayName} · {o.reference}</span></span><StatusBadge status={o.status} /><ChevronRight size={16} className="text-muted" /></Card>)}
              {(rx.data ?? []).slice(0, 3).map((o) => <Card key={o.id} href={`/orders/medicine/${o.id}`} className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning"><Pill size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{o.items.map((i) => `${i.medicine.name} ×${i.quantity}`).join(', ')}</span><span className="block truncate text-xs text-muted">{o.provider.displayName} · {money(o.totalMinor)}</span></span><StatusBadge status={o.status} /><ChevronRight size={16} className="text-muted" /></Card>)}
              {!labs.data?.length && !rx.data?.length && <p className="text-sm text-muted">No orders yet.</p>}
            </div>
          )}
        </section>
      </RequireSignIn>
    </AppShell>
  );
}
