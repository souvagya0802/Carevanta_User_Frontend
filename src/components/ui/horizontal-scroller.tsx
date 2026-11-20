'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './primitives';

/**
 * A row of cards that swipes sideways on phones and becomes a normal grid from
 * `md` up. Uses CSS scroll-snap (no carousel library): each card snaps to the
 * left edge and the next card peeks in, so people can see there is more.
 *
 * - `label` names the region for screen readers ("Top Doctors").
 * - `itemClassName` sets the card width on phones (default 80% so the next card peeks).
 * - `gridClassName` sets the grid from md up (default 3 columns).
 * - `dots` shows position dots under the row on phones.
 * - `grid={false}` keeps it a sideways row on every screen size.
 *
 * Arrow keys scroll when the row has focus; reduced-motion users get instant scrolling.
 */
export function HorizontalScroller({
  children,
  label,
  itemClassName = 'w-[80%] sm:w-[45%]',
  gridClassName = 'md:grid-cols-3',
  grid = true,
  dots = true,
  className,
}: {
  children: ReactNode;
  label: string;
  itemClassName?: string;
  gridClassName?: string;
  grid?: boolean;
  dots?: boolean;
  className?: string;
}) {
  const items = Children.toArray(children).filter(Boolean);
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || !el.firstElementChild) return;
    const width = (el.firstElementChild as HTMLElement).offsetWidth || 1;
    setActive(Math.min(items.length - 1, Math.round(el.scrollLeft / width)));
  }, [items.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  const scrollTo = (i: number) => {
    const el = ref.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollTo(Math.min(items.length - 1, active + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollTo(Math.max(0, active - 1)); }
  };

  return (
    <div className={className}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cx(
          // Phones: one swipeable row with snap points and a hidden scrollbar.
          '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          grid && cx('md:mx-0 md:grid md:snap-none md:overflow-visible md:px-0 md:pb-0', gridClassName),
        )}
      >
        {items.map((child, i) => (
          <div key={i} className={cx('shrink-0 snap-start', itemClassName, grid && 'md:w-auto')}>
            {child}
          </div>
        ))}
      </div>
      {dots && items.length > 1 && (
        <div className={cx('mt-2 flex justify-center gap-1.5', grid && 'md:hidden')} aria-hidden>
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => scrollTo(i)}
              className={cx('h-1.5 rounded-full transition-all', i === active ? 'w-4 bg-primary' : 'w-1.5 bg-line')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
