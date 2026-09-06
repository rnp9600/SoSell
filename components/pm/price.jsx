import { cn } from '@/lib/utils';

/** Renders the four shapes priceView() returns, and nothing else.
 *
 *  Every price in the app comes through here, so the rules hold everywhere at
 *  once:
 *
 *    · A missing rate is `—`, never ₹0 and never ₹NaN.
 *    · MRP is struck through only when it is genuinely higher than what this
 *      reader pays. It is a PRINTED price — where the supplier gave none, we
 *      show none rather than inventing one.
 *    · Signed out, there is a price but it is not yours yet. Say that, rather
 *      than pretending the product has no rate.
 */
export function Price({ view, size = 'md', className }) {
  if (!view) return <span className="text-ink-3">—</span>;

  const big = size === 'lg';
  const now = cn('font-bold tabular-nums text-ink', big ? 'text-2xl' : 'text-base');

  if (view.locked) {
    return (
      <span className={cn('inline-flex flex-col gap-0.5', className)}>
        <span className={cn('font-semibold text-ink-2', big ? 'text-lg' : 'text-sm')}>
          Sign in for rates
        </span>
        {view.was && (
          <span className="text-xs text-ink-3">MRP {view.was}</span>
        )}
      </span>
    );
  }

  if (view.ask) {
    // Not a failure — a question worth asking. 127 products are priced this way.
    return (
      <span className={cn('font-semibold text-ink-2', big ? 'text-lg' : 'text-sm', className)}>
        {view.ask}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={now}>{view.now}</span>
      {view.was && (
        <span className="text-sm text-ink-3 line-through tabular-nums">{view.was}</span>
      )}
      {view.tag && (
        <span className="rounded-full bg-gold-wash px-2 py-0.5 text-[0.6875rem] font-semibold text-gold">
          {view.tag}
        </span>
      )}
    </span>
  );
}
