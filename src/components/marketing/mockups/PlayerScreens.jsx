import { CalendarDays, CheckCircle2, ChevronRight, MapPin, Trophy } from 'lucide-react';

const TOURNAMENTS = [
  { name: 'Lakeside Fall Classic', date: 'Oct 18–19', spots: '12 spots left' },
  { name: 'Riverside Community Open', date: 'Nov 2', spots: '28 spots left' },
  { name: 'Club Championship', date: 'Nov 15–16', spots: '6 spots left' },
];

export function DiscoverScreen() {
  return (
    <div className="flex h-full flex-col bg-white px-4 pb-4 pt-9 text-left">
      <p className="mb-3 font-display text-lg font-bold text-ink-900">Find a tournament</p>
      <div className="flex flex-col gap-2.5">
        {TOURNAMENTS.map((t, i) => (
          <div key={t.name} className={`rounded-2xl border p-3.5 ${i === 0 ? 'border-accent-coral bg-accent-coral-50/60' : 'border-ink-100 bg-white'}`}>
            <p className="text-sm font-bold text-ink-900">{t.name}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-500">
              <CalendarDays size={11} /> {t.date}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-accent-coral-dark">{t.spots}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RegisterScreen() {
  return (
    <div className="flex h-full flex-col bg-white px-4 pb-4 pt-9 text-left">
      <p className="font-display text-lg font-bold text-ink-900">Register</p>
      <p className="mb-4 text-xs text-ink-500">Lakeside Fall Classic</p>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Category</p>
          <div className="rounded-xl border border-accent-coral bg-accent-coral-50/60 px-3.5 py-2.5 text-sm font-semibold text-ink-800">
            Mixed Doubles Open
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Partner</p>
          <div className="rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm text-ink-500">Jules Foster</div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Skill level</p>
          <div className="rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm text-ink-500">4.0</div>
        </div>
      </div>
      <div className="mt-auto rounded-xl bg-accent-coral py-3 text-center text-sm font-bold text-white">Confirm registration</div>
    </div>
  );
}

export function ConfirmationScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-white px-6 pb-4 pt-9 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 size={32} className="text-emerald-600" />
      </span>
      <p className="mt-4 font-display text-lg font-bold text-ink-900">You're in!</p>
      <p className="mt-1 text-xs text-ink-500">Mixed Doubles Open · Lakeside Fall Classic</p>
      <div className="mt-6 w-full rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-left">
        <p className="flex items-center gap-1.5 text-xs text-ink-600">
          <CalendarDays size={12} /> Oct 18–19
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-600">
          <MapPin size={12} /> Lakeside Courts
        </p>
      </div>
    </div>
  );
}

const SCHEDULE = [
  { round: 'Round 1', opponent: 'Ortiz / Reyes', court: 'Court 3', time: '9:00 AM', done: true },
  { round: 'Round 2', opponent: 'Patel / Kim', court: 'Court 1', time: '11:20 AM', done: false, live: true },
  { round: 'Quarterfinal', opponent: 'TBD', court: 'TBD', time: '1:30 PM', done: false },
];

export function ScheduleScreen() {
  return (
    <div className="flex h-full flex-col bg-white px-4 pb-4 pt-9 text-left">
      <p className="mb-3 font-display text-lg font-bold text-ink-900">Your matches</p>
      <div className="flex flex-col gap-2.5">
        {SCHEDULE.map((m) => (
          <div key={m.round} className={`rounded-2xl border p-3.5 ${m.live ? 'border-accent-coral bg-accent-coral-50/60' : 'border-ink-100'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{m.round}</p>
              {m.live && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-accent-coral-dark">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-coral animate-pulse-soft" /> Live
                </span>
              )}
              {m.done && <CheckCircle2 size={13} className="text-emerald-600" />}
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-800">vs {m.opponent}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{m.court} · {m.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerResultsScreen() {
  return (
    <div className="flex h-full flex-col bg-white px-4 pb-4 pt-9 text-left">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-accent-coral" />
        <p className="font-display text-lg font-bold text-ink-900">Results</p>
      </div>
      <div className="mt-4 rounded-2xl border border-accent-coral bg-accent-coral-50/60 p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-coral-dark">Mixed Doubles Open</p>
        <p className="mt-1 font-display text-2xl font-bold text-ink-900">2nd Place</p>
        <p className="mt-1 text-xs text-ink-500">You &amp; Jules Foster</p>
      </div>
      <button className="mt-4 flex items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5 text-sm font-semibold text-ink-700">
        View full bracket <ChevronRight size={14} className="text-ink-300" />
      </button>
    </div>
  );
}
