import { Star } from 'lucide-react';
import AutoCarousel from '../organizer/AutoCarousel';

// Sample content — swap for real customer quotes once DinkManager has them.
const TESTIMONIALS = [
  {
    quote: 'We ran a 60-team weekend tournament without a single scheduling headache. Brackets, courts, and scores just stayed in sync.',
    name: 'Maria Chen',
    title: 'Tournament Director, Riverside Pickleball Club',
  },
  {
    quote: 'Registration used to be a spreadsheet nightmare. Now players sign up themselves and I can see live standings from my phone.',
    name: 'Devon Alvarez',
    title: 'Club Organizer, Sunset Courts',
  },
  {
    quote: 'The live preview screen on the big TV kept every player and spectator glued to the action all weekend.',
    name: 'Priya Nair',
    title: 'Event Coordinator, Coastal Dink Series',
  },
];

function Initials({ name }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
      {initials}
    </span>
  );
}

export default function AuthShowcasePanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-950 p-10 lg:flex">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-300/20 blur-3xl" />

      <div className="relative">
        <h2 className="font-display text-3xl font-extrabold leading-tight text-white">
          Run flawless
          <br />
          pickleball tournaments
        </h2>
        <p className="mt-3 max-w-sm text-sm text-brand-100/90">
          Brackets, live scoring, court management, and player registration — all in one place.
        </p>
      </div>

      <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
        <AutoCarousel
          items={TESTIMONIALS}
          intervalMs={7000}
          emptyMessage=""
          renderItem={(t) => (
            <div>
              <div className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-white/90">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 flex items-center gap-2.5">
                <Initials name={t.name} />
                <div className="leading-tight">
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-xs text-brand-100/70">{t.title}</div>
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
