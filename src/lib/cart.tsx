'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { stored, useStored } from './stored';

/**
 * Medicine basket. One pharmacy at a time (an order goes to one store), kept
 * in the browser until it is placed. Prices are re-checked by the API at
 * checkout; what is shown here is the price seen when the item was added.
 * Read after hydration through an external store (see stored.ts), so a saved
 * basket never causes a hydration mismatch.
 */
export interface CartLine { medicineId: string; name: string; strength: string | null; packSize: string | null; requiresPrescription: boolean; unitPriceMinor: number; quantity: number }
export interface Cart { pharmacyId: string; pharmacyName: string; locationId: string; lines: CartLine[] }
interface CartState { cart: Cart | null; add: (pharmacy: { id: string; name: string; locationId: string }, line: Omit<CartLine, 'quantity'>, quantity?: number) => 'added' | 'replaced'; setQuantity: (medicineId: string, quantity: number) => void; clear: () => void; totalMinor: number; count: number; needsPrescription: boolean }

const store = stored<Cart>('carevanta.cart');
const Ctx = createContext<CartState | null>(null);
const persist = (c: Cart | null) => store.set(c && c.lines.length ? c : null);

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useStored(store);
  const value = useMemo<CartState>(() => {
    const lines = cart?.lines ?? [];
    return {
      cart,
      add: (pharmacy, line, quantity = 1) => {
        const current = store.get();
        const replaced = !!current && current.pharmacyId !== pharmacy.id;
        const base: Cart = !current || replaced ? { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, locationId: pharmacy.locationId, lines: [] } : current;
        const existing = base.lines.find((l) => l.medicineId === line.medicineId);
        const next = existing ? base.lines.map((l) => (l.medicineId === line.medicineId ? { ...l, quantity: Math.min(100, l.quantity + quantity) } : l)) : [...base.lines, { ...line, quantity }];
        persist({ ...base, lines: next });
        return replaced ? 'replaced' : 'added';
      },
      setQuantity: (medicineId, quantity) => {
        const current = store.get();
        if (!current) return;
        persist({ ...current, lines: quantity <= 0 ? current.lines.filter((l) => l.medicineId !== medicineId) : current.lines.map((l) => (l.medicineId === medicineId ? { ...l, quantity: Math.min(100, quantity) } : l)) });
      },
      clear: () => persist(null),
      totalMinor: lines.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0),
      count: lines.reduce((s, l) => s + l.quantity, 0),
      needsPrescription: lines.some((l) => l.requiresPrescription),
    };
  }, [cart]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
