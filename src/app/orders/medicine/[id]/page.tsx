'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Home, MapPin, Pill, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useGet } from '@/lib/hooks';
import { dateTime, medicineLabel, money, monthYear } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { OrderTimeline } from '@/components/order-timeline';
import { Badge, Button, Card, ErrorState, Sheet, Skeleton, StatusBadge, Textarea, statusLabel } from '@/components/ui/primitives';

interface Order { id: string; reference: string; status: string; provider: { id: string; displayName: string }; patient: { fullName: string }; fulfilment: string; deliveryPincode: string | null; prescriptionId: string | null; totalMinor: number; statusReason: string | null; items: { id: string; medicine: { name: string; strength: string | null; schedule: string }; quantity: number; unitPriceMinor: number; batchNumber: string | null; expiryDate: string | null }[]; transaction: { id: string; status: string } | null; createdAt: string }
const PICKUP = [{ key: 'PLACED', label: 'Placed' }, { key: 'ACCEPTED', label: 'Accepted' }, { key: 'PREPARING', label: 'Preparing' }, { key: 'READY_FOR_PICKUP', label: 'Ready' }, { key: 'DELIVERED', label: 'Collected' }];
const DELIVERY = [{ key: 'PLACED', label: 'Placed' }, { key: 'ACCEPTED', label: 'Accepted' }, { key: 'PREPARING', label: 'Preparing' }, { key: 'OUT_FOR_DELIVERY', label: 'On the way' }, { key: 'DELIVERED', label: 'Delivered' }];

export default function MedicineOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useGet<Order>(`/patient/pharmacy-orders/${id}`, { refetchInterval: 30_000 });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const cancel = useAction(() => api.post(`/patient/pharmacy-orders/${id}/cancel`, { reason: reason.trim() || undefined }), { success: 'Order cancelled', invalidate: ['/patient/pharmacy-orders', '/patient/summary'], onSuccess: () => setCancelling(false) });
  const o = q.data;
  const steps = o?.fulfilment === 'DELIVERY' ? DELIVERY : PICKUP;
  const status = o?.status === 'PRESCRIPTION_REVIEW' ? 'PLACED' : o?.status ?? '';
  return (
    <AppShell hideTop>
      <RequireSignIn>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-3"><button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><h1 className="text-xl font-extrabold">Medicine order</h1></div>
          {q.isPending ? <Skeleton card rows={3} /> : q.isError || !o ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-mono text-muted">{o.reference}</p><p className="text-lg font-extrabold">{o.provider.displayName}</p><p className="text-xs text-muted">For {o.patient.fullName} · placed {dateTime(o.createdAt)}</p></div><StatusBadge status={o.status} /></div>
                <div className="mt-4"><OrderTimeline steps={steps} status={['CANCELLED', 'REJECTED', 'RETURNED'].includes(o.status) ? o.status : status} stopped={['CANCELLED', 'REJECTED', 'RETURNED']} /></div>
                {o.status === 'PRESCRIPTION_REVIEW' && <p className="mt-3 rounded-2xl bg-violet-soft p-3 text-sm">A registered pharmacist is checking your prescription. The pharmacy accepts the order once it is approved.</p>}
                {['CANCELLED', 'REJECTED', 'RETURNED'].includes(o.status) && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger">{statusLabel(o.status)}{o.statusReason ? `: ${o.statusReason}` : ''}. Any payment is refunded to the original method.</p>}
              </Card>
              <Card>
                <p className="flex items-center gap-2 text-sm font-extrabold">{o.fulfilment === 'DELIVERY' ? <Home size={16} className="text-primary" /> : <Store size={16} className="text-primary" />} {o.fulfilment === 'DELIVERY' ? `Delivery to PIN ${o.deliveryPincode}` : 'Pick up at the store'}</p>
                <ul className="mt-3 divide-y divide-line text-sm">{o.items.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 py-1.5"><span className="min-w-0"><span className="font-semibold">{medicineLabel(i.medicine.name, i.medicine.strength)}</span> <span className="text-muted">× {i.quantity}</span>{i.medicine.schedule !== 'OTC' && <span className="ml-1.5 align-middle"><Badge tone="violet">Rx</Badge></span>}{i.batchNumber && <span className="block text-xs text-muted">Batch {i.batchNumber}{i.expiryDate ? ` · expires ${monthYear(i.expiryDate)}` : ''}</span>}</span><span className="tnum shrink-0">{money(i.unitPriceMinor * i.quantity)}</span></li>)}<li className="flex justify-between py-1.5 font-extrabold"><span>Total</span><span className="tnum">{money(o.totalMinor)}</span></li></ul>
                {o.transaction && <p className="mt-2 text-xs text-muted">Payment: <Badge tone={o.transaction.status === 'PAID' ? 'success' : 'warning'}>{statusLabel(o.transaction.status)}</Badge></p>}
              </Card>
              <div className="flex flex-wrap gap-2">
                <a href={`/providers/${o.provider.id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold shadow-card"><MapPin size={14} /> Store details</a>
                {['PLACED', 'PRESCRIPTION_REVIEW', 'ACCEPTED'].includes(o.status) && <Button variant="ghost" className="text-danger" onClick={() => setCancelling(true)}>Cancel order</Button>}
              </div>
              <p className="flex items-center gap-1 text-xs text-muted"><Pill size={12} /> Prices never exceed MRP. Schedule H and H1 medicines are dispensed only against a pharmacist-approved prescription.</p>
            </>
          )}
        </div>
        <Sheet open={cancelling} onClose={() => setCancelling(false)} title="Cancel this order?" description="Reserved stock goes back to the pharmacy. Any payment is refunded." footer={<><Button variant="secondary" onClick={() => setCancelling(false)}>Keep order</Button><Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>Cancel order</Button></>}>
          <Textarea aria-label="Reason for cancelling (optional)" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Sheet>
      </RequireSignIn>
    </AppShell>
  );
}
