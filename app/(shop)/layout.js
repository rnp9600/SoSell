import { currentUser, roleOf } from '@/lib/supabase/server';
import { getCatalogue, visible } from '@/lib/catalogue';
import { SessionProvider } from '@/lib/session';
import { SavedProvider } from '@/lib/saved';
import { CartProvider } from '@/lib/cart';
import { TabBar } from '@/components/pm/tab-bar';
import { CartBar } from '@/components/pm/cart-bar';

/** The shop shell.
 *
 *  The catalogue is fetched ONCE here and handed to the cart provider, because
 *  a cart line stores only {slug, size, qty} and has to resolve against the
 *  live catalogue to know a name or a price. Fetching it per screen would mean
 *  the cart bar and the page it sits over could disagree about a rate.
 */
export default async function ShopLayout({ children }) {
  const me = await currentUser();
  const { products } = await getCatalogue();
  const shown = visible(products);

  const session = {
    role: roleOf(me),
    phone: me?.phone || null,
    row: me?.row || null,
  };

  return (
    <SessionProvider value={session}>
      <SavedProvider>
        <CartProvider products={shown}>
          {/* pb-dock reserves the tab bar, the safe area, and the cart bar
              when one is showing — see components/pm/cart-bar.jsx. */}
          <div className="mx-auto min-h-dvh max-w-page pb-dock">{children}</div>
          <CartBar />
          <TabBar />
        </CartProvider>
      </SavedProvider>
    </SessionProvider>
  );
}
