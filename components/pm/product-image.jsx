'use client';

import { IMG, THUMB, BLANK } from '@/lib/img';
import { cn } from '@/lib/utils';

/** A product photo.
 *
 *  ⚠ A PLAIN <img>, NEVER A <picture>. A 404'd <source> inside a <picture>
 *  does NOT fall back to the <img> — the browser has already committed to the
 *  source it matched. That is how 900 broken thumbnails once shipped, silently,
 *  because the fallback everyone assumed was there does not exist.
 *
 *  onError swaps to a transparent pixel, so a missing photo leaves a clean gap
 *  rather than a browser's broken-image glyph.
 */
export function ProductImage({ name, alt, full = false, className, ...props }) {
  const src = (full ? IMG(name) : THUMB(name)) || BLANK;
  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        if (e.currentTarget.src !== BLANK) e.currentTarget.src = BLANK;
      }}
      className={cn('h-full w-full object-contain', className)}
      {...props}
    />
  );
}
