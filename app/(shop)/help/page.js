import { Header } from '@/components/pm/header';
import { FIRM, APP } from '@/lib/config';

export const metadata = { title: 'Help' };

/** The questions people actually ask, answered plainly. */
const QA = [
  ['Why can I not see rates?',
   'Rates show once you are signed in and your account has been approved. Sign in with your number, and if we do not recognise it yet you can tell us who you are — somebody in the office will approve it.'],
  ['Some products say "Rate on request".',
   'We do not have a rate on file for those. Put them on your order anyway — the line goes out with the rate left open and we will confirm it before sending.'],
  ['What does the MRP with a line through it mean?',
   'That is the printed maximum retail price, shown only where the supplier gave us one. Where they did not, we show nothing rather than inventing a figure.'],
  ['I placed an order but did not get a confirmation.',
   'Open Orders from the tab bar — every order you have placed is there with where it has got to. If the screen said the order was not recorded, it was not: send the reference on WhatsApp and we will enter it.'],
  ['What does the outstanding on my account include?',
   'Bills raised, less payments received and any credit or discount notes. Cheques you have given are NOT deducted until the bank clears them — they are shown separately so you can see both figures.'],
  ['A cheque I gave is still showing as not cleared.',
   'A cheque is marked cleared when the bank actually pays it, not when its date passes. If one has cleared at your end and not here, tell us and we will check.'],
  ['Can I order the same things again?',
   'Open the order, then "Order these again". Every line comes back at today’s rates, and you can remove anything you do not need.'],
  ['Does this work without a signal?',
   'The catalogue and your saved list do. Placing an order needs a connection — if it fails, the app keeps your reference and offers to send it on WhatsApp.'],
];

export default function HelpPage() {
  return (
    <main>
      <Header title="Help" back="/account" />
      <div className="divide-y divide-line">
        {QA.map(([q, a]) => (
          <section key={q} className="px-5 py-4">
            <h2 className="font-bold text-ink">{q}</h2>
            <p className="mt-1 text-ink-2">{a}</p>
          </section>
        ))}
      </div>
      <div className="px-5 py-6">
        <a href={`https://wa.me/${FIRM.whatsapp}`}
           className="flex min-h-tap items-center justify-center rounded-full bg-brand px-5 font-semibold text-on-brand">
          Ask {FIRM.legalName} on WhatsApp
        </a>
        <p className="mt-4 text-center text-sm text-ink-3">
          {APP.name} · build {APP.build}
        </p>
      </div>
    </main>
  );
}
