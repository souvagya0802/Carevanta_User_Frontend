'use client';

import { useState } from 'react';
import { ChevronRight, FlaskConical, Search } from 'lucide-react';
import { useDebounced, useGet } from '@/lib/hooks';
import { count, money } from '@/lib/format';
import { AppShell } from '@/components/layout/app-shell';
import { Badge, Card, Chip, EmptyState, ErrorState, PageTitle, Skeleton } from '@/components/ui/primitives';

interface Service { code: string; name: string; category: string; requiresPrescription: boolean; fastingRequired: boolean | null; preparationInstructions: string | null; providers: number; fromMinor: number | null }

export default function TestsPage() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const [cat, setCat] = useState<'DIAGNOSTIC_TEST' | 'IMAGING' | ''>('');
  const services = useGet<Service[]>(`/public/catalogue/services?limit=100${cat ? `&category=${cat}` : ''}${dq ? `&q=${encodeURIComponent(dq)}` : ''}`);
  const items = (services.data ?? []).filter((s) => cat || s.category === 'DIAGNOSTIC_TEST' || s.category === 'IMAGING');
  return (
    <AppShell>
      <PageTitle title="Lab tests & scans" subtitle="Compare prices from verified labs, choose home collection where offered, and get reports on your phone." />
      <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-card"><Search size={18} className="shrink-0 text-muted" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Blood sugar, thyroid, MRI, X-ray…" aria-label="Search tests" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
      <div className="mt-3 flex gap-2"><Chip active={cat === ''} onClick={() => setCat('')}>All</Chip><Chip active={cat === 'DIAGNOSTIC_TEST'} onClick={() => setCat('DIAGNOSTIC_TEST')}>Lab tests</Chip><Chip active={cat === 'IMAGING'} onClick={() => setCat('IMAGING')}>Scans & imaging</Chip></div>
      <div className="mt-4">
        {services.isPending ? <Skeleton card rows={5} /> : services.isError ? <ErrorState error={services.error} retry={() => services.refetch()} /> : items.length === 0 ? <EmptyState icon={FlaskConical} title="No test matches" description="Try the generic name (e.g. CBC, LFT) or a body part." /> : (
          <div className="stagger grid gap-2 lg:grid-cols-2">
            {items.map((s) => (
              <Card key={s.code} href={`/tests/${encodeURIComponent(s.code)}`} className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-soft text-violet"><FlaskConical size={22} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold">{s.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">{s.providers > 0 ? `${count(s.providers)} lab${s.providers === 1 ? '' : 's'}` : 'Not offered nearby yet'}{s.fastingRequired && <Badge tone="warning">Fasting</Badge>}{s.requiresPrescription && <Badge tone="violet">Needs prescription</Badge>}</span>
                </span>
                <span className="text-right"><span className="tnum block text-sm font-extrabold">{s.fromMinor != null ? `from ${money(s.fromMinor)}` : '—'}</span></span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
