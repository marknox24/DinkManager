import { useState } from 'react';
import { Circle, CircleDot, Feather, Target, Volleyball } from 'lucide-react';
import Reveal from './Reveal';

const SPORTS = [
  { id: 'pickleball', label: 'Pickleball', icon: CircleDot, live: true },
  { id: 'basketball', label: 'Basketball', icon: Circle, live: false },
  { id: 'volleyball', label: 'Volleyball', icon: Volleyball, live: false },
  { id: 'badminton', label: 'Badminton', icon: Feather, live: false },
  { id: 'tennis', label: 'Tennis', icon: Target, live: false },
];

export default function SportsExpansion() {
  const [active, setActive] = useState(SPORTS[0]);

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">
            Built around sport.
            <br className="hidden sm:block" /> Not just one sport.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-ink-500">
            DinkManager starts with pickleball. The same registration, brackets, and scheduling
            engine is built to run any bracket-and-schedule sport next.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          {SPORTS.map((sport) => (
            <button
              key={sport.id}
              onClick={() => setActive(sport)}
              className={`press-scale flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors duration-200 ${
                active.id === sport.id ? 'border-accent-coral bg-accent-coral text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
              }`}
            >
              <sport.icon size={15} />
              {sport.label}
            </button>
          ))}
        </Reveal>

        <Reveal delay={160} className="mx-auto mt-8 max-w-sm">
          <div key={active.id} className="animate-rise-in flex items-center justify-between rounded-2xl border border-ink-100 bg-ink-50/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <active.icon size={18} className="text-accent-coral" />
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-ink-900">{active.label} tournaments</p>
                <p className="text-xs text-ink-500">Registration, brackets &amp; scheduling</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active.live ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
              {active.live ? 'Live today' : 'Coming soon'}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
