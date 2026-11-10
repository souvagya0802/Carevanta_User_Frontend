'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, FlaskConical, Pill } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { money, relative } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { Card, Chip, EmptyState, ErrorState, PageTitle, Skeleton, StatusBadge } from '@/components/ui/primitives';

interface LabOrder { id: string; reference: string; status: string; provider: { displayName: string }; patient: { fullName: string }; items: { serviceName: string }[]; totalMinor: number; createdAt: string; reports: { id: string; status: string }[] }
interface RxOrder { id: string; reference: string; status: string; provider: { displayName: string }; patient: { fullName: string }; items: { medicine: { name: string }; quantity: number }[]; totalMinor: number; createdAt: string; fulfilment: string }

export default function OrdersPage() {
  const [tab, setTab] = useState<'lab' | 'medicine'>('lab');
  const labs = useGet<LabOrder[]>('/patient/diagnostic-orders?limit=50');
  const rx = useGet<RxOrder[]>('/patient/pharmacy-orders?limit=50');
  const q = tab === 'lab' ? labs : rx;
  return (
    <AppShell>
      <RequireSignIn>
        <PageTitle title="Orders" subtitle="Lab tests, scans and medicines for your family." right={<div className="flex gap-2"><Chip active={tab === 'lab'} onClick={() => setTab('lab')}>Tests</Chip><Chip active={tab === 'medicine'} onClick={() => setTab('medicine')}>Medicines</Chip></div>} />
        {q.isPending ? <Skeleton card rows={3} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : tab === 'lab' ? (
          !labs.data?.length ? <EmptyState icon={FlaskConical} title="No test orders yet" action={<Link href="/tests" className="text-sm font-bold text-primary">Book a Test</Link>} /> : (
            <div className="stagger grid gap-2 lg:grid-cols-2">{labs.data.map((o) => <Card key={o.id} href={`/orders/lab/${o.id}`} className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-soft text-violet"><FlaskConical size={22} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{o.items.map((i) => i.serviceName).join(', ')}</span><span className="block truncate text-xs text-muted">{o.provider.displayName} · {o.patient.fullName} · {relative(o.createdAt)}</span><span className="mt-1 flex items-center gap-2"><StatusBadge status={o.status} />{o.reports.length > 0 && <span className="text-xs font-bold text-success">Report ready</span>}</span></span><span className="tnum text-sm font-extrabold">{money(o.totalMinor)}</span><ChevronRight size={16} className="text-muted" /></Card>)}</div>
          )
        ) : (
          !rx.data?.length ? <EmptyState icon={Pill} title="No medicine orders yet" action={<Link href="/pharmacy" className="text-sm font-bold text-primary">Order Medicines</Link>} /> : (
            <div className="stagger grid gap-2 lg:grid-cols-2">{rx.data.map((o) => <Card key={o.id} href={`/orders/medicine/${o.id}`} className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning"><Pill size={22} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{o.items.map((i) => `${i.medicine.name} ×${i.quantity}`).join(', ')}</span><span className="block truncate text-xs text-muted">{o.provider.displayName} · {o.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'} · {relative(o.createdAt)}</span><span className="mt-1 block"><StatusBadge status={o.status} /></span></span><span className="tnum text-sm font-extrabold">{money(o.totalMinor)}</span><ChevronRight size={16} className="text-muted" /></Card>)}</div>
          )
        )}
      </RequireSignIn>
    </AppShell>
  );
}
