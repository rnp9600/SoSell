import { SUPABASE } from '@/lib/config';

/** Where a product photo comes from.
 *
 *  Photos are NOT in this repository. 36 MB in git is permanent — every clone,
 *  every build, forever, and unremovable without rewriting history — and the
 *  Supabase Storage bucket is already CDN-backed. Changing where they come
 *  from is a change to these two functions and nothing else.
 *
 *  Verified 2026-09-06, after the sync Action ran for the first time: the
 *  bucket holds 904 photos and 904 thumbnails, and the filename sets are
 *  byte-for-byte identical to the catalog repo's. All 900 photos the
 *  catalogue references are present, and the old paxton-ci / paxton-alu /
 *  paxton-kw folder names are gone.
 *
 *  Before that it held 897 photos and ZERO thumbnails — the Action had never
 *  actually run, because its SUPABASE_SERVICE_KEY secret was unset and it
 *  warned and skipped exactly as designed. Worth knowing, because the bucket
 *  has drifted once and can drift again: verify the count before assuming,
 *  and keep SOURCE a single switch rather than scattered logic.
 */
const BASE = `${SUPABASE.url}/storage/v1/object/public/${SUPABASE.imageBucket}`;

/** 'bucket' (the default, now that it is verified complete) or 'legacy' —
 *  the origin that served these before, kept as a one-variable escape hatch. */
const SOURCE = process.env.NEXT_PUBLIC_IMAGE_SOURCE || 'bucket';
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
