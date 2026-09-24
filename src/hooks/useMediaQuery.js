import { useSyncExternalStore } from 'react';

// Whether a CSS media query currently matches, kept in sync as the window
// resizes or rotates. For layout decisions CSS alone can't make — e.g. the
// Preview Screen only auto-rotates pages on a big display, never on a phone
// someone is scrolling. Defaults to false where matchMedia doesn't exist.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false
  );
}
