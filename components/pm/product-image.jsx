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
 *  The fallback to a transparent pixel is done TWICE, on purpose. React's
 *  onError below only works once the handler is attached, and on a slow
 *  connection the image has usually already failed by then — so a
 *  capture-phase listener installed before first paint (IMG_FALLBACK in
 *  lib/theme.js) catches those, and this catches everything after hydration.
 *  With only one of the two, a dealer on a bad signal gets the browser's
 *  broken-image glyph, which is the thing the fallback exists to prevent.
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
