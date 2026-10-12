# Load tests — capacity plan (5 simultaneous organizers x ~200 players)

Two kinds of load, tested separately because they carry very different risk:

## Spectator/phone-viewer load — safe to run against production
`phone_viewer_load_test.mjs` and `phone_viewer_load_test_multi.mjs` only send
GET requests to the public, CDN-cached `/api/preview-snapshot` endpoint —
exactly what a real phone on the Preview Screen does. No writes, no auth
required. Safe to run anytime, including against the live site.

```bash
node scripts/load-tests/phone_viewer_load_test.mjs 120 3        # 120 concurrent phones, 1 category, 3 rounds
node scripts/load-tests/phone_viewer_load_test_multi.mjs 300 3  # 300 concurrent phones spread across 5 real categories
```

**Results from 2026-10-12** (against production, idle baseline CPU 2% / RAM 32-33% / 7 connections):
- 120 concurrent requests, single category: round 1 (STALE, warm already) 578ms wall/471ms p95; rounds 2-3 (HIT) ~240-340ms wall/195-246ms p95. 360/360 succeeded.
- 300 concurrent requests spread across 5 categories: round 1 (cold MISS on all 5 keys) 4.3s wall/3.9s p95 — the one real cost, paid once per cache window, not per request; rounds 2-3 (HIT) 460-570ms wall/280-493ms p95. 900/900 succeeded.
- Supabase dashboard showed no meaningful movement during either run: CPU stayed at 2%, connections moved 7→8 (noise), RAM ticked up a few points (plausibly unrelated background activity).
- **Conclusion**: the spectator-caching architecture holds well past the "100+ phones" scenario. The only real cost is the first wave after a cache entry expires (up to ~4s observed here); that's a one-time-per-TTL-window cost shared by the whole crowd, not a per-phone cost, and the public page's own poll jitter (`useMatchSchedule.js`) spreads real traffic out further than this synchronized test does.

## Organizer-burst load — NEVER run against production
`organizer_burst_load_test.mjs` calls the real `sync_finish_match` write RPC
— it changes match scores and triggers bracket advancement. It has hard
guardrails (refuses to run if `SUPABASE_URL` matches the known production
project ref, requires `ALLOW_WRITES=yes`), but the only genuinely safe way
to run it is against a **disposable duplicate Supabase project**, seeded
with ~5 events x ~200 players (use the app's own CSV/Excel bulk-add), with
a few real organizer/staff logins created for it.

```bash
SUPABASE_URL=https://<staging-ref>.supabase.co \
SUPABASE_ANON_KEY=<staging-anon-key> \
SCORER_CREDENTIALS='scorer1@test.com:pass1,scorer2@test.com:pass2' \
MATCH_IDS='<in-progress-match-id-1>,<in-progress-match-id-2>' \
ALLOW_WRITES=yes \
node scripts/load-tests/organizer_burst_load_test.mjs
```

This hasn't been run yet — it needs a staging project, which doesn't exist
yet. After running it, compare the reported latency and the Supabase
dashboard's CPU/connection movement against the capacity plan's estimate of
11-26 queries per "Finish" click and 150-300 queries in a clustered burst
across 5 events, both before and after applying
`supabase/optimize_rls_auth_uid.sql`.
