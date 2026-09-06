import Link from 'next/link';
import { Check, AlertTriangle, Home } from 'lucide-react';
import { FIRM } from '@/lib/config';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Order placed' };

/** The confirmation.
 *
 *  DELIBERATELY NO BACK ARROW. Going back from here lands on an emptied
 *  checkout and invites someone to place the same order twice. The only way
 *  out is forward — home, or the order itself.
 */
export default async function PlacedPage({ params, searchParams }) {
  const { ref } = await params;
  const sp = await searchParams;
  const recorded = sp?.recorded !== '0';

  const wa = `https://wa.me/${FIRM.whatsapp}?text=${encodeURIComponent(
    recorded
      ? `Order ${ref} placed. Please confirm.`
      : `Order ${ref} — this did not reach your system. Sending it here instead.`,
  )}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10 text-center">
      <div
        className={`mx-auto grid size-16 place-items-center rounded-full ${
          recorded ? 'bg-ok-wash text-ok' : 'bg-warn-wash text-warn'
        }`}
      >
        {recorded ? <Check className="size-8" /> : <AlertTriangle className="size-8" />}
      </div>

      <h1 className="mt-5 text-2xl font-extrabold text-ink">
        {recorded ? 'Order placed' : 'Not recorded'}
      </h1>

      <p className="mt-2 font-mono text-lg font-bold text-brand">{ref}</p>

      <p className="mt-3 text-ink-2">
        {recorded
          ? `${FIRM.legalName} has it. We will confirm the rates and let you know when it is packed.`
          : `We could not reach our system, so this order has NOT been received. Your reference is above — please send it on WhatsApp and we will enter it.`}
      </p>

      <div className="mt-7 space-y-2">
        {!recorded && (
          <Button asChild size="lg" block>
            <a href={wa}>Send it on WhatsApp</a>
          </Button>
        )}
        {recorded && (
          <Button asChild size="lg" block>
            <Link href={`/orders/${ref}`}>See this order</Link>
          </Button>
        )}
        <Button asChild variant="secondary" size="lg" block>
          <Link href="/">
            <Home className="size-4" />
            Back to the shop
          </Link>
        </Button>
      </div>
    </main>
  );
}
