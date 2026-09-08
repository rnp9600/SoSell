/** The icon set, ported from the catalogue's ui.js.
 *
 *  Thirty hand-drawn paths on a 24 grid, stroked in currentColor. They are
 *  here rather than pulled from an icon library for two reasons:
 *
 *  1. They are the icons this business's customers already recognise. The
 *     catalogue has been live long enough that changing them is a change to
 *     the app people know, not a refresh.
 *
 *  2. A generic library gets the details wrong in ways that matter here.
 *     Lucide's "receipt" has a DOLLAR SIGN in it — on an app that trades
 *     exclusively in rupees, on the tab a dealer presses to see what they
 *     have ordered. The one below is a slip of paper with a torn edge and
 *     two lines of text, which is what a receipt looks like anywhere.
 *
 *  Anything with no equivalent here — office-only things like a route pin or
 *  a task list — still comes from lucide-react. The rule is: if the catalogue
 *  had an icon for it, use this one.
 */
const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>',
  back: '<path d="m14.5 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  chevd: '<path d="m5 9 7 7 7-7"/>',
  share: '<path d="M12 15V4"/><path d="m8 7.5 4-3.5 4 3.5"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>',
  filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  sort: '<path d="M7 4v16"/><path d="m3.5 16.5 3.5 3.5 3.5-3.5"/><path d="M17 20V4"/><path d="m13.5 7.5 3.5-3.5 3.5 3.5"/>',
  star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  // A slip of paper with a torn bottom edge. NOT a dollar sign.
  receipt: '<path d="M6 3h12v18l-3-1.7-3 1.7-3-1.7L6 21V3Z"/><path d="M9.5 8h5M9.5 12h5"/>',
  repeat: '<path d="M4 10a6 6 0 0 1 6-6h8"/><path d="m15 1 3 3-3 3"/><path d="M20 14a6 6 0 0 1-6 6H6"/><path d="m9 23-3-3 3-3"/>',
  cog: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>',
  wa: '<path d="M3.5 20.5 5 16.4A8 8 0 1 1 8 19.4l-4.5 1.1Z"/><path d="M9 9.5c.3 1.6 2 3.3 3.6 3.6l.9-1.2 1.9.8c-.2 1.1-1.2 1.6-2.2 1.4-2.5-.4-4.7-2.6-5.1-5.1-.2-1 .3-2 1.4-2.2l.8 1.9L9 9.5Z"/>',
  pdf: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z"/><path d="M14 3v4h4"/><path d="M9.5 13.5h5M9.5 16.5h3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  out: '<path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M11 8 7 12l4 4"/><path d="M7 12h9"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7"/><path d="M6.5 7l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13"/>',
  tag: '<path d="m3.5 12.5 8-8h8v8l-8 8-8-8Z"/><path d="M15.5 8.5h.01"/>',
  truck: '<path d="M3 7h11v9H3V7Z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  shield: '<path d="M12 3.5 5 6v6c0 4.3 3 7.6 7 8.5 4-0.9 7-4.2 7-8.5V6l-7-2.5Z"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0-2.8-2.8L5 17v3Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10 18a2 2 0 0 0 4 0"/>',
  down: '<path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>',
  wallet: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H18a1 1 0 0 1 1 1v1"/><path d="M4 7.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5.5A1.5 1.5 0 0 1 4 7.5Z"/><path d="M16.5 13.5h.01"/>',
  bank: '<path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5.5 11v7M9.5 11v7M14.5 11v7M18.5 11v7"/><path d="M3.5 20.5h17"/>',
};

/** `fill` is for the one icon that has a filled state — the saved heart. */
export function Icon({ name, className = 'size-5', fill = 'none', ...props }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      dangerouslySetInnerHTML={{ __html: d }}
      {...props}
    />
  );
}

export const ICON_NAMES = Object.keys(PATHS);
