/** The Indian financial year: 1 April to 31 March.
 *
 *  Mirrors catalog.fy_of() and catalog.fy_start() in SQL. The arithmetic that
 *  matters — receipt numbering, opening balances, aging — is done in Postgres,
 *  where there is one copy of it. These exist so a screen can LABEL a year
 *  ("FY 2026-27") without asking the database.
 */

export function currentFY(d = new Date()) {
  // getMonth() is 0-based, so 3 is April.
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export const fyStart = (fy) => new Date(fy, 3, 1);
export const fyEnd = (fy) => new Date(fy + 1, 2, 31);

/** "FY 2026-27" */
export const fyLabel = (fy = currentFY()) =>
  `FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`;

/** Opening balances are always stated as of 1 April. */
export const openingAsOfLabel = (fy = currentFY()) => `as of 1 April ${fy}`;
