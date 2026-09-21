import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getEventMediaUrl } from '../../data/eventsApi';

// Gold and silver get visually distinct treatment (warm amber gradient vs
// cool slate gradient) so the two tiers read apart at a glance on the TV
// display, while staying within the page's existing glass-card language.
const TIER_STYLES = {
  gold: {
    label: 'Gold Sponsor',
    wrapper: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white',
    badge: 'bg-amber-100 text-amber-700',
    dotActive: 'bg-amber-500',
    dotInactive: 'bg-amber-200',
    arrow: 'text-amber-600 hover:bg-amber-100/80',
  },
  silver: {
    label: 'Silver Sponsor',
    wrapper: 'border-slate-200/80 bg-gradient-to-br from-slate-50 to-white',
    badge: 'bg-slate-200 text-slate-600',
    dotActive: 'bg-slate-500',
    dotInactive: 'bg-slate-300',
    arrow: 'text-slate-500 hover:bg-slate-100/80',
  },
};

const SLIDE_MS = 4500;

// One tier's box — a single sponsor renders statically (no timer, no dots,
// no arrows); two or more slide horizontally, one at a time, auto-advancing
// with manual arrow/dot override. Renders nothing when the tier has no
// sponsors, so an empty category never shows a blank box on the display.
export default function SponsorBox({ tier, sponsors }) {
  const style = TIER_STYLES[tier];
  const count = sponsors.length;
  const [index, setIndex] = useState(0);

  // Reset to the first logo if the roster changes size (e.g. a sponsor was
  // removed mid-event) so `index` can never point past the new end.
  useEffect(() => setIndex(0), [count]);

  useEffect(() => {
    if (count <= 1) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return null;

  // Clamped at render time, not just in the post-paint effect above — if a
  // sponsor is deleted while a later slide is showing, the render that
  // happens before that effect runs would otherwise transform the track
  // past its own end (a one-frame blank/off-screen flicker before the
  // effect corrects it). Reading safeIndex everywhere below means that
  // frame never happens in the first place.
  const safeIndex = Math.min(index, count - 1);

  const goTo = (next) => setIndex(((next % count) + count) % count);

  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 ${style.wrapper}`}>
      <div className="mb-3 flex items-center justify-center">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>{style.label}</span>
      </div>

      <div className="relative h-16 overflow-hidden sm:h-20 lg:h-24">
        {/* Every slide sits side by side in one flex row; sliding the whole
            row by index * 100% is what makes this a true horizontal
            carousel rather than a crossfade — only one logo is ever
            visible, and the move between them is a slide, not a fade. */}
        <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
          {sponsors.map((s, i) => (
            <div key={s.id} className="flex h-full w-full shrink-0 items-center justify-center px-6" aria-hidden={i !== safeIndex}>
              {s.logo_path ? (
                // loading="lazy" on the ones not currently shown — without it every
                // logo in the tier fetches immediately regardless of which slide is
                // active, wasting bandwidth on displays with many sponsors.
                <img
                  src={getEventMediaUrl(s.logo_path)}
                  alt={s.name}
                  loading={i === safeIndex ? 'eager' : 'lazy'}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-center text-sm font-bold leading-tight text-ink-600">{s.name}</span>
              )}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              onClick={() => goTo(safeIndex - 1)}
              aria-label="Previous sponsor"
              className={`absolute left-0.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition ${style.arrow}`}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => goTo(safeIndex + 1)}
              aria-label="Next sponsor"
              className={`absolute right-0.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition ${style.arrow}`}
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {sponsors.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to sponsor ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === safeIndex ? `w-4 ${style.dotActive}` : `w-1.5 ${style.dotInactive}`}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
