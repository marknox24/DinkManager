// Simulates N phones concurrently hitting the Preview Screen's cached
// endpoint at the exact moment a crowd would — e.g. everyone glancing at
// the TV display right after an announcement, or a poll tick landing in
// the same instant for everyone who loaded the page together. Read-only
// (GET only), hits the same public CDN-cached endpoint real phones use —
// safe to run against production, no writes, nothing this wasn't already
// built to serve.
//
// Usage: node phone_viewer_load_test.mjs [concurrency] [rounds]
const BASE = 'https://dinkmanager.com';
const EVENT = 'bb10abbc-457d-4c08-9809-3c185553a442';
const CATEGORY = '2eda6e10-7304-4576-8610-65219f265de2';
const concurrency = Number(process.argv[2] || 120);
const rounds = Number(process.argv[3] || 3);

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function oneRequest() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}/api/preview-snapshot?event=${EVENT}&category=${CATEGORY}`, { headers: { Accept: 'application/json' } });
    const ms = performance.now() - t0;
    const cacheStatus = res.headers.get('x-vercel-cache') || 'unknown';
    const ok = res.ok;
    if (ok) await res.json(); // force full body read, like a real client would
    return { ok, ms, cacheStatus, status: res.status };
  } catch (e) {
    return { ok: false, ms: performance.now() - t0, cacheStatus: 'error', status: 0, error: e.message };
  }
}

async function burst(n) {
  const results = await Promise.all(Array.from({ length: n }, oneRequest));
  return results;
}

console.log(`Simulating ${concurrency} concurrent "phone" requests per round, ${rounds} rounds, target: ${BASE}/api/preview-snapshot`);
console.log('(Each round fires all requests at once via Promise.all — the worst-case "everyone looks at once" moment.)\n');

for (let round = 1; round <= rounds; round++) {
  const t0 = performance.now();
  const results = await burst(concurrency);
  const wallMs = performance.now() - t0;

  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const okCount = results.filter((r) => r.ok).length;
  const cacheCounts = results.reduce((acc, r) => {
    acc[r.cacheStatus] = (acc[r.cacheStatus] || 0) + 1;
    return acc;
  }, {});
  const errors = results.filter((r) => !r.ok);

  console.log(`--- Round ${round} ---`);
  console.log(`  wall time for all ${concurrency} requests: ${Math.round(wallMs)}ms`);
  console.log(`  success: ${okCount}/${concurrency}`);
  console.log(`  latency (ms): min=${Math.round(times[0])} p50=${Math.round(percentile(times, 50))} p95=${Math.round(percentile(times, 95))} max=${Math.round(times[times.length - 1])}`);
  console.log(`  cache status breakdown:`, cacheCounts);
  if (errors.length) console.log(`  errors:`, errors.slice(0, 3));
  console.log();
  // Small gap between rounds so we can see MISS (first round) vs HIT (later rounds) behavior clearly.
  if (round < rounds) await new Promise((r) => setTimeout(r, 1500));
}
