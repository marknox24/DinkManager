import { useEffect, useMemo, useState } from 'react';
import { Search, Users, X } from 'lucide-react';
import Select from '../ui/Select';
import { inputClass } from '../ui/FormField';
import RegistrationStatusBadge from '../player/RegistrationStatusBadge';
import { getPublicEventRoster } from '../../data/eventsApi';

function teamName(r) {
  return r.player2_name ? `${r.player_name} & ${r.player2_name}` : r.player_name;
}

// Public "who's registered" roster on the event page — anyone can view this,
// signed in or not (same visibility as the rest of the page). Denied
// registrations never reach this component: public_event_roster() excludes
// them server-side, so there's nothing to filter out here.
export default function RegisteredPlayersTab({ event, categories }) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPublicEventRoster(event.id, categoryId || null)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Could not load the registered players.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, categoryId]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => teamName(r).toLowerCase().includes(q));
  }, [rows, search]);

  const categoryName = (id) => categories.find((c) => c.id === id)?.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by player name…"
          className="w-full rounded-2xl border-2 border-ink-200 bg-white py-4 pl-14 pr-14 text-base font-semibold text-ink-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-100 hover:text-ink-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="sm:max-w-xs">
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Users size={22} className="text-ink-300" />
          <p className="text-sm text-ink-400">No registrations yet.</p>
        </div>
      ) : visibleRows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-400">No players match your search.</p>
      ) : (
        <div className="flex flex-col divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100">
          {visibleRows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 bg-white px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-ink-900">{teamName(r)}</div>
                <div className="text-xs text-ink-400">
                  {categoryName(r.category_id) ? `${categoryName(r.category_id)} · ` : ''}
                  {r.club_name || 'No club listed'} · Registered {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <RegistrationStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
