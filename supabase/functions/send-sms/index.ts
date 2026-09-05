// Patel Marketing catalogue — Supabase "Send SMS" auth hook.
//
// Supabase Auth generates the OTP itself, then calls this function to deliver
// it through Fast2SMS. Several Fast2SMS routes can carry it and they differ
// ~14x in price, so this tries them cheapest-first and stops at the first that
// sends — see FAST2SMS_ROUTES below. Nothing in the catalogue or the database
// changes when that order changes.
//
// Secrets this function needs (Dashboard -> Edge Functions -> send-sms ->
// Secrets, or `supabase secrets set`):
//   FAST2SMS_API_KEY   the key from Fast2SMS -> Dev API
//   SEND_SMS_HOOK_SECRET  the "v1,whsec_..." secret Supabase shows when you
//                         enable the Send SMS hook. Required — without it we
//                         refuse to send, so nobody but Supabase Auth can make
//                         this function burn SMS credits.
// Optional:
//   FAST2SMS_ROUTE     routes to try, cheapest first (default "otp,q")
//   FAST2SMS_SENDER_ID, FAST2SMS_TEMPLATE_ID   only for the "dlt" route
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";
// Reject replayed webhooks older than this (Standard Webhooks guidance).
const MAX_SKEW_SECONDS = 300;
// Give up on the SMS provider well before Supabase Auth's own request would
// time out, so the sign-in screen always gets an answer.
const FAST2SMS_TIMEOUT_MS = 15000;

// Routes to try, cheapest first, stopping at the first that sends. Override
// with FAST2SMS_ROUTE (comma-separated) to force a particular order or a
// single route — no code change or redeploy needed.
//
//   "otp" Fast2SMS's own OTP template, ~Rs 0.35. Wording and sender are
//         theirs ("Your OTP: 123456"). Some accounts must pass a website
//         verification first, which is why this is attempted rather than
//         assumed.
//   "q"   Quick SMS, ~Rs 5. No DLT and no extra verification, delivers to DND
//         numbers, and the wording is ours so the message can name the
//         business. The dependable fallback.
//   "dlt" A DLT-registered sender. Cheapest (~Rs 0.11-0.25) and the only one
//         that shows a real sender ID instead of a random number, but needs
//         TRAI DLT registration plus FAST2SMS_SENDER_ID and
//         FAST2SMS_TEMPLATE_ID. Not in the default order: without those
//         secrets it can only fail, so it is opt-in.
const FAST2SMS_ROUTES = (Deno.env.get("FAST2SMS_ROUTE") ?? "otp,q")
  .split(",")
  .map((r) => r.trim().toLowerCase())
  .filter(Boolean);

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Constant-time-ish compare, so a wrong signature can't be brute-forced by
// timing how long the comparison takes.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Standard Webhooks signature check — proves the call really came from Supabase Auth. */
async function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
  body: string,
): Promise<boolean> {
  let raw = secret.trim();
  if (raw.startsWith("v1,")) raw = raw.slice(3);
  if (raw.startsWith("whsec_")) raw = raw.slice(6);

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const expected = bytesToBase64(new Uint8Array(mac));

  // The header carries one or more space-separated "v1,<signature>" entries.
  return signatureHeader.split(" ").some((part) => {
    const sig = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part;
    return safeEqual(sig, expected);
  });
}

