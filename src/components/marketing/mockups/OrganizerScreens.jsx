import { CalendarDays, CheckCircle2, CircleDot, MapPin, Settings2, Trophy, Users } from 'lucide-react';

const STAT_TILES = [
  { label: 'Registered players', value: '186', icon: Users },
  { label: 'Categories', value: '6', icon: Trophy },
  { label: 'Matches today', value: '42', icon: CircleDot },
];

const CATEGORIES = [
  { name: "Men's Doubles 3.5", players: 32, status: 'Bracket set' },
  { name: "Women's Doubles 4.0", players: 24, status: 'Bracket set' },
  { name: 'Mixed Doubles Open', players: 40, status: 'In progress' },
  { name: "Men's Singles 4.5", players: 16, status: 'Registration open' },
];

const STATUS_STYLE = {
  'Bracket set': 'bg-ink-100 text-ink-600',
  'In progress': 'bg-accent-coral-50 text-accent-coral-dark',
  'Registration open': 'bg-emerald-50 text-emerald-700',
};

export function DashboardScreen() {
  return (
    <div className="flex h-full flex-col bg-ink-50/60 p-5 text-left">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-display text-base font-bold text-ink-900">Lakeside Fall Classic</p>
          <p className="flex items-center gap-1 text-xs text-ink-500">
            <CalendarDays size={12} /> Oct 18–19 <span className="text-ink-300">·</span> <MapPin size={12} /> Lakeside Courts
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Live</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {STAT_TILES.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
            <Icon size={14} className="text-accent-coral" />
            <p className="mt-1.5 font-display text-lg font-bold text-ink-900">{value}</p>
            <p className="text-[10px] leading-tight text-ink-500">{label}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Categories</p>
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        {CATEGORIES.map((cat) => (
          <div key={cat.name} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-ink-800">{cat.name}</p>
              <p className="text-[11px] text-ink-400">{cat.players} players</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[cat.status]}`}>{cat.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SETUP_CATEGORIES = [
  { name: "Men's Doubles 3.5", format: 'Single Elim', size: 32 },
  { name: "Women's Doubles 4.0", format: 'Single Elim', size: 24 },
  { name: 'Mixed Doubles Open', format: 'Round Robin', size: 40 },
  { name: "Men's Singles 4.5", format: 'Double Elim', size: 16 },
];

export function CategoriesScreen() {
  return (
    <div className="flex h-full flex-col bg-white p-5 text-left">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 size={15} className="text-accent-coral" />
        <p className="font-display text-base font-bold text-ink-900">Tournament setup</p>
      </div>
      <div className="flex flex-col gap-2">
        {SETUP_CATEGORIES.map((c) => (
          <div key={c.name} className="flex items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5">
            <div>
              <p className="text-sm font-semibold text-ink-800">{c.name}</p>
              <p className="text-[11px] text-ink-400">Up to {c.size} players</p>
            </div>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">{c.format}</span>
          </div>
        ))}
        <button className="mt-1 rounded-xl border border-dashed border-ink-200 py-2.5 text-xs font-bold text-ink-400">
          + Add category
        </button>
      </div>
    </div>
  );
}

const PLAYERS = [
  { name: 'Maria Chen', partner: 'Jules Foster', category: "Women's Doubles 4.0", status: 'approved' },
  { name: 'Devon Ortiz', partner: 'Sam Reyes', category: 'Mixed Doubles Open', status: 'approved' },
  { name: 'Priya Nair', partner: '—', category: "Men's Singles 4.5", status: 'pending' },
  { name: 'Wes Thompson', partner: 'K. Boyd', category: "Men's Doubles 3.5", status: 'waitlisted' },
];

const REG_STATUS = {
  approved: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  waitlisted: 'bg-ink-100 text-ink-600',
};

export function RegistrationsScreen() {
  return (
    <div className="flex h-full flex-col bg-white p-5 text-left">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-base font-bold text-ink-900">Registrations</p>
        <span className="text-xs font-semibold text-ink-400">186 players</span>
      </div>
      <div className="flex flex-col gap-2">
        {PLAYERS.map((p) => (
          <div key={p.name} className="flex items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                {p.name.split(' ').map((n) => n[0]).join('')}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-800">
                  {p.name}
                  {p.partner !== '—' && <span className="font-normal text-ink-400"> &amp; {p.partner}</span>}
                </p>
                <p className="text-[11px] text-ink-400">{p.category}</p>
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${REG_STATUS[p.status]}`}>{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BracketScreen() {
  const round1 = [
    ['Chen / Foster', 'Ortiz / Reyes'],
    ['Nair / Patel', 'Thompson / Boyd'],
  ];
  const round2 = ['Chen / Foster', 'Thompson / Boyd'];

  return (
    <div className="flex h-full flex-col bg-ink-50/60 p-5 text-left">
      <p className="mb-4 font-display text-base font-bold text-ink-900">Mixed Doubles Open — Bracket</p>
      <div className="flex flex-1 items-center justify-center gap-8">
        <div className="flex flex-col gap-6">
          {round1.map((pair, i) => (
            <div key={i} className="w-40 rounded-xl border border-ink-100 bg-white shadow-sm">
              {pair.map((name, j) => (
                <div key={name} className={`flex items-center justify-between px-3 py-2 text-xs font-semibold text-ink-700 ${j === 0 ? 'border-b border-ink-100' : ''}`}>
                  {name}
                  {i === 0 && j === 0 && <CheckCircle2 size={13} className="text-accent-coral" />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="w-40 rounded-xl border-2 border-accent-coral bg-white shadow-md">
            {round2.map((name, j) => (
              <div key={name} className={`flex items-center justify-between px-3 py-2 text-xs font-bold text-ink-800 ${j === 0 ? 'border-b border-ink-100' : ''}`}>
                {name}
                {j === 0 && <CircleDot size={12} className="animate-pulse-soft text-accent-coral" />}
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] font-bold uppercase tracking-wide text-accent-coral">Now playing</p>
        </div>
      </div>
    </div>
  );
}

const MATCHES = [
  { court: 'Court 1', teams: 'Chen / Foster vs Thompson / Boyd', time: 'Now', status: 'live' },
  { court: 'Court 2', teams: 'Ortiz / Reyes vs Patel / Kim', time: '11:20 AM', status: 'next' },
  { court: 'Court 3', teams: 'Diaz / Wu vs Alvarez / Cole', time: '11:20 AM', status: 'next' },
  { court: 'Court 4', teams: 'Nguyen / Ray vs Brooks / Lee', time: '11:45 AM', status: 'scheduled' },
];

export function MatchListScreen() {
  return (
    <div className="flex h-full flex-col bg-white p-5 text-left">
      <p className="mb-3 font-display text-base font-bold text-ink-900">Match schedule</p>
      <div className="flex flex-col gap-2">
        {MATCHES.map((m) => (
          <div key={m.court} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3.5 py-2.5">
            <span className="w-14 shrink-0 text-[11px] font-bold text-ink-400">{m.court}</span>
            <span className="flex-1 truncate text-xs font-semibold text-ink-700">{m.teams}</span>
            {m.status === 'live' ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-coral-50 px-2 py-0.5 text-[10px] font-bold text-accent-coral-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-coral animate-pulse-soft" /> Live
              </span>
            ) : (
              <span className="shrink-0 text-[11px] font-semibold text-ink-400">{m.time}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultsScreen() {
  const standings = [
    { rank: 1, name: 'Chen / Foster', record: '5–0' },
    { rank: 2, name: 'Thompson / Boyd', record: '4–1' },
    { rank: 3, name: 'Ortiz / Reyes', record: '3–2' },
  ];
  return (
    <div className="flex h-full flex-col bg-ink-50/60 p-5 text-left">
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={16} className="text-accent-coral" />
        <p className="font-display text-base font-bold text-ink-900">Final results</p>
      </div>
      <div className="flex flex-col gap-2">
        {standings.map((s) => (
          <div key={s.rank} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white px-3.5 py-3 shadow-sm">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-xs font-bold ${s.rank === 1 ? 'bg-accent-coral text-white' : 'bg-ink-100 text-ink-500'}`}>
              {s.rank}
            </span>
            <span className="flex-1 text-sm font-semibold text-ink-800">{s.name}</span>
            <span className="text-xs font-bold text-ink-400">{s.record}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
