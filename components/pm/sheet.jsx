'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

/** A bottom sheet — for a DECISION, never for a destination.
 *
 *  The rule this app keeps: a screen is a route, a sheet is a decision. If
 *  something has state worth going Back to, it gets an address instead. Making
 *  a sheet a route means dismissing it consumes a Back press, which is how the
 *  old build ended up with twelve overlays and a Back button nobody could
 *  predict.
 *
 *  So: the size picker and the sort menu are sheets. The cart is not.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-page',
            'overflow-hidden rounded-t-xl border-t border-line bg-surface shadow-3',
            'data-[state=open]:animate-sheet-up',
          )}
          style={{ paddingBottom: 'var(--safe-b)' }}
        >
          {/* A grab handle, because the gesture is not otherwise discoverable. */}
          <div className="grid place-items-center pt-2">
            <span className="h-1 w-9 rounded-full bg-line-strong" />
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-2">
            <div>
              <Dialog.Title className="text-lg font-bold text-ink">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm text-ink-2">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="close" className="size-5" />
            </Dialog.Close>
          </div>

          <div className="max-h-[60dvh] overflow-y-auto px-5 pb-4">{children}</div>

          {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
