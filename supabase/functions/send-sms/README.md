# OTP sign-in — Fast2SMS, no DLT registration

Supabase Auth generates the OTP; this function delivers it through Fast2SMS.

## Which route we send on

Routes are tried **cheapest first**, stopping at the first that sends. A
rejected attempt is not billed — only a delivered SMS is — so trying the cheap
route costs nothing when it is refused.

Default order: `otp,q`. Override with the `FAST2SMS_ROUTE` secret
(comma-separated) to force an order or a single route.

| Route | Cost | DLT? | Extra setup | Sender shown | Wording |
|---|---|---|---|---|---|
| `otp` | ~Rs 0.35 | no | some accounts need a website verification | Fast2SMS | fixed, "Your OTP: 123456" |
| `q` | ~Rs 5 | no | none | random number | ours — names the business |
| `dlt` | ~Rs 0.11-0.25 | **yes** | DLT registration + `FAST2SMS_SENDER_ID`, `FAST2SMS_TEMPLATE_ID` | your own, e.g. PATLMK | your approved template |

`dlt` is deliberately not in the default order: without its two secrets it can
only fail. Add it explicitly once registered, e.g. `FAST2SMS_ROUTE=dlt,otp,q`.

The log line `Sent on route "..."` records which route actually carried each
message — the only way to tell afterwards what an OTP cost. A refused route
logs `Route "..." refused: <reason>` even when a later one succeeds, so you can
see whether the cheap `otp` route has started working without spending ₹5 to
find out.

As of the last check every delivered OTP went out on `q`, at about ₹5 — the
`otp` route is still refused pending the KYC in step 1 below.

Note Smart OTP is **not** usable here: it generates and verifies its own code,
whereas Supabase generates the code and needs us to deliver that exact one.

## One-time setup

1. **Fast2SMS**: copy the API key from *Dev API*, then complete the OTP KYC —
   the `otp` route refuses to send until this is done, answering
   *"Before using OTP Message API, complete website verification."*
   In the Fast2SMS panel: **OTP SMS section → KYC button (top)**, then
   - add at least ₹100 credit,
   - enter the website URL (`https://patelmarketing-catalog.vercel.app`),
   - verify Aadhaar — the OTP goes to the **Aadhaar-linked** mobile, which is
     not necessarily the number on the Fast2SMS account.

2. **Supabase → Authentication → Providers → Phone**: enable phone sign-in.
   (No SMS provider needs choosing there — the hook below replaces it.)

3. **Supabase → Authentication → Hooks → Send SMS hook**: enable it, choose
   *HTTPS*, and point it at:

   ```
   https://vcrzauuxvgpsbforiszz.supabase.co/functions/v1/send-sms
   ```

   Copy the secret it shows — it looks like `v1,whsec_…`.

4. **Supabase → Edge Functions → send-sms → Secrets**, add both:

   | Name | Value |
   |---|---|
   | `FAST2SMS_API_KEY` | the key from step 1 |
   | `SEND_SMS_HOOK_SECRET` | the `v1,whsec_…` from step 3 |

   Neither belongs in this repo or in `config.js`. They live only here.

5. Sign in on the site with a number that is on `catalog.allowlist`. A code
   should arrive within a minute. (`/v2/` is kept as a fallback and deliberately
   keeps the old plain-text sign-in — it will never send an OTP. `/v3/` was
   where this was tested and now redirects to the root.)

## Notes

- The function refuses to send unless `SEND_SMS_HOOK_SECRET` is set and the
  request carries a valid Standard Webhooks signature, so a stranger who finds
  the URL cannot burn SMS credits.
- The signature scheme was verified against the published Standard Webhooks
  test vector.
- Fast2SMS answers HTTP 200 with `{"return": false}` for failures such as an
  empty wallet, so the function checks that field rather than trusting the
  status code.
- Failures are logged without the OTP or the full phone number, since Edge
  Function logs are readable in the dashboard.
- Supabase's own per-hour OTP rate limit stays on; the sign-in screens already
  show a "too many attempts" message.
