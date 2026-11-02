import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEventById, listCategories, loadPublicEventBundle } from '../data/eventsApi';
import { listScheduleMatchesForEvent, listScheduleMatchesPublic, listTeamsForEvent, listTeamsPublic } from '../data/bracketsApi';
import { readWithFallback } from '../lib/offlineRead';
import { getMeta, setMeta } from '../lib/offlineDb';
import { buildTimetable, eventIsOver } from '../utils/timetable';
import { bracketTreeApplies, buildBracketTreesForCategory, treeHasRealMatch } from '../utils/bracketTree';
import { categoryLadder } from '../utils/playoffLadder';
import { useNow } from './useNow';

// The organizer desk needs near-live scores; spectators on the public page
// don't, and there can be hundreds of them each downloading every match in
// the event — so they poll 3x less often (and the static data 3x less again).
const ORGANIZER_REFRESH_MS = 10000;
const PUBLIC_REFRESH_MS = 30000;
// Event settings (courts, match length, start time) and the category list
// change rarely — re-read them on a slower cadence than the matches.
const ORGANIZER_STATIC_REFRESH_MS = 60000;
const PUBLIC_STATIC_REFRESH_MS = 600000;
// A public poll whose cached read fails keeps what's on screen and waits for
// the next one, so a struggling database isn't hit by every phone at once.
// This caps how long that goes on: past it, a phone is allowed one direct read,
// so a cached endpoint that stays down can't freeze the page. A first load
// (nothing on screen yet) is always past it.
const MAX_PUBLIC_DATA_AGE_MS = 120000;

const cacheKey = (eventId) => `schedule:${eventId}`;

// Loads everything the estimated timetable is built from and keeps it fresh:
// matches every 10s (paused while the tab is hidden), event settings and
// categories every minute. The timetable itself is recomputed on every
// render tick, so "in 12 min" labels stay current between polls.
// `offlineCapable` (organizer page) mirrors the result into IndexedDB and
// falls back to it when offline; the public page has no offline mode.
// `view` ('schedule' or 'bracket') is which of the two results the caller
// shows. Only that one gets computed, and teams are only loaded for brackets:
// every spectator's phone is running this all day.
export function useMatchSchedule({ view, event: initialEvent, categories: initialCategories, offlineCapable = false }) {
  const eventId = initialEvent.id;
  const [event, setEvent] = useState(initialEvent);
  const [categories, setCategories] = useState(initialCategories);
  const [matches, setMatches] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const inFlightRef = useRef(false);
  const lastStaticRef = useRef(0);
  const categoriesRef = useRef(initialCategories);
  const lastPublicMatchesAtRef = useRef(0);
  const now = useNow(15000);
  const wantsBrackets = view === 'bracket';
  const refreshMs = offlineCapable ? ORGANIZER_REFRESH_MS : PUBLIC_REFRESH_MS;
  const staticRefreshMs = offlineCapable ? ORGANIZER_STATIC_REFRESH_MS : PUBLIC_STATIC_REFRESH_MS;

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (Date.now() - lastStaticRef.current >= staticRefreshMs) {
        lastStaticRef.current = Date.now();
        if (offlineCapable) {
          // Non-fatal: keep showing the last known settings if this blips.
          // Teams ride along on this slow cadence, not the 10s match poll —
          // who's registered for a bracket doesn't change mid-match the way
          // scores and live status do.
          const [ev, cats] = await Promise.all([getEventById(eventId).catch(() => null), listCategories(eventId).catch(() => null)]);
          if (ev) setEvent(ev);
          if (cats) {
            setCategories(cats);
            categoriesRef.current = cats;
            if (wantsBrackets) {
              listTeamsForEvent(cats.map((c) => c.id))
                .then(setTeams)
                .catch(() => {});
            }
          }
        } else {
          // Public viewers: route through the same CDN-cached bundle the
          // page itself used at mount, so a category the organizer adds
          // mid-event eventually shows up here too — categoriesRef used to
          // be frozen at whatever was passed in at mount and never updated,
          // so a spectator who opened the page before a new category
          // existed would never see it without a manual reload.
          const bundle = await loadPublicEventBundle({ id: eventId }).catch(() => null);
          if (bundle?.categories) {
            setEvent(bundle.event);
            setCategories(bundle.categories);
            categoriesRef.current = bundle.categories;
          }
          if (wantsBrackets) {
            listTeamsPublic(categoriesRef.current.map((c) => c.id), { directFallback: false })
              .then((rows) => rows && setTeams(rows))
              .catch(() => {});
          }
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
        const rows = await listScheduleMatchesPublic(ids, { directFallback: Date.now() - lastPublicMatchesAtRef.current >= MAX_PUBLIC_DATA_AGE_MS });
        if (rows) {
          lastPublicMatchesAtRef.current = Date.now();
          setMatches(rows);
          setFromCache(false);
          setError(null);
          setUpdatedAt(Date.now());
        }
      }
    } catch (e) {
      // Keep whatever we already have on screen; only surface the error when
      // there's nothing to show yet.
      setError(e.message || 'Could not load the schedule.');
    } finally {
      inFlightRef.current = false;
    }
  }, [eventId, offlineCapable, staticRefreshMs, wantsBrackets]);

  useEffect(() => {
    let intervalId = null;
    const start = () => {
      // ±15% jitter so a crowd that opened the page together doesn't hit the
      // database in lockstep every interval.
      if (intervalId == null) intervalId = setInterval(refresh, Math.round(refreshMs * (0.85 + Math.random() * 0.3)));
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
    // ...but teams didn't — unlike event/categories there's no fresh initial
    // value for them to skip re-fetching, so they need their own one-time
    // mount fetch instead of waiting for the next static-refresh tick.
    if (wantsBrackets) {
      (offlineCapable ? listTeamsForEvent : listTeamsPublic)(categoriesRef.current.map((c) => c.id))
        .then(setTeams)
        .catch(() => {});
    }
    refresh();
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, refreshMs, offlineCapable, wantsBrackets]);

  const withLadders = useMemo(() => categories.map((c) => ({ ...c, ladder: categoryLadder(c) })), [categories]);

  const timetable = useMemo(() => {
    if (!matches || wantsBrackets) return null;
    return buildTimetable({ event, categories: withLadders, matches, now });
  }, [event, withLadders, matches, now, wantsBrackets]);

  // One entry per category that has a drawable bracket shape (Single
  // Elimination, or playoff-enabled) — reuses the same matches/categories
  // already fetched for the schedule, no extra network round trip. See
  // utils/bracketTree.js for what "applicable"/"trees"/"entrants" mean.
  // Kept even when `trees` is empty but `entrants` isn't — a Single
  // Elimination category with teams registered but no bracket drawn yet
  // still has an entrant list worth showing. A finished event's placeholder-
  // only ladder is dropped: those knockouts were never played, and the plan
  // behind the placeholders may not even match the pools that were drawn.
  const over = eventIsOver(event, now);
  const categoryTrees = useMemo(() => {
    if (!matches || !wantsBrackets) return [];
    return withLadders
      .filter((c) => bracketTreeApplies(c))
      .map((c) => {
        const built = buildBracketTreesForCategory(c, matches, teams);
        return { category: c, ...built, trees: over ? built.trees.filter(treeHasRealMatch) : built.trees };
      })
      .filter((entry) => entry.trees.length > 0 || entry.entrants.length > 0);
  }, [over, withLadders, matches, teams, wantsBrackets]);

  return { event, categories, timetable, categoryTrees, now, loading: matches == null && !error, error: matches == null ? error : null, fromCache, updatedAt, refresh };
}
