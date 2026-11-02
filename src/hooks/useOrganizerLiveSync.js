import { useEffect, useRef } from 'react';
import { listMatchChangeRows } from '../data/bracketsApi';
import { isOnline } from '../lib/connectivity';
import { matchChangeSignature } from '../utils/organizerSync';

const CHECK_MS = 10000;

// Keeps an organizer's screen in step with the other organizers at the same
// event. Every 10 seconds (with some jitter, and not while the tab is hidden)
// one cheap read fingerprints the event's matches, and onChange only runs when
// the fingerprint moved, so an idle screen costs one query per check rather
// than a full reload. `paused` is for while this device has its own writes
// queued: reloading then would overwrite them with the older server state.
export function useOrganizerLiveSync({ categoryIds, paused, onChange }) {
  const onChangeRef = useRef(onChange);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onChangeRef.current = onChange;
    pausedRef.current = paused;
  });
  const idsKey = categoryIds.join(',');

  useEffect(() => {
    if (!idsKey) return undefined;
    const ids = idsKey.split(',');
    let cancelled = false;
    let inFlight = false;
    let lastSignature = null;

    const check = async () => {
      if (inFlight || pausedRef.current || !isOnline() || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const signature = matchChangeSignature(await listMatchChangeRows(ids));
        const changed = lastSignature !== null && signature !== lastSignature;
        lastSignature = signature;
        if (changed && !cancelled) await onChangeRef.current();
      } catch {
        // A missed check is harmless: the next one catches up.
      } finally {
        inFlight = false;
      }
    };

    check();
    const intervalId = setInterval(check, Math.round(CHECK_MS * (0.85 + Math.random() * 0.3)));
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', check);
    };
  }, [idsKey]);
}
