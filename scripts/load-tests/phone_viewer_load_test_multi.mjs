// Same idea as phone_viewer_load_test.mjs, but splits the simulated crowd
// across multiple real categories within one event — a more realistic
// model of "100+ players on their phones" (they're not all watching the
// same division's bracket; they split across whichever category they're
// playing in). Still read-only, still hitting only the public CDN-cached
// endpoint.
const BASE = 'https://dinkmanager.com';
const EVENT = 'bb10abbc-457d-4c08-9809-3c185553a442';
const CATEGORIES = [
  'eab48e2b-e7f3-4d01-8f28-3c4240c193f8',
  'ed5db456-2e0c-462d-bf6a-d7eafac79256',
  '44b68ea9-4c2c-4874-a265-bdaf4d506d8b',
  'b05c8f65-2f3b-4141-9690-6f9b3d90b701',
  '2eda6e10-7304-4576-8610-65219f265de2',
];
const totalPhones = Number(process.argv[2] || 300);
const rounds = Number(process.argv[3] || 3);

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function oneRequest(category) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}/api/preview-snapshot?event=${EVENT}&category=${category}`, { headers: { Accept: 'application/json' } });
    const ms = performance.now() - t0;
    const cacheStatus = res.headers.get('x-vercel-cache') || 'unknown';
    if (res.ok) await res.json();
    return { ok: res.ok, ms, cacheStatus, status: res.status };
  } catch (e) {
    return { ok: false, ms: performance.now() - t0, cacheStatus: 'error', status: 0, error: e.message };
  }
}

console.log(`Simulating ${totalPhones} concurrent "phone" requests per round, spread evenly across ${CATEGORIES.length} real categories, ${rounds} rounds.\n`);

for (let round = 1; round <= rounds; round++) {
  const requests = Array.from({ length: totalPhones }, (_, i) => CATEGORIES[i % CATEGORIES.length]);
  const t0 = performance.now();
  const results = await Promise.all(requests.map(oneRequest));
  const wallMs = performance.now() - t0;

  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const okCount = results.filter((r) => r.ok).length;
  const cacheCounts = results.reduce((acc, r) => {
    acc[r.cacheStatus] = (acc[r.cacheStatus] || 0) + 1;
    return acc;
  }, {});

  console.log(`--- Round ${round} (${totalPhones} phones across ${CATEGORIES.length} categories) ---`);
  console.log(`  wall time: ${Math.round(wallMs)}ms, success: ${okCount}/${totalPhones}`);
  console.log(`  latency (ms): min=${Math.round(times[0])} p50=${Math.round(percentile(times, 50))} p95=${Math.round(percentile(times, 95))} max=${Math.round(times[times.length - 1])}`);
  console.log(`  cache status:`, cacheCounts);
  console.log();
  if (round < rounds) await new Promise((r) => setTimeout(r, 1500));
}
