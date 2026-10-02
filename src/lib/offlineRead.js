import { isOnline } from './connectivity';

// The retry delays BracketsPage.loadBrackets proved out against the
// Supabase connection-pool incident this session — most transient failures
// clear within a couple seconds, so retrying silently here means the
// organizer never sees most of them as an error at all.
export const TRANSIENT_RETRY_DELAYS_MS = [600, 1200];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultHasCachedData(data) {
  return Array.isArray(data) ? data.length > 0 : data != null;
}

// Generalizes the retry-then-cache-fallback pattern already proven in
// BracketsPage's loadBrackets() into one shared helper every offline-capable
// loader can call, instead of each page copy-pasting its own retry loop.
//
// - Online (not forced): tries `live()`, retrying transient failures per
//   `retryDelaysMs`. On success, writes the cache (fire-and-forget) and
//   returns {data, source: 'live'}. On sustained failure, falls back to
//   `readCache()`.
// - Offline/forced-offline: reads the cache FIRST, with no live attempt and
//   no waiting — that's the entire point of "forced local-only". A cache
//   MISS still makes exactly one live read, though: a read can't corrupt
//   anything the way a write could, and a permanently blank page is worse
//   than one slow attempt. (Writes never get this exception — see
//   OfflineSyncContext's enqueueWrite.)
//
// Every caller is expected to layer its own stale-tab guard (e.g. a ref
// checked after the await) on top of this, same as BracketsPage already
// does — this helper only knows about one read, not which page/tab asked.
export async function readWithFallback({ live, readCache, writeCache, retryDelaysMs = [], hasCachedData = defaultHasCachedData }) {
  if (!isOnline()) {
    const cached = await readCache().catch(() => null);
    if (cached != null && hasCachedData(cached)) {
      return { data: cached, source: 'cache', error: null };
    }
    // Cache miss while forced/offline: one bare live attempt, no retries —
    // better than dead-ending on a page that's never been opened on this
    // device, and a single read is harmless even if it's slow.
    try {
      const data = await live();
      writeCache?.(data)?.catch?.(() => {});
      return { data, source: 'live', error: null };
    } catch (error) {
      const fallback = await readCache().catch(() => null);
      return { data: fallback, source: fallback != null ? 'cache' : 'none', error };
    }
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const data = await live();
      writeCache?.(data)?.catch?.(() => {});
      return { data, source: 'live', error: null };
    } catch (e) {
      lastError = e;
      if (attempt < retryDelaysMs.length) await sleep(retryDelaysMs[attempt]);
    }
  }
  const cached = await readCache().catch(() => null);
  return { data: cached, source: cached != null && hasCachedData(cached) ? 'cache' : 'none', error: lastError };
}
