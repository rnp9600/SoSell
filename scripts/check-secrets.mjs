#!/usr/bin/env node
/** The service-role key bypasses row-level security completely, so where it
 *  may appear is a rule worth enforcing rather than remembering.
 *
 *  Allowed: the cron routes (which act as nobody), the push sender (which by
 *  definition reads other people's subscriptions), one-off scripts, and the
 *  admin client itself. Everywhere else — including every office screen —
 *  uses the anon key plus the session, and lets RLS decide.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ALLOWED = [
  /^lib\/supabase\/admin\.js$/,
  /^app\/api\/cron\//,
  /^app\/api\/push\/send\//,
  /^scripts\//,
];
const SKIP = new Set(['node_modules', '.next', '.git', 'out', 'build', 'coverage']);
const NEEDLE = /SUPABASE_SECRET_KEY|supabaseAdmin\s*\(|service_role/;

const offenders = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(js|jsx|mjs|ts|tsx)$/.test(entry)) continue;
    const rel = relative(ROOT, full).replace(/\\/g, '/');
    if (ALLOWED.some((re) => re.test(rel))) continue;
    if (NEEDLE.test(readFileSync(full, 'utf8'))) offenders.push(rel);
  }
})(ROOT);

if (offenders.length) {
  console.error('\nThe service-role key may not be used here:\n');
  for (const f of offenders) console.error(`  ${f}`);
  console.error(
    '\nUse lib/supabase/server.js — the anon key plus the session — and let\n' +
      'row-level security decide. The test: would this code be wrong if RLS\n' +
      'were enforced? If yes, the code is wrong, not RLS.\n',
  );
  process.exit(1);
}
console.log('Service-role key confined to the three paths that may hold it.');
