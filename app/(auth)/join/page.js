import { redirect } from 'next/navigation';
import { currentUser, supabaseServer } from '@/lib/supabase/server';
import JoinForm from './join-form';
import { APP, FIRM } from '@/lib/config';

export const metadata = { title: 'Tell us who you are' };
export const dynamic = 'force-dynamic';

/** Getting in is a QUEUE, not a wall.
 *
 *  The code proves a phone and nothing more. A number with no allowlist row
 *  used to be told "we do not recognise that number" and that was the end of
 *  it — every dealer and every member of staff had to be typed in by an admin,
 *  one at a time. Now they fill this in, somebody in the office decides, and
 *  in the meantime they can browse the whole catalogue. They simply cannot
 *  trade.
 */
export default async function JoinPage() {
  const me = await currentUser();
  if (!me?.authed) redirect('/signin?next=/join');
  if (me.row) redirect('/account');

  const sb = await supabaseServer();
  const [{ data: status }, { data: depts }] = await Promise.all([
    sb.rpc('my_signup_status'),
    sb.from('departments').select('id,label').order('sort'),
  ]);
  const s = Array.isArray(status) ? status[0] : status;

  if (s?.status === 'pending') {
    return (
      <main className="mx-auto max-w-sm px-5 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-ink">We have your details</h1>
        <p className="mt-2 text-ink-2">
          Somebody at {FIRM.legalName} will look at this shortly. You can browse
          the catalogue in the meantime — you will be able to see rates and
          order once you are approved.
        </p>
        <a href="/" className="mt-6 inline-flex min-h-tap items-center rounded-full bg-brand px-6 font-semibold text-on-brand">
          Browse the catalogue
        </a>
      </main>
    );
  }

  if (s?.status === 'rejected') {
    return (
      <main className="mx-auto max-w-sm px-5 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-ink">Not approved</h1>
        {s.decided_note && <p className="mt-2 text-ink-2">{s.decided_note}</p>}
        <p className="mt-2 text-ink-2">
          If you think that is a mistake, message {FIRM.legalName} on WhatsApp.
        </p>
        <a href={`https://wa.me/${FIRM.whatsapp}`}
           className="mt-6 inline-flex min-h-tap items-center rounded-full bg-brand px-6 font-semibold text-on-brand">
          Message us
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      <h1 className="text-2xl font-extrabold text-ink">Tell us who you are</h1>
      <p className="mb-6 mt-1 text-ink-2">
        Your number is verified. This is so {FIRM.legalName} knows which
        account to set up.
      </p>
      <JoinForm depts={depts || []} phone={me.phone} />
    </main>
  );
}
