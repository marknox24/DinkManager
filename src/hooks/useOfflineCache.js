import { getOfflineDb, getAllByIndex, getRecord, putAll, putRecord } from '../lib/offlineDb';

// Mirrors of Match List's read queries into IndexedDB, plus their cache-only
// counterparts for the offline fallback path. Not a React hook despite the
// filename (matching the plan's naming) — MatchListPage calls these as
// plain async functions from its existing loaders, caching on a successful
// network fetch and falling back to the cache when the fetch throws.

export async function cacheEvent(event) {
  if (event) await putRecord('events', event);
}
export function getCachedEvent(eventId) {
  return getRecord('events', eventId);
}

export async function cacheCategories(eventId, categories) {
  await putAll('categories', (categories || []).map((c) => ({ ...c, event_id: eventId })));
}
export function getCachedCategories(eventId) {
  return getAllByIndex('categories', 'by_event', eventId);
}

export async function cacheUmpires(eventId, umpires) {
  await putAll('umpires', (umpires || []).map((u) => ({ ...u, event_id: eventId })));
}
export function getCachedUmpires(eventId) {
  return getAllByIndex('umpires', 'by_event', eventId);
}

export async function cacheBrackets(categoryId, brackets) {
  await putAll('brackets', (brackets || []).map((b) => ({ ...b, category_id: categoryId })));
}
export function getCachedBrackets(categoryId) {
  return getAllByIndex('brackets', 'by_category', categoryId);
}

// Matches come from two different online queries (listMatchesForCategory,
// scoped to one category, and listLiveMatchesForEvent, event-wide across
// every category) that don't always carry event_id/category_id directly —
// this merges onto whatever's already cached for that match id instead of
// overwriting, so a live-matches refresh (no category_id in its response)
// can't blow away the category_id a category refresh already recorded for
// the same row, which would silently break the by_category index.
export async function cacheMatches(eventId, categoryId, matches) {
  if (!matches?.length) return;
  const db = await getOfflineDb();
  const tx = db.transaction('matches', 'readwrite');
  await Promise.all(
    matches.map(async (m) => {
      const existing = await tx.store.get(m.id);
      const resolvedCategoryId = categoryId ?? m.category_id ?? existing?.category_id ?? null;
      await tx.store.put({ ...existing, ...m, event_id: eventId ?? existing?.event_id ?? null, category_id: resolvedCategoryId });
    })
  );
  await tx.done;
}
export function getCachedMatchesForCategory(categoryId) {
  return getAllByIndex('matches', 'by_category', categoryId);
}
export async function getCachedLiveMatchesForEvent(eventId) {
  const matches = await getAllByIndex('matches', 'by_event', eventId);
  return matches.filter((m) => m.status === 'in_progress');
}
