import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { APP } from '@/lib/config';

/** Drain the push outbox.
 *
 *  This is one of the three places the service-role key may appear, and the
 *  reason is structural rather than convenient: delivering a push means
 *  reading OTHER PEOPLE's subscription rows, which row-level security
 *  correctly refuses to any signed-in user. There is no version of this that
 *  works under RLS.
 *
 *  It is guarded by CRON_SECRET compared in constant time, because an
 *  unguarded endpoint that reads every subscription is exactly the thing you
 *  do not want reachable.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (given.length !== secret.length) return false;
  // Constant time: a length-independent early return leaks the secret slowly.
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export async function POST(request) {
  if (!authorised(request)) return new Response('Not authorised', { status: 401 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return Response.json({ ok: false, reason: 'VAPID keys are not set' }, { status: 503 });
  }
  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT || 'office@example.com'}`, pub, priv);

  const sb = supabaseAdmin();
  const { data: queued, error } = await sb
    .from('push_outbox')
    .select('id,notification_id,phone,attempts')
    .eq('status', 'queued')
    .lt('attempts', 3)
    .limit(200);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!queued?.length) return Response.json({ ok: true, sent: 0, gone: 0, failed: 0 });

  const ids = [...new Set(queued.map((q) => q.notification_id))];
  const phones = [...new Set(queued.map((q) => q.phone))];

  const [{ data: notes }, { data: subs }] = await Promise.all([
    sb.from('notifications').select('id,title,body,url').in('id', ids),
    sb.from('push_subscriptions').select('*').in('phone', phones),
  ]);

  const noteById = new Map((notes || []).map((n) => [n.id, n]));
  const subsByPhone = new Map();
  for (const s of subs || []) {
    if (!subsByPhone.has(s.phone)) subsByPhone.set(s.phone, []);
    subsByPhone.get(s.phone).push(s);
  }

  let sent = 0, gone = 0, failed = 0;

  for (const row of queued) {
    const note = noteById.get(row.notification_id);
    const targets = subsByPhone.get(row.phone) || [];
    if (!note || targets.length === 0) {
      // Nobody on this number has a device registered. That is not a failure
      // to retry — they will see it in the app.
      await sb.from('push_outbox').update({ status: 'gone' }).eq('id', row.id);
      gone++;
      continue;
    }

    const payload = JSON.stringify({
      title: note.title,
      body: note.body || '',
      url: note.url || '/notifications',
      tag: `n-${note.id}`,
      app: APP.name,
    });

    let anyOk = false;
    for (const s of targets) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        anyOk = true;
        await sb.from('push_subscriptions')
          .update({ last_ok_at: new Date().toISOString(), failures: 0 }).eq('id', s.id);
      } catch (e) {
        // 404 and 410 mean the browser threw the subscription away. Keeping it
        // means retrying forever against an endpoint that will never answer.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          await sb.from('push_subscriptions')
            .update({ failures: (s.failures || 0) + 1 }).eq('id', s.id);
        }
      }
    }

    if (anyOk) {
      await sb.from('push_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id);
      sent++;
    } else {
      await sb.from('push_outbox')
        .update({ status: row.attempts >= 2 ? 'failed' : 'queued',
                  attempts: row.attempts + 1,
                  last_error: 'no endpoint accepted it' })
        .eq('id', row.id);
      failed++;
    }
  }

  return Response.json({ ok: true, sent, gone, failed });
}
