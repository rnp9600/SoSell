/** Look at the app in a real browser.
 *
 *  Run:  yarn start   (in another shell)
 *        node tests/visual.mjs [outDir]
 *
 *  Screenshots are not the point — the point is that a page renders with no
 *  console errors, and that switching theme and mode actually repaints. The
 *  eight-block token system is easy to half-apply and hard to notice.
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

/** This sandbox ships its own Chromium under PLAYWRIGHT_BROWSERS_PATH, and it
 *  will not always be the build the installed playwright expects. Point at the
 *  binary that is actually here rather than downloading a second one. */
function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.argv[2] || 'tmp-shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['/', 'home'],
  ['/shop', 'shop'],
  ['/shop/Cast%20Iron', 'category'],
  ['/product/paxton-ci-cast-iron-dosa-tawa', 'product'],
  ['/p/paxton-ci-cast-iron-dosa-tawa', 'share'],
  ['/signin', 'signin'],
];

const exe = chromePath();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const errors = [];
// A blocked photo is the point of the block, not a finding. Everything else is.
const isBlockedImage = (t) => /ERR_FAILED|ERR_BLOCKED|net::/.test(t);
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (isBlockedImage(t)) return;
  errors.push(`${page.url()} :: ${t}`);
});
page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));

/** Product photos live in Supabase Storage, which this sandbox cannot reach —
 *  the connection never opens, so those requests hang rather than failing.
 *  Abort them so the page settles. The <img> onError fallback then does
 *  exactly what it does for a reader with a bad signal, which is worth seeing
 *  rather than avoiding. */
let blocked = 0;
await page.route('**://*.supabase.co/**', (route) => { blocked++; route.abort(); });

for (const [path, name] of PAGES) {
  const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${String(res.status()).padEnd(4)} ${path}`);
}

// Every palette × mode must actually repaint. A theme that half-applies is
// the failure this checks for.
console.log('\nthemes:');
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
for (const theme of ['sky', 'teal', 'emerald', 'charcoal']) {
  for (const mode of ['light', 'dark']) {
    await page.evaluate(([t, m]) => {
      localStorage.setItem('v4_pm_theme', JSON.stringify(t));
      localStorage.setItem('v4_pm_mode', JSON.stringify(m));
    }, [theme, mode]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const s = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        mode: document.documentElement.getAttribute('data-mode'),
        brand: cs.getPropertyValue('--brand').trim(),
        bg: cs.getPropertyValue('--bg').trim(),
        onBrand: cs.getPropertyValue('--on-brand').trim(),
        body: getComputedStyle(document.body).backgroundColor,
      };
    });
    const ok = s.theme === theme && s.mode === mode && s.brand && s.bg && s.onBrand;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${theme}/${mode}  brand:${s.brand}  body:${s.body}`);
    if (!ok) errors.push(`theme ${theme}/${mode} did not apply: ${JSON.stringify(s)}`);
    if (theme === 'teal' && mode === 'dark') {
      await page.screenshot({ path: `${OUT}/home-teal-dark.png` });
    }
  }
}

await browser.close();
console.log(`\n${blocked} image request(s) blocked — this sandbox cannot reach Supabase.`);
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join('\n') : '\nno console errors');
process.exit(errors.length ? 1 : 0);
