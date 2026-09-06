'use client';

import { useEffect, useState } from 'react';
import { THEMES, MODES, FONT_SIZES } from '@/lib/theme';
import { KEYS, read, write } from '@/lib/storage';
import { APP, FIRM } from '@/lib/config';
import { cn } from '@/lib/utils';

/** Two orthogonal choices, not one list.
 *
 *  V3 conflated them — "charcoal" WAS the dark theme — so choosing dark meant
 *  giving up your colour, and there was no way to have sky at night. Keeping
 *  them separate is the whole reason there are eight token blocks rather than
 *  five.
 */
function Row({ label, hint, children }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <h2 className="font-bold text-ink">{label}</h2>
      {hint && <p className="mb-3 text-sm text-ink-2">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function SettingsClient() {
  const [theme, setTheme] = useState('sky');
  const [mode, setMode] = useState('auto');
  const [fs, setFs] = useState('m');
  const [motion, setMotion] = useState('full');

  useEffect(() => {
    setTheme(read(KEYS.theme, 'sky'));
    setMode(read(KEYS.mode, 'auto'));
    setFs(read(KEYS.fontSize, 'm'));
    setMotion(read(KEYS.motion, 'full'));
  }, []);

  function apply(next) {
    const d = document.documentElement;
    if (next.theme !== undefined) {
      setTheme(next.theme); write(KEYS.theme, next.theme);
      d.setAttribute('data-theme', next.theme);
    }
    if (next.mode !== undefined) {
      setMode(next.mode); write(KEYS.mode, next.mode);
      // "auto" is RESOLVED here and never stamped on the DOM — a component
      // must never have to ask what auto currently means.
      const dark = next.mode === 'dark' ||
        (next.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      d.setAttribute('data-mode', dark ? 'dark' : 'light');
    }
    if (next.fs !== undefined) {
      setFs(next.fs); write(KEYS.fontSize, next.fs);
      next.fs === 'm' ? d.removeAttribute('data-fs') : d.setAttribute('data-fs', next.fs);
    }
    if (next.motion !== undefined) {
      setMotion(next.motion); write(KEYS.motion, next.motion);
      next.motion === 'none' ? d.setAttribute('data-motion', 'none') : d.removeAttribute('data-motion');
    }
    // Keep Android's browser chrome in step with the page it is sitting above.
    const surface = getComputedStyle(d).getPropertyValue('--surface').trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && surface) meta.content = `hsl(${surface})`;
  }

  const Chip = ({ on, ...props }) => (
    <button type="button" {...props}
            className={cn('min-h-tap rounded-full border px-4 text-sm font-semibold',
              on ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink-2')} />
  );

  return (
    <div>
      <Row label="Colour">
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <Chip key={t.id} on={theme === t.id} onClick={() => apply({ theme: t.id })}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Row>

      <Row label="Light or dark" hint="Auto follows your phone.">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip key={m.id} on={mode === m.id} onClick={() => apply({ mode: m.id })}>
              {m.label}
            </Chip>
          ))}
        </div>
      </Row>

      <Row label="Reading size"
           hint="Everything scales together — prices, headings and buttons.">
        <div className="flex flex-wrap gap-2">
          {FONT_SIZES.map((f) => (
            <Chip key={f.id} on={fs === f.id} onClick={() => apply({ fs: f.id })}>
              {f.label}
            </Chip>
          ))}
        </div>
      </Row>

      <Row label="Movement" hint="Turn this off if animation makes you uncomfortable.">
        <div className="flex flex-wrap gap-2">
          <Chip on={motion === 'full'} onClick={() => apply({ motion: 'full' })}>Normal</Chip>
          <Chip on={motion === 'none'} onClick={() => apply({ motion: 'none' })}>Reduced</Chip>
        </div>
      </Row>

      <p className="px-5 py-6 text-center text-sm text-ink-3">
        {FIRM.legalName} · {APP.name} · build {APP.build}
      </p>
    </div>
  );
}
