import { getEventMediaUrl } from '../../data/eventsApi';
import { SPONSOR_TIERS } from '../../data/constants';

// Thin, muted footer strip for the Preview Screen — deliberately small and
// low-contrast (compact height, soft glass background, small logos) so it
// reads as a credits bar under the standings tables rather than competing
// with them for attention. Renders nothing when there are no sponsors.
export default function SponsorMarquee({ sponsors }) {
  if (!sponsors || sponsors.length === 0) return null;

  // One copy of the track, duplicated, scrolled exactly -50% in CSS — the
  // seam is invisible as long as both copies are identical. Speed is tied
  // to sponsor count so a single sponsor doesn't fly by and twenty don't crawl.
  const track = [...sponsors, ...sponsors];
  const durationSeconds = Math.max(14, sponsors.length * 5);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.05)] backdrop-blur-xl">
      <div className="flex items-center gap-4 px-5 py-3">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-400">Thanks to our sponsors</span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-max animate-marquee items-center gap-10"
            style={{ animationDuration: `${durationSeconds}s` }}
          >
            {track.map((s, i) => (
              <div key={`${s.id}-${i}`} className="flex shrink-0 items-center gap-2" aria-hidden={i >= sponsors.length}>
                {s.logo_path ? (
                  <img src={getEventMediaUrl(s.logo_path)} alt={s.name} className="h-7 w-auto max-w-[96px] object-contain opacity-80" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${SPONSOR_TIERS[s.tier]?.dot || 'bg-ink-300'}`} />
                )}
                <span className="whitespace-nowrap text-xs font-semibold text-ink-500">{s.name}</span>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/70 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/70 to-transparent" />
        </div>
      </div>
    </div>
  );
}
