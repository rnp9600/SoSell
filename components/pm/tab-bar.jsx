'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Search, Receipt, User } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/shop', label: 'Shop', icon: LayoutGrid },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/orders', label: 'Orders', icon: Receipt, badge: true },
  { href: '/account', label: 'Account', icon: User },
];

/** Five tabs, in thumb reach.
 *
 *  The cart badge sits on Orders rather than getting a tab of its own: an
 *  order in progress IS an order, and a sixth tab would put every one of them
 *  out of comfortable reach.
 */
export function TabBar() {
  const pathname = usePathname();
  const { count } = useCart();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'var(--safe-b)' }}
    >
      <ul className="mx-auto flex max-w-page">
        {TABS.map(({ href, label, icon: Icon, exact, badge }) => {
          const on = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative flex h-tabbar flex-col items-center justify-center gap-0.5',
                  on ? 'text-brand' : 'text-ink-3',
                )}
              >
                <Icon className="size-5" />
                <span className="text-[0.625rem] font-semibold">{label}</span>
                {badge && count > 0 && (
                  <span className="absolute right-1/2 top-1.5 translate-x-3 rounded-full bg-brand px-1.5 text-[0.625rem] font-bold text-on-brand">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
