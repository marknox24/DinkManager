import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEventById, listCategories } from '../data/eventsApi';
import { listScheduleMatchesForEvent } from '../data/bracketsApi';
import { deriveLadder, readPlan } from '../data/playoffApi';
import { readWithFallback } from '../lib/offlineRead';
import { getMeta, setMeta } from '../lib/offlineDb';
import { buildTimetable } from '../utils/timetable';
import { useNow } from './useNow';

const REFRESH_MS = 10000;
// Event settings (courts, match length, start time) and the category list
// change rarely — re-read them on a slower cadence than the matches.
const STATIC_REFRESH_MS = 60000;

const cacheKey = (eventId) => `schedule:${eventId}`;

// Loads everything the estimated timetable is built from and keeps it fresh:
// matches every 10s (paused while the tab is hidden), event settings and
// categories every minute. The timetable itself is recomputed on every
// render tick, so "in 12 min" labels stay current between polls.
// `offlineCapable` (organizer page) mirrors the result into IndexedDB and
// falls back to it when offline; the public page has no offline mode.
export function useMatchSchedule({ event: initialEvent, categories: initialCategories, offlineCapable = false }) {
  const eventId = initialEvent.id;
  const [event, setEvent] = useState(initialEvent);
  const [categories, setCategories] = useState(initialCategories);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const inFlightRef = useRef(false);
  const lastStaticRef = useRef(0);
  const categoriesRef = useRef(initialCategories);
  const now = useNow(15000);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (Date.now() - lastStaticRef.current >= STATIC_REFRESH_MS) {
        lastStaticRef.current = Date.now();
        // Non-fatal: keep showing the last known settings if this blips.
        const [ev, cats] = await Promise.all([getEventById(eventId).catch(() => null), listCategories(eventId).catch(() => null)]);
        if (ev) setEvent(ev);
        if (cats) {
          setCategories(cats);
          categoriesRef.current = cats;
        }
      }
      const ids = categoriesRef.current.map((c) => c.id);
      if (offlineCapable) {
        const result = await readWithFallback({
          live: () => listScheduleMatchesForEvent(ids),
          readCache: async () => (await getMeta(cacheKey(eventId)))?.rows ?? null,
          writeCache: (rows) => setMeta(cacheKey(eventId), { cachedAt: Date.now(), rows }),
          retryDelaysMs: [600, 1200],
          hasCachedData: (rows) => Array.isArray(rows),
        });
        if (result.data) {
          setMatches(result.data);
          setFromCache(result.source === 'cache');
          setError(null);
          if (result.source === 'live') setUpdatedAt(Date.now());
        } else {
          setError(result.error?.message || 'Could not load the schedule.');
        }
      } else {
        setMatches(await listScheduleMatchesForEvent(ids));
        setFromCache(false);
        setError(null);
        setUpdatedAt(Date.now());
      }
    } catch (e) {
      // Keep whatever we already have on screen; only surface the error when
      // there's nothing to show yet.
      setError(e.message || 'Could not load the schedule.');
    } finally {
      inFlightRef.current = false;
    }
  }, [eventId, offlineCapable]);

  useEffect(() => {
    let intervalId = null;
    const start = () => {
      if (intervalId == null) intervalId = setInterval(refresh, REFRESH_MS);
    };
    const stop = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        refresh();
        start();
      }
    };
    lastStaticRef.current = Date.now(); // event + categories just arrived as props
    refresh();
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const timetable = useMemo(() => {
    if (!matches) return null;
    const withLadders = categories.map((c) => ({ ...c, ladder: c.playoff_enabled ? deriveLadder(readPlan(c)) : null }));
    return buildTimetable({ event, categories: withLadders, matches, now });
  }, [event, categories, matches, now]);

  return { event, categories, timetable, loading: matches == null && !error, error: matches == null ? error : null, fromCache, updatedAt, refresh };
}
