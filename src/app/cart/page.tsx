'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Home, Minus, Plus, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAttempt } from '@/lib/attempt';
import { useCart } from '@/lib/cart';
import { useAction, useGet } from '@/lib/hooks';
import { medicineLabel, money } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { PrescriptionPicker, usePrescriptions } from '@/components/prescriptions';
import type { ProviderProfile } from '@/app/providers/[id]/page';
import { Badge, Button, Card, EmptyState, Field, Input, OptionCard, PageTitle, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Profile { id: string; fullName: string; relationship: string }

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const pharmacy = useGet<ProviderProfile>(cart.cart ? `/discovery/providers/${cart.cart.pharmacyId}` : null);
  const profiles = useGet<Profile[]>(me && cart.cart ? '/patient/profiles' : null);
  const [profileId, setProfileId] = useState('');
  const activeProfile = profileId || profiles.data?.find((p) => p.relationship === 'SELF')?.id || '';
  const activeProfileName = profiles.data?.find((p) => p.id === activeProfile)?.fullName ?? 'this patient';
  const rx = usePrescriptions(activeProfile, !!me && cart.needsPrescription);
  const [fulfilment, setFulfilment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [pincode, setPincode] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [rxId, setRxId] = useState('');
  const [rxError, setRxError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; reference: string; status: string } | null>(null);
  const attempt = useAttempt('rx');
  const delivers = !!pharmacy.data?.pharmacy?.homeDeliveryAvailable;
  const activeRx = cart.needsPrescription ? (rx.usable.some((r) => r.id === rxId) ? rxId : rx.usable[0]?.id ?? '') : '';

  const body = () => ({ patientProfileId: activeProfile, providerId: cart.cart!.pharmacyId, locationId: cart.cart!.locationId, fulfilment, deliveryPincode: fulfilment === 'DELIVERY' ? pincode : undefined, prescriptionId: cart.needsPrescription ? activeRx : undefined, items: cart.cart!.lines.map((l) => ({ medicineId: l.medicineId, quantity: l.quantity })) });
  // One random Idempotency-Key per checkout attempt (lib/attempt.ts): a retry or double tap reuses it,
  // a changed basket or a new order after this one gets a new key, so a repeat order is never replayed.
  const place = useAction(() => { const b = body(); return attempt.run(JSON.stringify(b), (key) => api.post<{ data: { id: string; reference: string; status: string } }>('/patient/pharmacy-orders', b, key)); }, {
    onSuccess: (r) => { setDone(r.data); cart.clear(); toast.success(r.data.status === 'PRESCRIPTION_REVIEW' ? 'Order placed — awaiting the pharmacist' : 'Order placed'); },
    onError: (e) => {
      if (e instanceof ApiError && /PIN/i.test(e.message)) setPinError(e.message);
      else if (e instanceof ApiError && /prescription/i.test(e.message)) setRxError(e.message);
      else toast.error(e);
    },
  });

  if (done) {
    return (
      <AppShell>
        <Card className="animate-scale-in mx-auto max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 size={34} aria-hidden /></span>
          <h2 className="mt-3 text-xl font-extrabold">{done.status === 'PRESCRIPTION_REVIEW' ? 'Order placed, prescription under review' : 'Order placed'}</h2>
          <p className="mt-1 text-sm text-muted">Reference <span className="font-mono font-semibold text-ink">{done.reference}</span>. The pharmacy accepts it next; you will be told when it is ready{fulfilment === 'DELIVERY' ? ' or out for delivery' : ' for pickup'}.</p>
          <div className="mt-5 grid gap-2"><Link href={`/orders/medicine/${done.id}`}><Button full>Track Order</Button></Link><Link href="/pharmacy"><Button full variant="ghost">Order More</Button></Link></div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle title="Your Basket" subtitle={cart.cart ? `From ${cart.cart.pharmacyName}` : undefined} />
      {!cart.cart ? <EmptyState icon={ShoppingBag} title="Your basket is empty" description="Search a medicine and choose a pharmacy that has it in stock." action={<Link href="/pharmacy"><Button>Find Medicines</Button></Link>} /> : (
        <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card padded={false}>
              <ul className="divide-y divide-line">
                {cart.cart.lines.map((l) => (
                  <li key={l.medicineId} className="flex items-center gap-2 p-3 min-[380px]:gap-3 min-[380px]:p-4">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{medicineLabel(l.name, l.strength)}</span><span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted"><span>{l.packSize ? `Pack of ${l.packSize} · ` : ''}{money(l.unitPriceMinor)} each</span>{l.requiresPrescription && <Badge tone="violet">Rx</Badge>}</span></span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-soft p-0.5"><button type="button" aria-label={l.quantity === 1 ? `Remove ${l.name}` : `One less ${l.name}`} onClick={() => cart.setQuantity(l.medicineId, l.quantity - 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card">{l.quantity === 1 ? <Trash2 size={14} className="text-danger" /> : <Minus size={14} />}</button><span className="tnum w-6 text-center text-sm font-bold">{l.quantity}</span><button type="button" aria-label={`One more ${l.name}`} onClick={() => cart.setQuantity(l.medicineId, l.quantity + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><Plus size={14} /></button></span>
                    <span className="tnum hidden w-20 text-right text-sm font-extrabold min-[380px]:block">{money(l.unitPriceMinor * l.quantity)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <RequireSignIn message="Sign in so the order is saved and the pharmacy can reach you.">
              <section>
                <p className="mb-2 text-sm font-extrabold">Who is this for?</p>
                {profiles.isPending ? <Skeleton rows={2} /> : <div className="grid gap-2">{(profiles.data ?? []).map((p) => <OptionCard key={p.id} selected={activeProfile === p.id} onSelect={() => { setProfileId(p.id); setRxId(''); setRxError(null); }} title={p.fullName} description={p.relationship === 'SELF' ? 'You' : p.relationship.toLowerCase()} />)}</div>}
              </section>
              <section>
                <p className="mb-2 text-sm font-extrabold">Pickup or delivery</p>
                <div className="grid gap-2">
                  <OptionCard selected={fulfilment === 'PICKUP'} onSelect={() => { setFulfilment('PICKUP'); setPinError(null); }} title="Pick up at the store" description={pharmacy.data?.locations[0] ? `${pharmacy.data.locations[0].addressLine1}, ${pharmacy.data.locations[0].locality ?? pharmacy.data.locations[0].city}` : 'Pay at the counter'} right={<Store size={18} className="text-muted" aria-hidden />} />
                  <OptionCard selected={fulfilment === 'DELIVERY'} onSelect={() => setFulfilment('DELIVERY')} disabled={!delivers} title="Home delivery" description={delivers ? 'To a PIN code the pharmacy covers' : 'This pharmacy does not deliver'} right={<Home size={18} className="text-muted" aria-hidden />} />
                </div>
                {fulfilment === 'DELIVERY' && <Field label="Delivery PIN Code" required className="mt-3" error={pinError ?? undefined}><Input inputMode="numeric" maxLength={6} value={pincode} aria-invalid={!!pinError || undefined} onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '')); setPinError(null); }} placeholder="721636" /></Field>}
              </section>
              {cart.needsPrescription && activeProfile && (
                <PrescriptionPicker
                  rx={rx}
                  value={activeRx}
                  onChange={(id) => { setRxId(id); setRxError(null); }}
                  profileId={activeProfile}
                  profileName={activeProfileName}
                  intro="Schedule H and H1 medicines need a doctor's prescription, which a registered pharmacist checks before dispensing. Choose one or upload a clear photo or PDF."
                  error={rxError}
                />
              )}
            </RequireSignIn>
          </div>
          <aside>
            <Card className="sticky top-24">
              <p className="text-sm font-extrabold">Summary</p>
              <dl className="mt-2 space-y-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Items ({cart.count})</dt><dd className="tnum font-semibold">{money(cart.totalMinor)}</dd></div><div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="tnum font-semibold">{fulfilment === 'DELIVERY' ? 'Set by pharmacy' : '—'}</dd></div><div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-extrabold">Total</dt><dd className="tnum font-extrabold">{money(cart.totalMinor)}</dd></div></dl>
              <p className="mt-2 text-xs text-muted">Final price is confirmed by the pharmacy from the batch dispensed; it never exceeds MRP.</p>
              {me && <Button full size="lg" className="mt-3" onClick={() => { if (!attempt.busy) place.mutate(); }} loading={place.isPending} disabled={!activeProfile || (fulfilment === 'DELIVERY' && !/^[1-9][0-9]{5}$/.test(pincode)) || (cart.needsPrescription && !activeRx)}>Place Order</Button>}
              <button type="button" className="mt-2 flex min-h-11 w-full items-center justify-center text-xs font-semibold text-muted" onClick={() => { cart.clear(); router.push('/pharmacy'); }}>Empty basket</button>
            </Card>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
