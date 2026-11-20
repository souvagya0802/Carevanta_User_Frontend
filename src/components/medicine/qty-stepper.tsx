'use client';

import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { MAX_QUANTITY, useCart } from '@/lib/cart';
import { medicineLabel } from '@/lib/format';
import { Button, cx, Sheet } from '@/components/ui/primitives';
import type { ProviderHit } from '@/components/provider-card';
import { useAddMedicineToCart } from './medicine-ui';

/**
 * − count + for one basket line. − at 1 removes the line (shown as a bin); + stops at the basket's
 * maximum. Both buttons are 44 px tap targets.
 */
export function QtyStepper({ quantity, name, onChange, className }: { quantity: number; name: string; onChange: (quantity: number) => void; className?: string }) {
  return (
    <span className={cx('flex shrink-0 items-center gap-1 rounded-full bg-soft p-0.5', className)}>
      <button type="button" aria-label={quantity === 1 ? `Remove ${name}` : `One less ${name}`} onClick={() => onChange(quantity - 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card">
        {quantity === 1 ? <Trash2 size={14} className="text-danger" aria-hidden /> : <Minus size={14} aria-hidden />}
      </button>
      <span className="tnum w-6 text-center text-sm font-bold" aria-live="polite"><span className="sr-only">Quantity </span>{quantity}</span>
      <button type="button" aria-label={`One more ${name}`} disabled={quantity >= MAX_QUANTITY} onClick={() => onChange(quantity + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card disabled:opacity-40">
        <Plus size={14} aria-hidden />
      </button>
    </span>
  );
}

/** Stepper for a medicine already in the basket (any card that knows the medicine id); nothing when it is not in the basket. */
export function CartLineStepper({ medicineId, className }: { medicineId: string; className?: string }) {
  const cart = useCart();
  const line = cart.cart?.lines.find((l) => l.medicineId === medicineId);
  if (!line) return null;
  return <QtyStepper quantity={line.quantity} name={line.name} onChange={(n) => cart.setQuantity(medicineId, n)} className={className} />;
}

type AddableMedicine = Parameters<ReturnType<typeof useAddMedicineToCart>['add']>[1];

/**
 * "Add" for a medicine at one pharmacy, replaced in place by the − count + stepper once it is in the basket.
 * A basket holds one pharmacy: adding from another pharmacy first asks before the current basket is emptied.
 */
export function AddToBasketControl({ shop, medicine }: { shop: ProviderHit; medicine: AddableMedicine }) {
  const cart = useCart();
  const { add, adding } = useAddMedicineToCart();
  const [confirming, setConfirming] = useState(false);
  const line = cart.cart?.pharmacyId === shop.id ? cart.cart.lines.find((l) => l.medicineId === medicine.id) : undefined;
  if (line) return <QtyStepper quantity={line.quantity} name={line.name} onChange={(n) => cart.setQuantity(medicine.id, n)} />;
  const other = cart.cart && cart.cart.pharmacyId !== shop.id ? cart.cart : null;
  return (
    <>
      <Button size="sm" className="min-w-[88px]" aria-label={`Add ${medicineLabel(medicine.name, medicine.strength)} from ${shop.name}`} onClick={() => (other ? setConfirming(true) : void add(shop, medicine))} loading={adding === shop.id}>Add</Button>
      {other && (
        <Sheet
          open={confirming}
          onClose={() => setConfirming(false)}
          title="Start A New Basket?"
          description="A basket holds medicines from one pharmacy."
          footer={<><Button variant="secondary" onClick={() => setConfirming(false)}>Keep My Basket</Button><Button onClick={() => { setConfirming(false); void add(shop, medicine); }}>Start New Basket</Button></>}
        >
          <p>Your basket has {other.lines.length} {other.lines.length === 1 ? 'medicine' : 'medicines'} from <span className="font-semibold">{other.pharmacyName}</span>. Adding {medicineLabel(medicine.name, medicine.strength)} from <span className="font-semibold">{shop.name}</span> empties it and starts a new one.</p>
        </Sheet>
      )}
    </>
  );
}
