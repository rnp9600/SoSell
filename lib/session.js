'use client';

import { createContext, useContext } from 'react';

/** Who is reading, handed down from the server.
 *
 *  The role comes from catalog.allowlist, resolved on the server, and is used
 *  only to decide what to DRAW. It never decides what is ALLOWED — row-level
 *  security does that, and a client that lied about its role would simply get
 *  nothing back from the database.
 */
const SessionContext = createContext({ role: 'guest', phone: null, row: null });

export function SessionProvider({ value, children }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

export const useRole = () => useSession().role;
export const useCanOrder = () => ['dealer', 'shop_owner'].includes(useSession().role);
export const useIsOffice = () => {
  const s = useSession();
  return !!s.row?.is_admin || s.role === 'staff';
};
