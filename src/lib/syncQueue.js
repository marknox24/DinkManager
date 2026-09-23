import { getAllByIndex, getAllRecords, putRecord, deleteRecord } from './offlineDb';
import { isOnline, onConnectivityChange } from './connectivity';
import { startScheduledMatch, recordScheduledMatchResult, pauseMatch, resumeMatch, cancelLiveMatch, finishMatch, deleteMatch } from '../data/bracketsApi';

// One entry per Match List write action — see bracketsApi.js's sync_* RPC
// wrappers, which these call identically whether flushing immediately or
// replaying from here.
const ACTIONS = {
  start: (matchId, payload, opts) => startScheduledMatch(matchId, payload, opts),
  log_score: (matchId, payload, opts) => recordScheduledMatchResult(matchId, payload, opts),
  pause: (matchId, payload, opts) => pauseMatch(matchId, payload.accumulated_seconds, opts),
  resume: (matchId, _payload, opts) => resumeMatch(matchId, opts),
  cancel: (matchId, _payload, opts) => cancelLiveMatch(matchId, opts),
  finish: (matchId, payload, opts) => finishMatch(matchId, payload, opts),
  remove: (matchId, _payload, opts) => deleteMatch(matchId, opts),
};

// A server rejection that retrying can never fix, as opposed to a network
// failure. 23514 (check_violation) is what the database's plan-limit
// triggers raise, e.g. a queued match start on a court the event's plan
// doesn't include — without this it would sit 'pending' and block the
// queue behind it forever.
function isPermanentRejection(e) {
  return e.code === 'sync_rejected_stale' || e.code === 'sync_rejected_invalid_state' || e.code === '23514';
}

const listeners = new Set();
function notify() {
  listeners.forEach((fn) => fn());
}
// Returns an unsubscribe function. Fired after every enqueue/flush/drain
// step so OfflineSyncContext can re-derive pendingCount/status without
// polling.
export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function getQueueStatusCounts() {
  const [pending, failed] = await Promise.all([getAllByIndex('sync_queue', 'by_status', 'pending'), getAllByIndex('sync_queue', 'by_status', 'failed')]);
  return { pending: pending.length, failed: failed.length };
}

export async function getQueueEntries() {
  const all = await getAllRecords('sync_queue');
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// A 'failed' entry was explicitly rejected by the server (see
// isPermanentRejection above) —
// retrying the identical operation_id/client_ts would fail the exact same
// way every time, since the RPC's own guard is what rejected it and nothing
// about that guard changes on retry. drainQueue below deliberately never
// touches 'failed' entries for this reason, so without this, a rejected
// write sits in the queue forever with no way to clear it. The only correct
// resolution is to accept the server's state and drop this local attempt.
export async function dismissEntry(operationId) {
  await deleteRecord('sync_queue', operationId);
  notify();
}

// Enqueues one Match List write, then tries to flush it immediately when
// online. Writing to IndexedDB always happens first — even the immediate-
// flush path re-reads nothing back out, it just fires from the same entry —
// so the action is durably saved before any network attempt, and a thrown
// network error here still leaves it safely queued for the next drain.
export async function enqueueOperation({ eventId, matchId, operationType, payload }) {
  const operationId = crypto.randomUUID();
  const clientTs = new Date().toISOString();
  const entry = {
    operation_id: operationId,
    event_id: eventId,
    match_id: matchId,
    operation_type: operationType,
    payload,
    client_ts: clientTs,
    created_at: clientTs,
    status: 'pending',
    retry_count: 0,
    last_error: null,
  };
  await putRecord('sync_queue', entry);
  notify();

  if (!isOnline()) {
    return { queued: true };
  }
  try {
    const match = await flushEntry(entry);
    return { queued: false, match };
  } catch {
    // flushEntry already recorded the failure on the queue entry; the
    // action itself is safely queued either way, so this call still
    // "succeeds" from the caller's point of view (optimistic UI stays).
    return { queued: true };
  }
}

async function flushEntry(entry) {
  const action = ACTIONS[entry.operation_type];
  try {
    const match = await action(entry.match_id, entry.payload, { operationId: entry.operation_id, clientTs: entry.client_ts });
    await deleteRecord('sync_queue', entry.operation_id);
    notify();
    return match;
  } catch (e) {
    const isSyncRejection = isPermanentRejection(e);
    await putRecord('sync_queue', {
      ...entry,
      status: isSyncRejection ? 'failed' : 'pending',
      retry_count: (entry.retry_count || 0) + 1,
      last_error: e.message,
    });
    notify();
    throw e;
  }
}

let draining = false;
// Replays every pending entry in created_at order (FIFO), sequentially —
// not in parallel — so e.g. a start queued just before a finish for the
// same match can't have the finish reach the server first. Stops at the
// first non-rejection failure (a real network/server error, as opposed to
// the server explicitly rejecting the operation) rather than skipping
// ahead to later entries, since a mid-drain network drop likely means
// every later call would fail the same way, and skipping would let a later
// write for the same match land out of order.
export async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    const entries = await getQueueEntries();
    for (const entry of entries) {
      if (entry.status !== 'pending') continue;
      if (!isOnline()) break;
      try {
        await flushEntry(entry);
      } catch (e) {
        if (isPermanentRejection(e)) continue;
        break;
      }
    }
  } finally {
    draining = false;
  }
}

if (typeof window !== 'undefined') {
  // No manual "Sync Now" needed under normal circumstances — this is what
  // makes reconnect auto-sync.
  onConnectivityChange((online) => {
    if (online) drainQueue();
  });
  // Slow background safety net: covers a drain that silently stalled (e.g.
  // the 'online' event fired just before the network was actually usable)
  // without needing the user to notice and hit Sync Now.
  setInterval(() => {
    if (isOnline()) drainQueue();
  }, 30000);
}
