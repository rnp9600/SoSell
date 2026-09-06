/** SoSell — the one place a name lives.
 *
 *  SoSell is the SOFTWARE. Patel Marketing is the FIRM — the legal name — and
 *  it is what belongs on a receipt, a deposit slip, a printed ledger and the
 *  verification SMS. The two are not interchangeable, and keeping them apart
 *  here means a change of legal name later (an LLP, a Pvt Ltd) is one line
 *  rather than a search across the repository.
 *
 *  Rule of thumb: chrome says SoSell, paperwork says Patel Marketing.
 */

export const APP = {
  name: 'SoSell',
  tagline: 'Wholesale, end to end',
  build: 1,
};

export const FIRM = {
  legalName: 'Patel Marketing',
  trade: 'Wholesale Kitchenware',
  whatsapp: '917892967505',
  site: 'https://patelmarketing-catalog.vercel.app',
};

/** Supabase. The publishable key is meant to be public — it is restricted by
 *  row-level security on the database side, not by being secret. The secret
 *  key is never named here; see lib/supabase/admin.js for where it may appear. */
export const SUPABASE = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  /** Everything this app reads or writes is in `catalog`, not `public`. */
  schema: 'catalog',
  /** Where the product photos are served from. */
  imageBucket: 'catalog-images',
};

/** Five numbers hold a PIN instead of a texted code, so the whole app can be
 *  walked at every level without paying for an SMS each time. They are
 *  ordinary accounts otherwise — a real session, the same database rules — so
 *  what they show is what that kind of customer actually sees.
 *
 *  The PIN is checked by Supabase, not here; this list only decides which
 *  screen to offer. It is OFF in production, because the sign-in screen used
 *  to print these numbers where customers could read them.
 */
export const TEST_NUMBERS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_TEST_NUMBERS === '1';

export const TEST_NUMBERS = TEST_NUMBERS_ENABLED
  ? [
      '919686754020', // admin
      '919686754021', // office staff
      '919686754022', // dealer (retail, Hubli)
      '919686754023', // end customer, belongs to the test dealer
      '919686754024', // end customer, no shop yet
    ]
  : [];

export const isTestNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 && TEST_NUMBERS.some((n) => n.slice(-10) === d);
};
