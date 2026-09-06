import { unstable_cache } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import fallback from './fallback.json';

/** The catalogue — read live from the database, with the file as a net.
 *
 *  The catalogue used to publish through a static data.json in git: an admin
 *  edit was not on the site until somebody downloaded the file and uploaded it
 *  to GitHub. Understood and reversible, but it meant a rate change sat unseen
 *  until someone remembered to publish.
 *
 *  catalog.catalogue returns rows shaped exactly like a data.json row, so
 *  reading live needs no translation. The objection that kept it opt-in was a
 *  database round trip on every cold load — which does not apply here, because
 *  the read happens once per revalidation on the server, not once per phone.
 *
 *  The file stays for two reasons worth keeping: if the Supabase project were
 *  ever lost the catalogue is still in git, and a failure here must fall back
 *  to a slightly stale shop rather than to an empty one.
 */

const REVALIDATE = 300; // five minutes, plus on-demand from the admin save

async function fetchLive() {
  const sb = await supabaseServer();
  const { data, error } = await sb.from('catalogue').select('*');
  if (error) throw new Error(`${error.code || ''} ${error.message}`.trim());
  if (!Array.isArray(data)) throw new Error('catalogue did not come back as a list');
  // A truncated read must not be allowed to empty the shop. The real
  // catalogue is 743 products; anything under 50 is a fault, not a small shop.
  if (data.length < 50) throw new Error(`only ${data.length} products came back — that looks wrong`);
  return data;
}

/** Cached, tagged 'catalogue' so an admin save can call revalidateTag and put
 *  the edit on the site immediately — which is what removes the publish step. */
const cachedLive = unstable_cache(fetchLive, ['catalogue'], {
  revalidate: REVALIDATE,
  tags: ['catalogue'],
});

/** Every product. Never throws: a database that cannot be reached gives the
 *  published file, and the caller is told which it got. */
export async function getCatalogue() {
  try {
    const rows = await cachedLive();
    return { products: rows, source: 'live', error: null };
  } catch (e) {
    return {
      products: fallback,
      source: 'file',
      error: e?.message || 'the database was unreachable',
    };
  }
}

/** How the Settings screen describes where the catalogue came from. */
export const sourceLabel = (source, error) =>
  source === 'live'
    ? 'the database'
    : error
      ? 'the published file (database unreachable)'
      : 'the published file';

export async function getProduct(slug) {
  const { products, source } = await getCatalogue();
  return { product: products.find((p) => p.slug === slug) || null, source };
}

/** Products a signed-out reader, or a consumer, must not see at all. */
export const visible = (products) => products.filter((p) => !p.hidden);
