'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { rupee } from '@/lib/money';

/** The order in progress, always one press away.
 *
 *  It raises --dock while it is showing, and the page bottom padding reads
 *  --dock. That is why nothing ever lands underneath it — the bar reserves its
 *  own room instead of every screen remembering to leave some.
 *
 *  Hidden on the cart and checkout themselves, where it would be a link to
 *  where you already are.
 */
export function CartBar() {
  const { count, total, hasAsk } = useCart();
  const pathname = usePathname();
  const hide = pathname === '/cart' || pathname === '/checkout' || pathname.startsWith('/placed');
  const show = count > 0 && !hide;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--dock', show ? '60px' : '0px');
    return () => root.style.setProperty('--dock', '0px');
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: 'calc(var(--tabbar) + var(--safe-b) + 8px)' }}
    >
      <Link
        href="/cart"
        className="mx-auto flex h-[52px] max-w-page items-center justify-between gap-3 rounded-full bg-brand px-5 text-on-brand shadow-3"
      >
        <span className="font-semibold">
          {count} {count === 1 ? 'piece' : 'pieces'}
        </span>
        <span className="flex items-center gap-2 font-bold tabular-nums">
          {/* A line with no rate makes the total a partial figure, and saying
              so is better than showing a number that looks complete. */}
          {hasAsk && <span className="text-xs font-medium opacity-80">+ rates to confirm</span>}
          {rupee(total)}
        </span>
      </Link>
    </div>
  );
}
