// Simulates the organizer-side burst this session's capacity plan flagged
// as the real risk: several scorers finishing matches at the same moment
// across simultaneous events, each "Finish" firing a real write RPC plus
// the app's post-write reload fan-out.
//
// *** WRITES REAL DATA (scores, bracket advancement). NEVER run this
// against your production project. *** It refuses to run unless
// SUPABASE_URL points somewhere other than the known production ref, and
// ALLOW_WRITES=yes is set, specifically so this can't be fired at
// production by accident (e.g. a copy-pasted .env.local).
//
// Setup (once): duplicate the production Supabase project (or restore a
// backup into a fresh one), seed it with ~5 events x ~200 players each
// (the app's own CSV import or Excel bulk-add can do this quickly), and
// create a few real organizer/staff logins for the seeded events.
//
// Usage:
//   SUPABASE_URL=https://<staging-ref>.supabase.co \
//   SUPABASE_ANON_KEY=<staging-anon-key> \
//   SCORER_CREDENTIALS='email1:pass1,email2:pass2,...' \
//   MATCH_IDS='uuid1,uuid2,...' \
//   ALLOW_WRITES=yes \
//   node organizer_burst_load_test.mjs
//
// MATCH_IDS should be matches already in 'in_progress' status (started via
// the app first) so sync_finish_match has something valid to finish, and
// ideally one match ID per scorer so each burst round finishes a distinct
// match (finishing the same match twice is a safe no-op per sync_finish_
// match's own idempotency, but it won't produce a realistic DB hit profile).

import { createClient } from '@supabase/supabase-js';

const PRODUCTION_REF = 'dypycavkxxamhamhauca';
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (your staging project, not production).');
  process.exit(1);
}
if (url.includes(PRODUCTION_REF)) {
  console.error(`Refusing to run: SUPABASE_URL points at the known PRODUCTION project (${PRODUCTION_REF}). This script writes real match data. Point it at a staging/duplicate project instead.`);
  process.exit(1);
}
if (process.env.ALLOW_WRITES !== 'yes') {
  console.error('Set ALLOW_WRITES=yes to confirm you understand this writes real data to whatever SUPABASE_URL points at.');
  process.exit(1);
}

const scorerCreds = (process.env.SCORER_CREDENTIALS || '')
  .split(',')
  .filter(Boolean)
  .map((pair) => {
    const [email, password] = pair.split(':');
    return { email, password };
  });
const matchIds = (process.env.MATCH_IDS || '').split(',').filter(Boolean);

if (scorerCreds.length === 0 || matchIds.length === 0) {
  console.error('Set SCORER_CREDENTIALS and MATCH_IDS (see the usage comment at the top of this file).');
  process.exit(1);
}
if (scorerCreds.length !== matchIds.length) {
  console.error(`SCORER_CREDENTIALS (${scorerCreds.length}) and MATCH_IDS (${matchIds.length}) must be the same length — one match per scorer.`);
  process.exit(1);
}

async function signedInClient({ email, password }) {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function finishOne(client, matchId) {
  const t0 = performance.now();
  const { data, error } = await client.rpc('sync_finish_match', {
    p_operation_id: crypto.randomUUID(),
    p_device_id: crypto.randomUUID(),
    p_match_id: matchId,
    p_client_ts: new Date().toISOString(),
    p_score_a: 11,
    p_score_b: 7,
    p_winner_team_id: null, // let the RPC infer from the score if it supports that; otherwise pass a real team id
    p_duration_minutes: 18,
  });
  const ms = performance.now() - t0;
  return { ok: !error, ms, error: error?.message, data };
}

console.log(`Signing in ${scorerCreds.length} scorer(s) against ${url}...`);
const clients = await Promise.all(scorerCreds.map(signedInClient));
console.log('Signed in. Firing all "Finish match" calls at once (the worst-case clustered moment)...\n');

const t0 = performance.now();
const results = await Promise.all(clients.map((client, i) => finishOne(client, matchIds[i])));
const wallMs = performance.now() - t0;

const times = results.map((r) => r.ms).sort((a, b) => a - b);
const okCount = results.filter((r) => r.ok).length;
console.log(`Wall time for all ${results.length} concurrent finishes: ${Math.round(wallMs)}ms`);
console.log(`Success: ${okCount}/${results.length}`);
console.log(`Latency (ms): min=${Math.round(times[0])} p50=${Math.round(times[Math.floor(times.length / 2)])} max=${Math.round(times[times.length - 1])}`);
const failures = results.filter((r) => !r.ok);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f, i) => console.log(`  [${i}] ${f.error}`));
}
console.log('\nNow check the Supabase dashboard (Settings -> Infrastructure) for CPU/RAM/connection movement during this burst,');
console.log('and Observability -> Query Performance for which queries this burst actually ran, to compare against the capacity plan\'s 11-26-queries-per-finish estimate.');