function fail(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: { http_code: status, message } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

/** The request body Fast2SMS expects differs per route. */
function buildPayload(route: string, tenDigit: string, otp: string): Record<string, unknown> {
  if (route === "otp") {
    // Fast2SMS supplies the wording ("Your OTP: 123456").
    return { route: "otp", variables_values: otp, numbers: tenDigit };
  }
  if (route === "dlt") {
    const sender = Deno.env.get("FAST2SMS_SENDER_ID");
    const template = Deno.env.get("FAST2SMS_TEMPLATE_ID");
    if (!sender || !template) {
      throw new Error(
        "FAST2SMS_ROUTE is 'dlt' but FAST2SMS_SENDER_ID / FAST2SMS_TEMPLATE_ID are not set",
      );
    }
    return {
      route: "dlt",
      sender_id: sender,
      message: template,
      variables_values: otp,
      numbers: tenDigit,
    };
  }
  // Quick SMS. The wording is ours, so unlike the "otp" route the message can
  // say who it is from — worth a lot when the sender ID is a random number.
  return {
    route: "q",
    message: `${otp} is your Patel Marketing verification code. Do not share it with anyone.`,
    language: "english",
    flash: 0,
    numbers: tenDigit,
  };
}

async function sendOnRoute(route: string, tenDigit: string, otp: string): Promise<void> {
  const apiKey = Deno.env.get("FAST2SMS_API_KEY");
  if (!apiKey) throw new Error("FAST2SMS_API_KEY is not set");

  let res: Response;
  try {
    res = await fetch(FAST2SMS_ENDPOINT, {
      method: "POST",
      headers: {
        "authorization": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(route, tenDigit, otp)),
      // Without this, a stalled provider keeps Supabase Auth's own request
      // open, and the sign-in screen sits on "Sending…" indefinitely. Fail
      // fast instead, so the reader gets a message they can act on.
      signal: AbortSignal.timeout(FAST2SMS_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = (err as Error)?.name === "TimeoutError"
      ? `no response within ${FAST2SMS_TIMEOUT_MS / 1000}s`
      : ((err as Error)?.message ?? "network error");
    throw new Error(`route "${route}": could not reach Fast2SMS: ${reason}`);
  }

  const text = await res.text();
  let parsed: { return?: boolean; message?: unknown } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fast2SMS occasionally answers with plain text on an error.
  }

  // Fast2SMS answers 200 with {"return": false} for things like an empty
  // wallet, so an HTTP 200 alone is not proof the SMS went out.
  if (!res.ok || parsed.return !== true) {
    const detail = Array.isArray(parsed.message)
      ? parsed.message.join("; ")
      : (parsed.message ?? text ?? "").toString().slice(0, 300);
    // Name the route: the same key behaves differently per route, and the
    // last round of debugging turned on knowing which one was in use.
    throw new Error(`route "${route}": ${detail || res.status}`);
  }
}

/**
 * Try each route in preference order and stop at the first that sends.
 *
 * The routes differ ~14x in price (otp ~Rs 0.35 against quick ~Rs 5), but
 * whether an account may use the cheap one depends on gates Fast2SMS applies
 * per account and does not publish. A rejected attempt is not billed — only a
 * delivered SMS is — so trying the cheap route first costs nothing when it is
 * refused, and saves most of the money whenever it is allowed. Falling back
 * automatically also means a route being turned off later degrades to a more
 * expensive SMS rather than to a customer who cannot sign in.
 */
async function sendViaFast2SMS(tenDigit: string, otp: string): Promise<void> {
  const failures: string[] = [];
  for (const route of FAST2SMS_ROUTES) {
    try {
      await sendOnRoute(route, tenDigit, otp);
      // Which route actually carried it is the only way to tell from the logs
      // what an OTP cost.
      console.log(`Sent on route "${route}"`);
      return;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push(reason);
      // Log the rejection even when a later route succeeds. Otherwise the only
      // record of the cheap route being refused is a message nobody ever sees,
      // and "has the OTP KYC gone through yet?" has no answer short of paying
      // Rs 5 to find out. This line answers it.
      console.log(`Route "${route}" refused: ${reason}`);
    }
  }
  throw new Error(`Fast2SMS rejected every route — ${failures.join(" | ")}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "Method not allowed");

  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  if (!hookSecret) {
    console.error("SEND_SMS_HOOK_SECRET is not set — refusing to send.");
    return fail(500, "Hook secret is not configured");
  }

  const body = await req.text();
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signature = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return fail(401, "Missing webhook signature headers");

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) {
    return fail(401, "Webhook timestamp outside the allowed window");
  }

  let ok = false;
  try {
    ok = await verifySignature(hookSecret, id, timestamp, signature, body);
  } catch (err) {
    console.error("Signature verification threw:", err);
    return fail(401, "Could not verify webhook signature");
  }
  if (!ok) return fail(401, "Invalid webhook signature");

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return fail(400, "Body was not valid JSON");
  }

  const otp = payload.sms?.otp;
  // Supabase sends E.164 ("+919686754024"); Fast2SMS wants the bare 10 digits.
  const digits = (payload.user?.phone ?? "").replace(/\D/g, "");
  const tenDigit = digits.slice(-10);

  if (!otp) return fail(400, "No OTP in the payload");
  if (tenDigit.length !== 10) return fail(400, "No usable 10-digit phone number in the payload");

  try {
    await sendViaFast2SMS(tenDigit, otp);
  } catch (err) {
    // Never log the OTP or the full number — this ends up in project logs.
    console.error(`Send failed for ...${tenDigit.slice(-3)}:`, err instanceof Error ? err.message : err);
    return fail(502, "Could not deliver the verification code. Please try again.");
  }

  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
