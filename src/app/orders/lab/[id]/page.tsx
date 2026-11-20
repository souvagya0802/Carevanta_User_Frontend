'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Download, FlaskConical, Home, MapPin, Navigation, Store } from 'lucide-react';
import { API_BASE, session } from '@/lib/api';
import { useGet } from '@/lib/hooks';
import { dateTime, money } from '@/lib/format';
import { directionsUrl } from '@/lib/geo';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { InvoiceDownloads, type InvoiceMeta } from '@/components/invoices';
import { OrderTimeline } from '@/components/order-timeline';
import { Badge, Button, Card, ErrorState, Skeleton, StatusBadge, statusLabel } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer mt-3 h-40 rounded-[22px]" /> });
interface Centre { name: string; addressLine1: string | null; city: string | null; district: string | null; pincode: string | null; latitude: number | null; longitude: number | null }
interface Order { location?: Centre | null; id: string; reference: string; status: string; provider: { id: string; displayName: string }; patient: { fullName: string }; collectionMode: string; collectionPincode: string | null; scheduledAt: string | null; totalMinor: number; statusReason: string | null; items: { id: string; serviceName: string; priceMinor: number }[]; reports: { id: string; version: number; status: string; publishedAt: string | null; correctionReason: string | null }[]; transaction: { id: string; status: string } | null; createdAt: string; invoices?: InvoiceMeta[] }
const STEPS = [{ key: 'REQUESTED', label: 'Requested' }, { key: 'CONFIRMED', label: 'Confirmed' }, { key: 'SAMPLE_COLLECTED', label: 'Sample taken' }, { key: 'PROCESSING', label: 'In the lab' }, { key: 'COMPLETED', label: 'Report ready' }];

export default function LabOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useGet<Order>(`/patient/diagnostic-orders/${id}`, { refetchInterval: 30_000 });
  const [opening, setOpening] = useState<string | null>(null);
  const o = q.data;
  const open = async (reportId: string) => {
    setOpening(reportId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/patient/diagnostic-orders/${id}/reports/${reportId}/file`, { headers: { authorization: `Bearer ${session.accessToken ?? ''}` } });
      if (!res.ok) throw new Error('Could not open the report');
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { toast.error(e); } finally { setOpening(null); }
  };
  const timelineStatus = o?.status === 'REPORT_READY' ? 'COMPLETED' : o?.status ?? '';
  return (
    <AppShell hideTop>
      <RequireSignIn>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-3"><button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><h1 className="text-xl font-extrabold">Test Order</h1></div>
          {q.isPending ? <Skeleton card rows={3} /> : q.isError || !o ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-mono text-muted">{o.reference}</p><p className="text-lg font-extrabold">{o.provider.displayName}</p><p className="text-xs text-muted">For {o.patient.fullName} · placed {dateTime(o.createdAt)}</p></div><StatusBadge status={o.status} /></div>
                <div className="mt-4"><OrderTimeline steps={STEPS} status={['CANCELLED', 'REJECTED'].includes(o.status) ? o.status : timelineStatus} stopped={['CANCELLED', 'REJECTED']} /></div>
                {['CANCELLED', 'REJECTED'].includes(o.status) && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger">{statusLabel(o.status)}{o.statusReason ? `: ${o.statusReason}` : ''}. Any payment is refunded to the original method.</p>}
              </Card>
              <Card>
                <p className="flex items-center gap-2 text-sm font-extrabold">{o.collectionMode === 'HOME_COLLECTION' ? <Home size={16} className="text-primary" /> : <Store size={16} className="text-primary" />} {o.collectionMode === 'HOME_COLLECTION' ? `Home collection at PIN ${o.collectionPincode}` : 'Visit the centre'}</p>
                <p className="mt-1 text-sm">{o.scheduledAt ? <>Scheduled for <span className="font-semibold">{dateTime(o.scheduledAt)}</span></> : <span className="text-warning">Time not confirmed yet — the lab will set it.</span>}</p>
                <ul className="mt-3 divide-y divide-line text-sm">{o.items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span>{i.serviceName}</span><span className="tnum">{money(i.priceMinor)}</span></li>)}<li className="flex justify-between py-1.5 font-extrabold"><span>Total</span><span className="tnum">{money(o.totalMinor)}</span></li></ul>
                {o.collectionMode !== 'HOME_COLLECTION' && o.location?.latitude != null && o.location.longitude != null && (
                  <div className="mt-3">
                    <p className="text-xs text-muted">{[o.location.name, o.location.addressLine1, o.location.city, o.location.pincode].filter(Boolean).join(', ')}</p>
                    <MapView className="mt-2 h-40" markers={[{ id: 'centre', lat: o.location.latitude, lng: o.location.longitude, title: o.location.name, colour: '#7C3AED' }]} label={`Map to ${o.location.name}`} />
                    <a href={directionsUrl(o.location.latitude, o.location.longitude)} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-white"><Navigation size={15} aria-hidden /> Directions</a>
                  </div>
                )}
                {o.transaction && <p className="mt-2 text-xs text-muted">Payment: <Badge tone={o.transaction.status === 'PAID' ? 'success' : 'warning'}>{statusLabel(o.transaction.status)}</Badge></p>}
              </Card>
              <InvoiceDownloads transaction={o.transaction} invoices={o.invoices} />
              <Card>
                <p className="flex items-center gap-2 text-sm font-extrabold"><FlaskConical size={16} className="text-primary" /> Reports</p>
                {o.reports.length === 0 ? <p className="mt-1 text-sm text-muted">Your report appears here as soon as the lab publishes it. You will also get a notification.</p> : (
                  <ul className="mt-2 grid gap-2">{[...o.reports].reverse().map((r) => <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line p-3"><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Version {r.version}{r.status === 'AMENDED' ? ' (superseded)' : ''}</span><span className="block text-xs text-muted">{r.publishedAt ? dateTime(r.publishedAt) : ''}{r.correctionReason ? ` · correction: ${r.correctionReason}` : ''}</span></span><Button size="sm" variant={r.status === 'AMENDED' ? 'secondary' : 'primary'} onClick={() => void open(r.id)} loading={opening === r.id}><Download size={14} /> Open PDF</Button></li>)}</ul>
                )}
                <p className="mt-2 text-xs text-muted">Reports are shown only to you and anyone you share them with. Corrected reports keep the earlier version for your records.</p>
              </Card>
              <a href={`/providers/${o.provider.id}`} className="flex items-center gap-2 text-sm font-semibold text-primary"><MapPin size={14} /> Lab details and directions</a>
            </>
          )}
        </div>
      </RequireSignIn>
    </AppShell>
  );
}
