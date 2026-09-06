import { cn } from '@/lib/utils';

/** Nothing here — said in a way that suggests what to do next. */
export function Empty({ icon: Icon, title, body, action, className }) {
  return (
    <div className={cn('grid place-items-center px-6 py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-surface-2 text-ink-3">
          <Icon className="size-6" />
        </div>
      )}
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {body && <p className="mt-1 max-w-sm text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
