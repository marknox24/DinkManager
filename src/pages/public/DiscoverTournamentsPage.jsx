import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trophy, X } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import TournamentCard from '../../components/public/TournamentCard';
import { getPublishedEvents } from '../../data/eventsApi';
import { useToast } from '../../context/ToastContext';

export default function DiscoverTournamentsPage() {
  const { pushToast } = useToast();
  const [events, setEvents] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getPublishedEvents()
      .then(setEvents)
      .catch((e) => pushToast(e.message, 'error'));
  }, [pushToast]);

  const filtered = useMemo(() => {
    if (!events) return null;
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.name.toLowerCase().includes(q) || (e.location_address || '').toLowerCase().includes(q));
  }, [events, query]);

  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <header className="bg-gradient-to-br from-ink-900 to-ink-800 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <Logo size={22} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">DinkManager Tournament</span>
            </div>
            <Link to="/player/login" className="text-xs font-semibold text-ink-300 hover:text-white">
              Player sign in
            </Link>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Browse tournaments</h1>
          <p className="mt-1 text-sm text-ink-300">Find a pickleball tournament and register to play.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative mb-6 max-w-sm">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or location"
            className="w-full rounded-full border border-ink-200 bg-white py-2.5 pr-9 pl-9 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-300 hover:text-ink-500">
              <X size={14} />
            </button>
          )}
        </div>

        {filtered === null && <div className="py-16 text-center text-sm text-ink-400">Loading tournaments…</div>}

        {filtered && filtered.length === 0 && events.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
            <Trophy size={22} className="text-ink-300" />
            <p className="text-sm text-ink-500">No tournaments published yet — check back soon.</p>
          </div>
        )}

        {filtered && filtered.length === 0 && events.length > 0 && (
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
            <p className="text-sm text-ink-500">No tournaments match &ldquo;{query}&rdquo;.</p>
            <button onClick={() => setQuery('')} className="mt-2 text-sm font-semibold text-brand-600">
              Clear search
            </button>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <TournamentCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
