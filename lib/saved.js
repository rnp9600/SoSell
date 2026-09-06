'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { KEYS, read, write } from '@/lib/storage';
import { useSession } from '@/lib/session';

/** The saved list — per account, on the phone, and it works offline.
 *
 *  Keyed by phone so two people sharing a counter tablet do not see each
 *  other's list, and it falls back to a 'guest' list for someone browsing
 *  signed out. Under V3's key, like everything else here.
 */
const SavedContext = createContext(null);

export function SavedProvider({ children }) {
  const { phone } = useSession();
  const key = KEYS.saved(phone);
  const [slugs, setSlugs] = useState([]);

  useEffect(() => {
    const raw = read(key, []);
    setSlugs(Array.isArray(raw) ? raw : []);
  }, [key]);

  const toggle = useCallback(
    (slug) => {
      setSlugs((prev) => {
        const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [slug, ...prev];
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const value = useMemo(
    () => ({ slugs, isSaved: (s) => slugs.includes(s), toggle, count: slugs.length }),
    [slugs, toggle],
  );
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  // A card can legitimately render outside the provider (a print sheet, say);
  // a no-op is better than a crash.
  return ctx || { slugs: [], isSaved: () => false, toggle: () => {}, count: 0 };
}
