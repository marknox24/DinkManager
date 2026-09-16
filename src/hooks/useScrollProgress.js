import { useEffect, useRef, useState } from 'react';

// 0 → 1 progress of how far the viewport has scrolled through a section,
// measured from "top of section at top of viewport" to "top of section
// `distance`px above the viewport". Used for scroll-linked depth/crossfade
// effects — deliberately not full 0→1 over the whole section height,
// since that would make the effect run too slowly to read as intentional.
export default function useScrollProgress(distance = 600) {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const p = Math.min(Math.max(-rect.top / distance, 0), 1);
        setProgress(p);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [distance]);

  return [ref, progress];
}
