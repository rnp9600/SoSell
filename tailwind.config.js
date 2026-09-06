/** SoSell — Tailwind, wired to the token layer in app/globals.css.
 *
 *  Every colour here is `hsl(var(--x) / <alpha-value>)`, so a utility picks up
 *  whichever of the eight palette blocks is currently in force AND still works
 *  with opacity modifiers (`bg-brand/10`).
 *
 *  Catalog's names and shadcn's names are both exposed, pointing at the same
 *  variables — `text-ink-2` and `text-muted-foreground` produce identical
 *  pixels. That is deliberate: the shadcn components arrive using their own
 *  vocabulary and there is no value in rewriting 48 files, but anything
 *  written here should prefer the catalog names, which say what the colour is
 *  FOR rather than what shadcn happened to call it.
 */
const c = (v) => `hsl(var(--${v}) / <alpha-value>)`;

module.exports = {
  // Catalog switches on data-mode; shadcn's components use `dark:` utilities.
  // This makes them the same switch, so neither has to know about the other.
  darkMode: ['variant', '&:where([data-mode="dark"] *)'],
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
    './hooks/**/*.{js,jsx}',
  ],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1180px' } },
    extend: {
      colors: {
        // ---- catalog's vocabulary: what the colour is for ----
        brand: { DEFAULT: c('brand'), ink: c('brand-ink'), wash: c('brand-wash') },
        'on-brand': c('on-brand'),
        gold: { DEFAULT: c('gold'), wash: c('gold-wash') },
        surface: { DEFAULT: c('surface'), 2: c('surface-2') },
        line: { DEFAULT: c('line'), strong: c('line-strong') },
        ink: { DEFAULT: c('ink'), 2: c('ink-2'), 3: c('ink-3') },
        ok: { DEFAULT: c('ok'), wash: c('ok-wash') },
        warn: { DEFAULT: c('warn'), wash: c('warn-wash') },
        bad: { DEFAULT: c('bad'), wash: c('bad-wash') },

        // ---- shadcn's vocabulary: same variables, derived in globals.css ----
        background: c('background'),
        foreground: c('foreground'),
        border: c('border'),
        input: c('input'),
        ring: c('ring'),
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
        popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') },
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        full: 'var(--r-full)',
      },
      boxShadow: { 1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)' },
      fontFamily: { sans: 'var(--sans)', mono: 'var(--mono)' },
      // The bars the layout reserves room for, so a screen can say
      // `pb-dock` instead of re-deriving the arithmetic.
      spacing: {
        tabbar: 'var(--tabbar)',
        header: 'var(--header)',
        dock: 'calc(var(--dock) + var(--tabbar) + var(--safe-b))',
        'safe-b': 'var(--safe-b)',
        'safe-t': 'var(--safe-t)',
      },
      maxWidth: { page: 'var(--page)' },
      // 44px is the floor on anything you press. It is not a suggestion —
      // essentially every customer is on a phone, using a thumb.
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      keyframes: {
        'accordion-down': { from: { height: 0 }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: 0 } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
      },
      animation: {
        'accordion-down': 'accordion-down .2s ease-out',
        'accordion-up': 'accordion-up .2s ease-out',
        'sheet-up': 'sheet-up .24s cubic-bezier(.32,.72,0,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
