import { redirect } from 'next/navigation';
import { currentUser, roleOf } from '@/lib/supabase/server';
import { getCatalogue, visible } from '@/lib/catalogue';
import CheckoutClient from './checkout-client';

export const revalidate = 300;
export const metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const me = await currentUser();
  if (!me?.row) redirect('/signin?next=/checkout');
  // Office staff never order — an order they placed would be addressed to
  // themselves. The database refuses it too; this just avoids the dead end.
  if (!['dealer', 'shop_owner'].includes(roleOf(me))) redirect('/cart');

  const { products } = await getCatalogue();
  const row = me.row;
  return (
    <CheckoutClient
      products={visible(products)}
      prefill={{
        name: row.name || '',
        shop: row.shop || row.nickname || '',
        phone: String(row.phone || '').slice(-10),
      }}
    />
  );
}
