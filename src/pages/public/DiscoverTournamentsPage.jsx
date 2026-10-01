import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Trophy, X } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import TournamentCard from '../../components/public/TournamentCard';
import EventHeroCarousel from '../../components/public/EventHeroCarousel';
import { getPublishedEvents, getEventMediaUrl } from '../../data/eventsApi';
import { listMyRegistrationSummaries } from '../../data/playerApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import useSeo from '../../hooks/useSeo';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'finished', label: 'Finished' },
];

export default function DiscoverTournamentsPage() {
  useSeo({
    title: 'Upcoming Pickleball Tournaments — Find & Register | DinkManager',
    description:
      'Browse upcoming pickleball tournaments, check divisions, fees and prizes, and register online in minutes.',
    path: '/tournaments',
  });
  const { pushToast } = useToast();
  const { user, role } = useAuth();
  const isOrganizer = !!user && role !== 'player';
  const [events, setEvents] = useState(null);
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [myRegsByEvent, setMyRegsByEvent] = useState({});

  useEffect(() => {
    getPublishedEvents()
      .then(setEvents)
      .catch((e) => pushToast(e.message, 'error'));
  }, [pushToast]);

  // Anonymous visitors have nothing to show here — this only runs for a
  // signed-in visitor (any role; registrations.player_id isn't role-gated).
  useEffect(() => {
    if (!user) {
      setMyRegsByEvent({});
      return;
    }
    listMyRegistrationSummaries(user.id)
      .then((regs) => {
        const map = {};
        regs.forEach((r) => {
          (map[r.event_id] ||= []).push(r);
        });
        setMyRegsByEvent(map);
      })
      .catch(() => setMyRegsByEvent({}));
  }, [user]);

  // getPublishedEvents() already orders by start_date ascending — nearest
  // first for anything still upcoming. Finished events carry past dates, so
  // a flat ascending sort would surface old results ahead of what's
  // actionable once an organizer has tournament history; reversing just the
  // finished bucket gives most-recently-finished-first instead, and "all"
  // leads with upcoming/ongoing before trailing into finished.
  const sortedEvents = useMemo(() => {
    if (!events) return null;
    const notFinished = events.filter((e) => e.status !== 'finished');
    const finished = events.filter((e) => e.status === 'finished').reverse();
    return { all: [...notFinished, ...finished], upcoming: notFinished, finished };
  }, [events]);

  const tabCounts = sortedEvents && {
    all: sortedEvents.all.length,
    upcoming: sortedEvents.upcoming.length,
    finished: sortedEvents.finished.length,
  };

  const filtered = useMemo(() => {
    if (!sortedEvents) return null;
    const base = sortedEvents[statusTab];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => e.name.toLowerCase().includes(q) || (e.location_address || '').toLowerCase().includes(q));
  }, [sortedEvents, statusTab, query]);

  // Only events with a real banner earn a hero slide — a photo-driven
  // carousel with a broken/missing image for one slide would undercut the
  // whole effect. Still nearest-date-first since it's filtered from the
  // already-sorted upcoming bucket.
  const heroEvents = useMemo(() => {
    if (!sortedEvents) return [];
    return sortedEvents.upcoming.filter((e) => e.cover_photo_path).slice(0, 5);
  }, [sortedEvents]);

  const galleryImages = useMemo(() => {
    if (!events) return [];
    return events
      .filter((e) => e.cover_photo_path)
      .map((e) => getEventMediaUrl(e.cover_photo_path))
      .slice(0, 9);
  }, [events]);

  return (
    <div className="min-h-screen bg-[#f3f6f8]">
      <div className="relative">
        <EventHeroCarousel events={heroEvents} />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
            <Link to="/" className="pointer-events-auto flex items-center gap-2 drop-shadow-sm">
              <Logo size={26} />
              <span className="font-display text-base font-bold text-white">DinkManager</span>
            </Link>
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
              <Link
                to="/"
                aria-label="Back to website"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 drop-shadow-sm transition hover:text-white sm:h-auto sm:w-auto sm:text-xs sm:font-semibold"
              >
                <ArrowLeft size={16} className="sm:hidden" />
                <span className="hidden sm:inline">← Back to website</span>
              </Link>
              {isOrganizer ? (
                <Link
                  to="/dashboard"
                  className="press-scale rounded-full bg-white px-3.5 py-2 text-[11px] font-bold text-ink-900 shadow-sm transition hover:bg-ink-50 sm:px-4 sm:text-xs"
                >
                  View dashboard
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="press-scale rounded-full bg-brand-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-brand-700 sm:px-4 sm:text-xs"
                >
                  Start Free Event
                </Link>
              )}
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative mb-4">
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

        {tabCounts && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setStatusTab(t.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  statusTab === t.id ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
                }`}
              >
                {t.label} ({tabCounts[t.id]})
              </button>
            ))}
          </div>
        )}

        {filtered === null && <div className="py-16 text-center text-sm text-ink-400">Loading tournaments…</div>}

        {filtered && filtered.length === 0 && events.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
            <Trophy size={22} className="text-ink-300" />
            <p className="text-sm text-ink-500">No tournaments published yet — check back soon.</p>
          </div>
        )}

        {filtered && filtered.length === 0 && events.length > 0 && (
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
            <p className="text-sm text-ink-500">
              {query ? <>No tournaments match &ldquo;{query}&rdquo;.</> : `No ${statusTab === 'all' ? '' : statusTab + ' '}tournaments right now.`}
            </p>
            {query && (
              <button onClick={() => setQuery('')} className="mt-2 text-sm font-semibold text-brand-600">
                Clear search
              </button>
            )}
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <TournamentCard key={event.id} event={event} myRegistrations={myRegsByEvent[event.id]} />
            ))}
          </div>
        )}
      </main>

      {galleryImages.length >= 4 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="mb-1 font-display text-xl font-bold text-ink-900">Moments from the courts</h2>
          <p className="mb-5 text-sm text-ink-500">A look at tournaments hosted on DinkManager.</p>
          <div className="columns-2 gap-3 sm:columns-3 [&>img]:mb-3">
            {galleryImages.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" className="w-full rounded-2xl object-cover" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
