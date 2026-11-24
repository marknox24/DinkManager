import { useCallback, useState } from 'react';

// Which printable score sheet layout the organizer last picked — 'v1' (the
// original 18-box table) or 'v2' (the 0–15 rally strip, three per A4 page).
// Remembered per device so the choice sticks between the round-robin and
// blank sheet previews and across visits; falls back to V1 whenever storage
// is unavailable.
const KEY = 'dink.scoreSheetTemplate';

function readTemplate() {
  try {
    return localStorage.getItem(KEY) === 'v2' ? 'v2' : 'v1';
  } catch {
    return 'v1';
  }
}

export function useScoreSheetTemplate() {
  const [template, setTemplateState] = useState(readTemplate);
  const setTemplate = useCallback((next) => {
    setTemplateState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode / blocked storage: the choice just won't be remembered.
    }
  }, []);
  return [template, setTemplate];
}
