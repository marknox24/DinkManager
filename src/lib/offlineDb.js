import { openDB } from 'idb';

const DB_NAME = 'dinkmanager-offline';
const DB_VERSION = 1;

// Cached tournament data for the Match List MVP (events/categories/umpires/
// brackets/teams/matches — enough to render the page and score live matches
// with no network) plus the offline write queue. No separate `courts` store:
// court availability is derived client-side from event.num_courts minus
// occupied courts in the cached matches, same as the app already does
// online (see MatchListPage's availableCourts).
let dbPromise;
export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('events', { keyPath: 'id' });
        db.createObjectStore('categories', { keyPath: 'id' }).createIndex('by_event', 'event_id');
        db.createObjectStore('umpires', { keyPath: 'id' }).createIndex('by_event', 'event_id');
        db.createObjectStore('brackets', { keyPath: 'id' }).createIndex('by_category', 'category_id');
        db.createObjectStore('teams', { keyPath: 'id' }).createIndex('by_bracket', 'bracket_id');
        // category_id/event_id are denormalized onto each match record at
        // write time (see offlineCache.js) since the live API responses
        // this mirrors don't carry them directly.
        const matches = db.createObjectStore('matches', { keyPath: 'id' });
        matches.createIndex('by_bracket', 'bracket_id');
        matches.createIndex('by_category', 'category_id');
        matches.createIndex('by_event', 'event_id');
        matches.createIndex('by_status', 'status');
        db.createObjectStore('meta', { keyPath: 'key' });
        const queue = db.createObjectStore('sync_queue', { keyPath: 'operation_id' });
        queue.createIndex('by_status', 'status');
        queue.createIndex('by_match', 'match_id');
        queue.createIndex('by_event', 'event_id');
        queue.createIndex('by_created_at', 'created_at');
      },
    });
  }
  return dbPromise;
}

export async function putAll(storeName, records) {
  if (!records?.length) return;
  const db = await getOfflineDb();
  const tx = db.transaction(storeName, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

export async function getAllByIndex(storeName, indexName, value) {
  const db = await getOfflineDb();
  return db.getAllFromIndex(storeName, indexName, value);
}

export async function getAllRecords(storeName) {
  const db = await getOfflineDb();
  return db.getAll(storeName);
}

export async function getRecord(storeName, key) {
  const db = await getOfflineDb();
  return db.get(storeName, key);
}

export async function putRecord(storeName, record) {
  const db = await getOfflineDb();
  return db.put(storeName, record);
}

export async function deleteRecord(storeName, key) {
  const db = await getOfflineDb();
  return db.delete(storeName, key);
}

export async function getMeta(key) {
  const db = await getOfflineDb();
  const row = await db.get('meta', key);
  return row?.value;
}

export async function setMeta(key, value) {
  const db = await getOfflineDb();
  return db.put('meta', { key, value });
}

// Removes every `meta` row whose key starts with `prefix` — used to clear a
// whole family of per-event blobs (e.g. every cached `registrations:<id>`
// entry) in one call, such as on sign-out.
export async function deleteMetaByPrefix(prefix) {
  const db = await getOfflineDb();
  const tx = db.transaction('meta', 'readwrite');
  const keys = await tx.store.getAllKeys();
  await Promise.all(keys.filter((k) => String(k).startsWith(prefix)).map((k) => tx.store.delete(k)));
  await tx.done;
}

// Replaces every record under one index value (e.g. one event's categories,
// one bracket's teams) with exactly `records` — unlike putAll, a record that
// existed before but isn't in `records` this time is deleted, so a row
// removed on the server doesn't linger as a ghost in the offline cache
// forever (putAll only ever adds/overwrites, never prunes).
export async function replaceByIndex(storeName, indexName, value, records) {
  const db = await getOfflineDb();
  const tx = db.transaction(storeName, 'readwrite');
  const keep = new Set(records.map((r) => r.id));
  const existingKeys = await tx.store.index(indexName).getAllKeys(value);
  await Promise.all([...existingKeys.filter((k) => !keep.has(k)).map((k) => tx.store.delete(k)), ...records.map((r) => tx.store.put(r))]);
  await tx.done;
}
