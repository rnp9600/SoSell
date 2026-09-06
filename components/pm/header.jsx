import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A page header. `back` is a real href, not history.back().
 *
 *  A Back arrow that calls history.back() lands somewhere unpredictable when
 *  the page was opened cold from a shared link — which is exactly how most
 *  product links arrive. An href always goes somewhere sensible.
 */
export function Header({ title, back, actions, className }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-header items-center gap-2 border-b border-line bg-surface/95 px-2 backdrop-blur-md',
        className,
      )}
      style={{ paddingTop: 'var(--safe-t)' }}
    >
      {back && (
        <Link
          href={back}
          aria-label="Back"
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <h1 className={cn('flex-1 truncate font-bold text-ink', !back && 'pl-3')}>{title}</h1>
      {actions && <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div>}
    </header>
  );
}
