import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** ─────────────────────────────────────────────────────────────────────────
 *  THE BUTTON. There is one, and this is it.
 *
 *  Nothing else in this app styles a <button> a person presses to do
 *  something. V3 learned why the hard way: renaming one selector left its
 *  entire checkout — Place this order, Send on WhatsApp, Save the PDF —
 *  completely unstyled, which is what a customer reported as "so basic
 *  design". One implementation means that cannot happen quietly.
 *
 *  Four intents, three sizes. shadcn's stock `outline`, `ghost`, `link`,
 *  `default` and `destructive` are DELETED rather than aliased, so a stray
 *  variant="ghost" fails loudly instead of rendering a fifth kind of button
 *  nobody designed.
 *
 *    primary    the one thing this screen is for
 *    secondary  a real alternative to the primary action
 *    quiet      present but not competing — filters, cancels, "not now"
 *    danger     destructive and irreversible
 *
 *  The 44px floor on `md` is not a suggestion. Essentially every customer is
 *  on a phone, using a thumb, often in a shop with one hand full.
 *  ───────────────────────────────────────────────────────────────────────── */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full ' +
    'font-semibold transition-colors select-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-background ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand hover:bg-brand-ink active:bg-brand-ink',
        secondary:
          'bg-surface-2 text-ink border border-line hover:border-line-strong active:bg-surface',
        quiet: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-2',
        danger: 'bg-bad text-white hover:brightness-95 active:brightness-90',
      },
      size: {
        sm: 'h-[34px] px-3 text-[0.8125rem]',
        md: 'min-h-tap h-11 px-5 text-[0.9375rem]',
        lg: 'h-[52px] px-7 text-base',
        icon: 'size-11 min-w-tap px-0',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

const KNOWN = ['primary', 'secondary', 'quiet', 'danger'];

const Button = React.forwardRef(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    if (process.env.NODE_ENV !== 'production' && variant && !KNOWN.includes(variant)) {
      // Loudly, because the failure mode otherwise is an unstyled button that
      // nobody notices until a customer describes the checkout as broken.
      throw new Error(
        `<Button variant="${variant}"> is not one of ${KNOWN.join(', ')}. ` +
          'SoSell has four button intents; if this needs a fifth, that is a ' +
          'design decision, not a prop.',
      );
    }
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
