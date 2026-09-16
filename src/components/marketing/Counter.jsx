import { useEffect, useRef, useState } from 'react';
import useReveal from '../../hooks/useReveal';

// Counts up from 0 to `value` once the stat scrolls into view. Runs on
// rAF (not setInterval) so it stays smooth and stops cleanly on unmount.
export default function Counter({ value, suffix = '', duration = 1400 }) {
  const [ref, visible] = useReveal({ threshold: 0.6 });
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    let raf;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(ease(progress) * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
