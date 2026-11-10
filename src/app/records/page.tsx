'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, FlaskConical, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useGet } from '@/lib/hooks';
import { date, dateTime } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { UploadSheet, type Rx } from '@/components/prescriptions';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, PageTitle, Skeleton, StatusBadge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface LabOrder { id: string; reference: string; status: string; provider: { displayName: string }; patient: { fullName: string }; items: { serviceName: string }[]; createdAt: string; reports: { id: string; status: string; publishedAt: string | null }[] }

/** Health records: lab reports (from orders) and prescriptions the family uploaded. */
export default function RecordsPage() {
  const [tab, setTab] = useState<'reports' | 'prescriptions'>('reports');
  const [uploading, setUploading] = useState(false);
  const labs = useGet<LabOrder[]>('/patient/diagnostic-orders?limit=50');
  const rx = useGet<Rx[]>('/patient/prescriptions?limit=50');
  const withReports = (labs.data ?? []).filter((o) => o.reports.length > 0);
  return (
    <AppShell>
      <RequireSignIn message="Reports and prescriptions are private to your account.">
        <PageTitle title="Health Records" subtitle="Lab reports and prescriptions for everyone in your family, in one place." right={<div className="flex gap-2"><Chip active={tab === 'reports'} onClick={() => setTab('reports')}>Reports</Chip><Chip active={tab === 'prescriptions'} onClick={() => setTab('prescriptions')}>Prescriptions</Chip></div>} />
        {tab === 'reports' ? (
          labs.isPending ? <Skeleton card rows={3} /> : labs.isError ? <ErrorState error={labs.error} retry={() => labs.refetch()} /> : withReports.length === 0 ? <EmptyState icon={FlaskConical} title="No reports yet" description="When a lab publishes a report for a test you booked, it appears here." action={<Link href="/tests" className="text-sm font-bold text-primary">Book a Test</Link>} /> : (
            <div className="stagger grid gap-2 lg:grid-cols-2">{withReports.map((o) => <Card key={o.id} href={`/orders/lab/${o.id}`} className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-soft text-violet"><FileText size={22} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{o.items.map((i) => i.serviceName).join(', ')}</span><span className="block truncate text-xs text-muted">{o.patient.fullName} · {o.provider.displayName} · {date(o.reports[o.reports.length - 1]?.publishedAt ?? o.createdAt)}</span></span><Badge tone="success">{o.reports.length > 1 ? `${o.reports.length} versions` : 'Report'}</Badge></Card>)}</div>
          )
        ) : (
          <>
            <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setUploading(true)}><Upload size={14} /> Upload Prescription</Button></div>
            {rx.isPending ? <Skeleton card rows={3} /> : rx.isError ? <ErrorState error={rx.error} retry={() => rx.refetch()} /> : !rx.data?.length ? <EmptyState icon={FileText} title="No prescriptions uploaded" description="Upload a photo or PDF once and reuse it when ordering medicines." action={<Button size="sm" onClick={() => setUploading(true)}>Upload</Button>} /> : (
              <div className="stagger grid gap-2 lg:grid-cols-2">{rx.data.map((p) => <PrescriptionRow key={p.id} rx={p} />)}</div>
            )}
          </>
        )}
        <UploadSheet open={uploading} onClose={() => setUploading(false)} />
      </RequireSignIn>
    </AppShell>
  );
}

function PrescriptionRow({ rx }: { rx: Rx }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    try {
      const { blob } = await api.blob(`/patient/prescriptions/${rx.id}/file`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { toast.error(e); } finally { setOpening(false); }
  };
  return (
    <Card className="flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><FileText size={22} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{rx.patient.fullName}</span><span className="block text-xs text-muted">Uploaded {dateTime(rx.createdAt)}{rx.issuedOn ? ` · issued ${date(rx.issuedOn)}` : ''}</span><span className="mt-1 flex items-center gap-2"><StatusBadge status={rx.reviewStatus} />{rx.reviewNote && <span className="truncate text-xs text-muted">{rx.reviewNote}</span>}</span></span>
      <Button size="sm" variant="secondary" onClick={() => void open()} loading={opening}>View</Button>
    </Card>
  );
}

