import { cn } from '@/lib/utils';

/** How overdue an account is.
 *
 *  Five buckets, matching catalog.aging_tier() exactly — the label comes from
 *  the database, this only decides how it looks. Critical is a WARNING, never
 *  a block: it has never stopped a sale and must not start.
 *
 *  Since the FIFO fix these tiers mean what they say. Before it, aging ran
 *  from the oldest invoice ever raised, so a customer who paid on time for two
 *  years still showed Critical — the flag fired hardest on the best customers.
 */
const TIERS = {
  'On Track':     { cls: 'bg-ok-wash text-ok',       dot: 'bg-ok' },
  'Due Soon':     { cls: 'bg-warn-wash text-warn',   dot: 'bg-warn' },
  'Please Clear': { cls: 'bg-bad-wash text-bad',     dot: 'bg-bad' },
  'Overdue':      { cls: 'bg-bad-wash text-bad',     dot: 'bg-bad' },
  'Critical':     { cls: 'bg-ink text-surface',      dot: 'bg-surface' },
};

export function AgingBadge({ tier, days, className }) {
  const t = TIERS[tier] || TIERS['On Track'];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
        t.cls, className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', t.dot)} />
      {tier}
      {days > 0 && <span className="font-normal opacity-80">· {days}d</span>}
    </span>
  );
}
