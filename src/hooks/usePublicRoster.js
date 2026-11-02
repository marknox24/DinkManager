import { useEffect, useState } from 'react';
import { loadPublicRoster } from '../data/eventsApi';

// Loads the event's public roster once, for the page's players strip and
// Who's playing section to share. `eventId` is undefined until the event has
// loaded.
export function usePublicRoster(eventId) {
  const [roster, setRoster] = useState({ rows: [], loading: true, error: null });

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    loadPublicRoster(eventId)
      .then((rows) => {
        if (!cancelled) setRoster({ rows, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setRoster({ rows: [], loading: false, error: e.message || 'Could not load the registered players.' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return roster;
}
