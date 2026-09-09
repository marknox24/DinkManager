import { useEffect, useState } from 'react';

// Re-renders the calling component every `intervalMs` so elapsed-time UI stays live
// without pushing per-second ticks through global state/localStorage.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
