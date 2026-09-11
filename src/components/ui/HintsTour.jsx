import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Lightweight first-time-user walkthrough: highlights real page elements
// (found via `data-tour="<id>"` attributes) with a glowing ring and a
// floating tooltip, advanced with Next/Back or dismissed with Escape/Skip.
// No dimming overlay and no external tour library — just enough to point
// a first-time organizer at the handful of things that matter.
export default function HintsTour({ steps, storageKey }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Boolean(localStorage.getItem(storageKey));
    } catch {
      return true;
    }
  });
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[index];

  const finish = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Private browsing — the tour just won't remember it was seen.
    }
  };

  const next = () => {
    if (index >= steps.length - 1) finish();
    else setIndex((i) => i + 1);
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (dismissed) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'Enter' || e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, index]);

  useEffect(() => {
    if (dismissed || !step) return undefined;
    let raf;
    const locate = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        // Target not mounted yet (still loading) — keep checking briefly.
        raf = requestAnimationFrame(locate);
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const update = () => setRect(el.getBoundingClientRect());
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      locate.cleanup = () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
      };
    };
    locate();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      locate.cleanup?.();
    };
  }, [index, dismissed, step]);

  if (dismissed || !step || !rect) return null;

  const spacing = 12;
  const wantsBelow = rect.bottom + 180 < window.innerHeight;
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 300);

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed z-[9500] rounded-xl ring-[3px] ring-brand-400 ring-offset-2 ring-offset-white transition-all duration-300"
        style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
      />
      <div
        className="animate-modal-in fixed z-[9500] w-72 rounded-2xl bg-ink-950 p-4 text-white shadow-2xl"
        style={
          wantsBelow
            ? { top: rect.bottom + spacing, left }
            : { bottom: window.innerHeight - rect.top + spacing, left }
        }
      >
        <button onClick={finish} className="absolute right-3 top-3 text-white/50 transition hover:text-white">
          <X size={14} />
        </button>
        <div className="text-[10px] font-bold uppercase tracking-wide text-brand-300">
          Step {index + 1} of {steps.length}
        </div>
        <div className="mt-1 pr-4 text-sm font-bold">{step.title}</div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/70">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs font-semibold text-white/50 transition hover:text-white">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button onClick={back} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10">
                Back
              </button>
            )}
            <button onClick={next} className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-400">
              {index === steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
