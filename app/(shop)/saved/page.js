import { getCatalogue, visible } from '@/lib/catalogue';
import SavedClient from './saved-client';

export const revalidate = 300;
export const metadata = { title: 'Saved' };

export default async function SavedPage() {
  const { products } = await getCatalogue();
  return <SavedClient products={visible(products)} />;
}
