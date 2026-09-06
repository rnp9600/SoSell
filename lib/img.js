import { SUPABASE } from '@/lib/config';

/** Where a product photo comes from.
 *
 *  Photos are NOT in this repository. 36 MB in git is permanent — every clone,
 *  every build, forever, and unremovable without rewriting history — and the
 *  Supabase Storage bucket is already CDN-backed. Changing where they come
 *  from is a change to these two functions and nothing else.
 *
 *  ⚠ OPEN FINDING (see supabase/SCHEMA.md). Checked 2026-09-05: the bucket
 *  holds 897 photos and ZERO thumbnails, against 914 and 904 in the catalog
 *  repo. Until the sync Action has actually run, THUMB() would 404 for every
 *  product. That is why SOURCE below can fall back to the origin still serving
 *  them today, and why it is a single switch rather than scattered logic.
 */
const BASE = `${SUPABASE.url}/storage/v1/object/public/${SUPABASE.imageBucket}`;

/** 'bucket' once the bucket is verified complete; 'legacy' until then. */
const SOURCE = process.env.NEXT_PUBLIC_IMAGE_SOURCE || 'legacy';
const LEGACY = 'https://patelmarketing-catalog.vercel.app/images';

const root = () => (SOURCE === 'bucket' ? BASE : LEGACY);

/** The full-size photo. `name` is a bucket-relative path with no extension,
 *  e.g. "paxton/px_dosa_tawa". */
export const IMG = (name) => (name ? `${root()}/${name}.jpg` : null);

/** The 300px WebP grid thumbnail, mirroring the photo tree under thumb/. */
export const THUMB = (name) => (name ? `${root()}/thumb/${name}.webp` : null);

/** A 1x1 transparent GIF, so a broken photo leaves a gap rather than a
 *  browser's broken-image glyph. */
export const BLANK =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
