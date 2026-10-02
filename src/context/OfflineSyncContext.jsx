import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isForcedOffline, isOnline, onConnectivityChange, setForcedOffline } from '../lib/connectivity';
import { onQueueChange, getQueueStatusCounts, enqueueOperation, drainQueue, dismissEntry as dismissQueueEntry } from '../lib/syncQueue';
import { cacheMatches } from '../hooks/useOfflineCache';
import { deleteRecord } from '../lib/offlineDb';

const OfflineSyncContext = createContext(null);

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) throw new Error('useOfflineSync must be used within OfflineSyncProvider');
  return ctx;
}

// Mounted once in EventAccessLayout (EventRoute.jsx), above every event
// page — not just MatchListPage, which is all it originally covered. Any
// page under an event can enqueue writes or read `status`/`reconnectToken`
// the same way; the `eventId` it scopes writes to still comes from the
// route params, unchanged.
export function OfflineSyncProvider({ children }) {
  const { eventId } = useParams();
  const [online, setOnline] = useState(isOnline());
  const [forcedOffline, setForcedOfflineState] = useState(isForcedOffline());
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  // Transient "✅ Synced" flash distinct from steady-state "🟢 Online" —
  // true for a few seconds right after a drain that actually had something
  // to sync, then falls back to the idle Online state.
  const [justSynced, setJustSynced] = useState(false);
  // Bumped after every reconnect-triggered drain settles (even one with
  // nothing to sync) — pages that cached stale/offline data subscribe to
  // this to refresh themselves once there's actually something new to show,
  // instead of reacting to the raw `online` flip and reloading mid-drain.
  const [reconnectToken, setReconnectToken] = useState(0);

  const refreshCounts = useCallback(async () => {
    const { pending, failed } = await getQueueStatusCounts();
    setPendingCount(pending);
    setFailedCount(failed);
  }, []);

  useEffect(() => {
    refreshCounts();
    return onQueueChange(refreshCounts);
  }, [refreshCounts]);

  useEffect(() => onConnectivityChange(setOnline), []);
  useEffect(() => onConnectivityChange(() => setForcedOfflineState(isForcedOffline())), []);

  const runDrain = useCallback(async () => {
    const { pending: pendingBefore } = await getQueueStatusCounts();
    if (pendingBefore === 0) return;
    setSyncing(true);
    try {
      await drainQueue();
    } finally {
      setSyncing(false);
      setLastSyncedAt(new Date().toISOString());
      await refreshCounts();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3000);
    }
  }, [refreshCounts]);

  // Auto-syncs on reconnect with no button press required (requirement:
  // "do not require the user to manually press Sync under normal
  // circumstances") — syncQueue.js also does this itself for any other page
  // that might enqueue writes, but doing it here too keeps this pill's
  // "Syncing…" state accurate to a drain this specific mount triggered.
  // Only fires on an actual false→true transition (tracked via the ref, not
  // the initial mount) — reconnectToken is a "something may have changed,
  // go check" signal for pages, not "the page just loaded".
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) {
      runDrain().then(() => setReconnectToken((t) => t + 1));
    }
    wasOnline.current = online;
  }, [online, runDrain]);

  // Applies the write's optimistic result to the offline cache immediately
  // (so a hard-reload while still offline shows it, since MatchListPage's
  // loaders read this same cache on a failed network fetch) and enqueues it
  // for sync — flushed right away if online, held for the next drain
  // otherwise. Never rejects on a network failure; the write is safely
  // queued either way, which is what lets MatchListPage's handlers treat
  // this the same as the old direct-write calls (await it, show a success
  // toast, move on) regardless of connectivity.
  const enqueueWrite = useCallback(
    async ({ matchId, operationType, payload, optimisticMatch, optimisticDelete }) => {
      if (optimisticDelete) {
        await deleteRecord('matches', matchId);
      } else if (optimisticMatch) {
        await cacheMatches(eventId, optimisticMatch.category_id ?? null, [optimisticMatch]);
      }
      const result = await enqueueOperation({ eventId, matchId, operationType, payload });
      await refreshCounts();
      return result;
    },
    [eventId, refreshCounts]
  );

  // A failed entry was explicitly rejected by the server — see
  // syncQueue.js's dismissEntry for why retrying can't fix it. This drops it
  // from the queue and refreshes from the server so the optimistic cache
  // (which is now known to be wrong) gets corrected back to reality.
  const dismissFailed = useCallback(
    async (operationId) => {
      await dismissQueueEntry(operationId);
      await refreshCounts();
    },
    [refreshCounts]
  );

  const status = useMemo(() => {
    if (forcedOffline) return 'forced-offline';
    if (!online) return 'offline';
    if (syncing) return 'syncing';
    if (failedCount > 0) return 'sync-failed';
    if (pendingCount > 0) return 'pending';
    if (justSynced) return 'synced';
    return 'online';
  }, [forcedOffline, online, syncing, failedCount, pendingCount, justSynced]);

  const value = useMemo(
    () => ({
      status,
      online,
      forcedOffline,
      setForcedOffline,
      reconnectToken,
      pendingCount,
      failedCount,
      lastSyncedAt,
      syncNow: runDrain,
      enqueueWrite,
      dismissFailed,
    }),
    [status, online, forcedOffline, reconnectToken, pendingCount, failedCount, lastSyncedAt, runDrain, enqueueWrite, dismissFailed]
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}
