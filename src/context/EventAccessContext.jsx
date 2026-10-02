import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getEventById } from '../data/eventsApi';
import { getMyStaffRow } from '../data/staffApi';
import { EVENT_PERMISSIONS } from '../data/permissions';
import { cacheEvent, getCachedEvent } from '../hooks/useOfflineCache';
import { isOnline, onConnectivityChange } from '../lib/connectivity';

const EventAccessContext = createContext(null);

export function useEventAccess() {
  const ctx = useContext(EventAccessContext);
  if (!ctx) throw new Error('useEventAccess must be used within EventAccessProvider');
  return ctx;
}

// Fetches the event itself, its owner, and (if the current user isn't the
// owner) their staff permission row once per event mount, then exposes a
// single `can()` check plus the event object so every page under this
// provider reads from here instead of each independently re-fetching the
// same row. A context rather than a bare hook because every page under
// EventWorkspaceRoute needs this data, and a hook alone would fetch it once
// per page instead of once per event.
export function EventAccessProvider({ eventId, children }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [organizerId, setOrganizerId] = useState(null);
  const [staffRow, setStaffRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `dm_cached_access:${eventId}:${user.id}`;

    // Offline or network error: a stale-but-real permission set is always
    // safer than a false "no access" redirect, so restore the last-known-
    // good access from cache instead of nulling it out. Returns whether a
    // cache was found, so callers can tell "restored" from "nothing to
    // restore" (first-ever visit to this event with genuinely no access).
    async function restoreFromCache() {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return false;
        const { organizerId: cachedOrganizerId, staffRow: cachedStaffRow } = JSON.parse(cached);
        const cachedEvent = await getCachedEvent(eventId).catch(() => null);
        if (cancelled) return true;
        setOrganizerId(cachedOrganizerId);
        setStaffRow(cachedStaffRow);
        setEvent((prev) => prev ?? cachedEvent ?? null);
        return true;
      } catch {
        // Malformed/unavailable storage.
        return false;
      }
    }

    // `background: true` is used for a reconnect/toggle-off refresh — it
    // must NOT flip `loading` back to true, which would unmount every page
    // under EventAccessBoundary (closing whatever modal/form the organizer
    // has open) just because access is being quietly re-verified.
    async function fetchAccess({ background = false } = {}) {
      if (!background) setLoading(true);

      if (!isOnline() && !background) {
        // Nothing to wait on — go straight to whatever's cached instead of
        // attempting (and waiting out) a live call known to be skipped.
        const restored = await restoreFromCache();
        if (cancelled) return;
        if (restored) {
          setLoading(false);
          return;
        }
        // No cache at all: fall through to one bare live attempt below —
        // same reasoning as offlineRead.js's cache-miss path.
      }

      try {
        const [fetchedEvent, staff] = await Promise.all([getEventById(eventId), getMyStaffRow(eventId, user.id)]);
        if (cancelled) return;
        setEvent(fetchedEvent);
        setOrganizerId(fetchedEvent.organizer_id);
        setStaffRow(staff);
        cacheEvent(fetchedEvent).catch(() => {});
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ organizerId: fetchedEvent.organizer_id, staffRow: staff, cachedAt: Date.now() }));
        } catch {
          // Storage full/unavailable — the in-memory access state is still correct.
        }
      } catch (err) {
        if (cancelled) return;
        // .single() found no visible row — access was revoked or the
        // event was deleted. A stale cache here would wrongly let a
        // de-staffed user keep seeing this event, so clear it and let
        // EventAccessLayout's gate redirect to /dashboard.
        if (err?.code === 'PGRST116') {
          try {
            localStorage.removeItem(cacheKey);
          } catch {
            // Best-effort only.
          }
          setEvent(null);
          setOrganizerId(null);
          setStaffRow(null);
        } else {
          const restored = await restoreFromCache();
          if (cancelled) return;
          if (!restored) {
            setEvent(null);
            setOrganizerId(null);
            setStaffRow(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAccess();
    // Self-corrects a stale cached permission set as soon as connectivity
    // returns — including turning "Offline mode" back off, since isOnline()
    // (connectivity.js) already folds that flag in — rather than waiting
    // for the next remount of this provider.
    const unsubscribe = onConnectivityChange((online) => {
      if (online) fetchAccess({ background: true });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId, user.id]);

  // Lets a page that just saved changes (EventEditorPage, SettingsPage,
  // AccountingPage) push the result into this shared cache immediately, so
  // other event pages reached right after show the fresh data instead of
  // stale pre-edit values. Re-fetches from the server instead of trusting a
  // local patch, so a failed/partial save can't propagate a wrong value.
  const refreshEvent = useCallback(async () => {
    const ev = await getEventById(eventId);
    setEvent(ev);
    cacheEvent(ev).catch(() => {});
    return ev;
  }, [eventId]);

  // accessValue changes only when access itself changes (not on every event
  // edit), so pages that only read `can()`/`isOwner` don't re-render on
  // every keystroke-driven optimistic event update elsewhere in the tree.
  const accessValue = useMemo(() => {
    const isOwner = Boolean(organizerId && organizerId === user.id);
    const isStaff = Boolean(staffRow);
    // Mirrors has_event_permission()'s expiry gate in schema.sql — checked
    // client-side too so the nav/UI degrades with a clear message instead
    // of silently failing every request once the database starts rejecting
    // them (a temporary login's whole point is that this actually happens).
    const accessExpired = Boolean(staffRow?.access_expires_at && new Date(staffRow.access_expires_at) <= new Date());

    const can = (key) => {
      if (isOwner) return true;
      if (!key || !staffRow || accessExpired) return false;
      const perm = EVENT_PERMISSIONS.find((p) => p.key === key);
      if (!perm) return false;
      return Boolean(staffRow[perm.column]);
    };

    const allowedNavIds = EVENT_PERMISSIONS.filter((p) => p.navId && can(p.key)).map((p) => p.navId);
    const firstAllowedNavId = isOwner ? 'overview' : allowedNavIds[0] || null;

    return { isOwner, isStaff, staffRow, can, allowedNavIds, firstAllowedNavId, accessExpired };
  }, [organizerId, staffRow, user.id]);

  const value = useMemo(
    () => ({ ...accessValue, loading, event, setEvent, refreshEvent }),
    [accessValue, loading, event, refreshEvent]
  );

  return <EventAccessContext.Provider value={value}>{children}</EventAccessContext.Provider>;
}
