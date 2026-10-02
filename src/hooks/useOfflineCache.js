import { getOfflineDb, getAllByIndex, getMeta, getRecord, putAll, putRecord, replaceByIndex, setMeta, deleteMetaByPrefix } from '../lib/offlineDb';

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

// Replace (not append) semantics — a category/umpire deleted on the server
// since the last successful load disappears from the offline cache too,
// instead of lingering forever as a ghost record.
export async function cacheCategories(eventId, categories) {
  await replaceByIndex('categories', 'by_event', eventId, (categories || []).map((c) => ({ ...c, event_id: eventId })));
}
export function getCachedCategories(eventId) {
  return getAllByIndex('categories', 'by_event', eventId);
}

export async function cacheUmpires(eventId, umpires) {
  await replaceByIndex('umpires', 'by_event', eventId, (umpires || []).map((u) => ({ ...u, event_id: eventId })));
}
export function getCachedUmpires(eventId) {
  return getAllByIndex('umpires', 'by_event', eventId);
}

// Teams keyed by bracket, same replace semantics — a team moved off a
// bracket (or deleted) stops showing up in that bracket's offline standings.
export async function cacheTeams(bracketId, teams) {
  await replaceByIndex('teams', 'by_bracket', bracketId, (teams || []).map((t) => ({ ...t, bracket_id: bracketId })));
}
export function getCachedTeamsForBracket(bracketId) {
  return getAllByIndex('teams', 'by_bracket', bracketId);
}

export async function getCachedCompletedMatchesForBracket(bracketId) {
  const matches = await getAllByIndex('matches', 'by_bracket', bracketId);
  return matches.filter((m) => m.status === 'completed').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

// Registrations have no dedicated IndexedDB store — one JSON blob per event
// in the existing (otherwise-unused) `meta` store instead of adding a new
// object store, which would mean bumping offlineDb's DB_VERSION and the
// upgrade-path risk that carries for the sync queue every other page
// already depends on (see offlineDb.js's upgrade()). Read-only cache: this
// backs viewing the roster offline, not checking players in or approving
// registrations, which stay online-only.
const registrationsMetaKey = (eventId) => `registrations:${eventId}`;
export async function cacheRegistrations(eventId, registrations) {
  await setMeta(registrationsMetaKey(eventId), { cachedAt: Date.now(), rows: registrations || [] });
}
export async function getCachedRegistrations(eventId) {
  const cached = await getMeta(registrationsMetaKey(eventId));
  return cached?.rows ?? [];
}
export async function getCachedRegistrationsCachedAt(eventId) {
  const cached = await getMeta(registrationsMetaKey(eventId));
  return cached?.cachedAt ?? null;
}
// Registrations carry player names/emails/phone numbers — clear them on
// sign-out rather than letting them sit in this device's IndexedDB
// indefinitely for whoever signs in next.
export function clearCachedRegistrations() {
  return deleteMetaByPrefix('registrations:');
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
