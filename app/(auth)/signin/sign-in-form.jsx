'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  supabaseBrowser,
  settle,
  digits,
  toE164,
  friendlyAuthError,
} from '@/lib/supabase/browser';
import { isTestNumber, TEST_NUMBERS_ENABLED, FIRM } from '@/lib/config';

/** Phone, then a code. Or a PIN, for the five test numbers.
 *
 *  Getting in is a queue, not a wall: the code proves a phone and nothing
 *  more. A number with no allowlist row is not turned away — it is sent to
 *  /join to say who it is, and somebody in the office decides. That routing
 *  happens after sign-in, not here.
 */
export default function SignInForm({ next = '/' }) {
  const router = useRouter();
  const [step, setStep] = useState('phone'); // phone | code | pin
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const d = digits(phone).slice(-10);
  const ready = d.length === 10;

  async function sendCode(e) {
    e?.preventDefault();
    if (!ready || busy) return;
    setError('');

    // A test number holds a PIN instead, so walking the app as each kind of
    // customer costs nothing. The PIN is checked by Supabase, not here.
    if (TEST_NUMBERS_ENABLED && isTestNumber(d)) {
      setStep('pin');
      return;
    }

    setBusy(true);
    const sb = supabaseBrowser();
    const { error: err } = await settle(
      () => sb.auth.signInWithOtp({ phone: toE164(d) }),
      'Sending the code',
    );
    setBusy(false);
    if (err) return setError(friendlyAuthError(err));
    setStep('code');
  }

  async function verify(e) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const sb = supabaseBrowser();

    const { error: err } = await settle(
      () =>
        step === 'pin'
          ? sb.auth.signInWithPassword({ phone: toE164(d), password: code })
          : sb.auth.verifyOtp({ phone: toE164(d), token: digits(code), type: 'sms' }),
      step === 'pin' ? 'Checking the PIN' : 'Checking the code',
    );
    setBusy(false);
    if (err) return setError(friendlyAuthError(err));

    // A server component decides where they belong — member, applicant, or
    // neither — because that answer comes from the database.
    router.replace(next);
    router.refresh();
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="phone">Your mobile number</Label>
          <div className="flex items-center gap-2">
            <span className="grid h-11 place-items-center rounded-full border border-line bg-surface-2 px-3 font-mono text-sm text-ink-2">
              +91
            </span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoFocus
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 flex-1 rounded-full text-base"
            />
          </div>
          {/* Digit echo: on a phone keypad it is genuinely easy to type nine. */}
          <p className="text-sm text-ink-3">
            {d.length === 0
              ? 'Ten digits, no country code.'
              : ready
                ? `Signing in as +91 ${d.slice(0, 5)} ${d.slice(5)}`
                : `${d.length} of 10 digits`}
          </p>
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <Button type="submit" size="lg" block disabled={!ready || busy}>
          {busy ? 'Sending…' : 'Send me a code'}
        </Button>

        <p className="text-center text-sm text-ink-3">
          New here? Sign in first — we will ask who you are next.
        </p>
      </form>
    );
  }

  const isPin = step === 'pin';
  return (
    <form onSubmit={verify} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="code">{isPin ? 'Your PIN' : 'The code we texted you'}</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="······"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 rounded-full text-center font-mono text-xl tracking-[0.4em]"
        />
        <p className="text-sm text-ink-3">
          {isPin ? 'This is a test account.' : `Sent to +91 ${d.slice(0, 5)} ${d.slice(5)}`}
        </p>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      <Button type="submit" size="lg" block disabled={busy || code.length < 4}>
        {busy ? 'Checking…' : isPin ? 'Sign in' : 'Sign in'}
      </Button>

      <Button
        type="button"
        variant="quiet"
        block
        onClick={() => {
          setStep('phone');
          setCode('');
          setError('');
        }}
      >
        Use a different number
      </Button>

      <p className="text-center text-sm text-ink-3">
        Trouble signing in? Message {FIRM.legalName} on WhatsApp.
      </p>
    </form>
  );
}
