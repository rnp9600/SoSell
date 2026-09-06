import { getCatalogue, visible } from '@/lib/catalogue';
import CartClient from './cart-client';

export const revalidate = 300;
export const metadata = { title: 'Your order' };

export default async function CartPage() {
  const { products } = await getCatalogue();
  return <CartClient products={visible(products)} />;
}
