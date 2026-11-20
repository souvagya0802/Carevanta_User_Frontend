'use client';

import Link from 'next/link';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { money } from '@/lib/format';
import { cx } from '@/components/ui/primitives';

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

/** "Basket, 2 items" / "Basket, empty" — the accessible name of the header basket button. */
export const basketLabel = (count: number) => (count > 0 ? `Basket, ${items(count)}` : 'Basket, empty');

/** Header basket button: always shown, with a live item-count badge that hides at 0. 44 px tap target. */
export function BasketLink({ className }: { className?: string }) {
  const { count } = useCart();
  return (
    <Link href="/cart" aria-label={basketLabel(count)} className={cx('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-card', className)}>
      <ShoppingBag size={18} aria-hidden />
      {count > 0 && <span aria-hidden className="tnum absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

/**
 * Phones only: a slim "View Basket" bar that sits just above the bottom navigation and its raised SOS button while the basket has
 * something in it (the page adds matching bottom padding so it never covers content).
 */
export function BasketBar() {
  const { cart, count, totalMinor } = useCart();
  if (!cart || count === 0) return null;
  return (
    <div className="fixed inset-x-2 bottom-[calc(max(10px,env(safe-area-inset-bottom))+104px)] z-40 min-[380px]:inset-x-3 lg:hidden">
      <Link href="/cart" className="mx-auto flex min-h-12 max-w-md items-center gap-3 rounded-[5px] bg-primary px-4 py-2 text-white shadow-float">
        <ShoppingBag size={18} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm"><span className="font-extrabold">View Basket</span><span className="text-white/85"> · {items(count)} · </span><span className="tnum font-bold">{money(totalMinor)}</span></span>
        <ChevronRight size={18} className="shrink-0" aria-hidden />
      </Link>
    </div>
  );
}
