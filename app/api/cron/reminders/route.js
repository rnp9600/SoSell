import { supabaseAdmin } from '@/lib/supabase/admin';
import { rupee } from '@/lib/money';
import { currentFY } from '@/lib/fy';

/** The aging reminder ladder.
 *
 *  The prototype had eighteen editable templates including a full
 *  aging_30/60/75/90/120/180 ladder — and no scheduler, and no code that read
 *  a template when sending. Every notification passed a hardcoded string. The
 *  ladder was documentation of an intention.
 *
 *  This is the intention, built. Once a day it finds every customer whose
 *  aging has crossed a rung they have not been told about this financial year,
 *  renders the office's own wording through catalog.render_template(), and
 *  sends it.
 *
 *  Two things stop it becoming a nuisance:
 *
 *  · reminder_log is keyed on (customer, rung, financial year), so a 200-day
 *    customer is told once at each rung and not every morning forever.
 *  · It sends the HIGHEST rung crossed, not all of them, so nobody gets six
 *    messages the first time the job runs.
 *
 *  Service role, because it acts as nobody — there is no session behind a
 *  cron. Guarded by CRON_SECRET in constant time.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RUNGS = [180, 120, 90, 75, 60, 30]; // highest first

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export async function POST(request) {
  if (!authorised(request)) return new Response('Not authorised', { status: 401 });
  const dry = new URL(request.url).searchParams.get('dry') === '1';

  const sb = supabaseAdmin();
  const fy = currentFY();

  const { data: balances, error } = await sb
    .from('customer_balances')
    .select('customer_phone,display,outstanding,aging_days,reminder_only');
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const { data: already } = await sb
    .from('reminder_log').select('customer_phone,rung').eq('fy', fy);
  const sentBefore = new Set((already || []).map((r) => `${r.customer_phone}:${r.rung}`));

  const due = [];
  for (const b of balances || []) {
    if (Number(b.outstanding) <= 0) continue;
    // The highest rung they have crossed — not every rung below it, or the
    // first run would send six messages to the same person.
    const rung = RUNGS.find((r) => b.aging_days >= r);
    if (!rung) continue;
    if (sentBefore.has(`${b.customer_phone}:${rung}`)) continue;
    due.push({ ...b, rung });
  }

  if (dry) {
    return Response.json({
      ok: true, dry: true, would_send: due.length,
      sample: due.slice(0, 10).map((d) => ({
        who: d.display, days: d.aging_days, rung: d.rung, owes: rupee(d.outstanding),
      })),
    });
  }

  let sent = 0;
  for (const d of due) {
    const { data: rendered } = await sb.rpc('render_template', {
      p_key: `aging_${d.rung}`,
      p_vars: { customer_name: d.display, amount: rupee(d.outstanding) },
    });
    const t = rendered?.[0];
    if (!t) continue;

    const { error: sendErr } = await sb.rpc('notify_people', {
      p_kind: `aging_${d.rung}`,
      p_title: t.title,
      p_body: t.body,
      p_url: '/account/ledger',
      p_phones: [d.customer_phone],
    });
    if (sendErr) continue;

    await sb.from('reminder_log').insert({
      customer_phone: d.customer_phone, rung: d.rung, fy,
    });
    sent++;
  }

  return Response.json({ ok: true, considered: (balances || []).length, sent });
}
