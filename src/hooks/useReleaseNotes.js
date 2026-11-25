import { useEffect, useState } from 'react';
import { fetchCachedJson } from '../lib/cachedFetch';
import { isReleaseNoteList } from '../utils/releaseNotes';

// The build's own copy of the update list (see vite.config.js), shown right
// away so nothing pops in; replaced by the live list once it arrives.
function buildCopy() {
  try {
    const notes = JSON.parse(import.meta.env.VITE_RELEASE_NOTES || '[]');
    return isReleaseNoteList(notes) ? notes : [];
  } catch {
    return [];
  }
}

export function useReleaseNotes(limit) {
  const [notes, setNotes] = useState(() => buildCopy().slice(0, limit));
  useEffect(() => {
    let cancelled = false;
    fetchCachedJson(`/api/recent-updates?limit=${limit}`, isReleaseNoteList)
      .then((live) => {
        if (!cancelled && live?.length) setNotes(live);
      })
      .catch(() => {
        // Keep the build copy.
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);
  return notes;
}
