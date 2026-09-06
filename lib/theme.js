/** Two orthogonal choices, not one list.
 *
 *  The catalogue's V3 conflated them — "charcoal" WAS the dark theme — so
 *  choosing dark meant giving up your colour and there was no way to have sky
 *  at night. They are separate here and must stay separate.
 *
 *    data-theme   sky | teal | emerald | charcoal
 *    data-mode    light | dark      ("auto" is RESOLVED before it is stamped;
 *                                    it is never written to the DOM)
 */
export const THEMES = [
  { id: 'sky', label: 'Sky' },
  { id: 'teal', label: 'Teal' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'charcoal', label: 'Charcoal' },
];

export const MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' },
];

export const FONT_SIZES = [
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Normal' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Largest' },
];

export const DEFAULTS = { theme: 'sky', mode: 'auto', fs: 'm', motion: 'full' };

export const isTheme = (v) => THEMES.some((t) => t.id === v);
export const isMode = (v) => MODES.some((m) => m.id === v);

/** Runs before first paint, inline in <head>, so the server render is already
 *  the right colour and there is no flash of the wrong theme.
 *
 *  It also keeps <meta name="theme-color"> in step with the computed surface,
 *  so Android's browser chrome matches the page rather than sitting in a
 *  stale colour above it.
 */
export const THEME_BOOTSTRAP = `(function(){try{
  var d=document.documentElement, ls=window.localStorage;
  var t=ls.getItem('v4_pm_theme'), m=ls.getItem('v4_pm_mode'),
      f=ls.getItem('v4_pm_fs'), mo=ls.getItem('v4_pm_motion');
  t=t?JSON.parse(t):null; m=m?JSON.parse(m):null;
  f=f?JSON.parse(f):null; mo=mo?JSON.parse(mo):null;
  if(['sky','teal','emerald','charcoal'].indexOf(t)<0) t='sky';
  if(['light','dark','auto'].indexOf(m)<0) m='auto';
  var dark = m==='dark' || (m==='auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  d.setAttribute('data-theme', t);
  d.setAttribute('data-mode', dark?'dark':'light');
  if(f && f!=='m') d.setAttribute('data-fs', f);
  if(mo==='none') d.setAttribute('data-motion','none');
  var c=getComputedStyle(d).getPropertyValue('--surface').trim();
  if(c){ var el=document.querySelector('meta[name="theme-color"]');
    if(!el){el=document.createElement('meta');el.name='theme-color';
      document.head.appendChild(el);} el.content='hsl('+c+')'; }
}catch(e){}})();`;
