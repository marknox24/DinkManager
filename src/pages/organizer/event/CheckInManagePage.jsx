import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Search, UserCheck, Users, X } from 'lucide-react';
import { checkInPlayer, expireCheckin, getEventById, listCategories, listRegistrations } from '../../../data/eventsApi';
import { useToast } from '../../../context/ToastContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import EventCheckinQr from '../../../components/organizer/EventCheckinQr';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Not checked in' },
  { id: 'done', label: 'Checked in' },
];

// Flattens both slots of every approved registration into one player-per-row
// list — check-in tracks individuals, not teams, so counts and search need
// to work at that grain even though doubles register as a pair.
function flattenApprovedPlayers(registrations, categories) {
  const categoryName = (id) => categories.find((c) => c.id === id)?.name || '';
  const entries = [];
  registrations
    .filter((r) => r.status === 'approved')
    .forEach((r) => {
      entries.push({
        key: `${r.id}-player1`,
        regId: r.id,
        slot: 'player1',
        name: r.player_name,
        partnerName: r.player2_name || null,
        club: r.club_name,
        categoryId: r.category_id,
        categoryName: categoryName(r.category_id),
        checkedIn: Boolean(r.player1_checked_in_at),
        checkedInAt: r.player1_checked_in_at,
      });
      if (r.player2_name) {
        entries.push({
          key: `${r.id}-player2`,
          regId: r.id,
          slot: 'player2',
          name: r.player2_name,
          partnerName: r.player_name,
          club: r.club_name,
          categoryId: r.category_id,
          categoryName: categoryName(r.category_id),
          checkedIn: Boolean(r.player2_checked_in_at),
          checkedInAt: r.player2_checked_in_at,
        });
      }
    });
  return entries;
}

export default function CheckInManagePage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const reload = useCallback(async () => {
    try {
      const [ev, cats, regs] = await Promise.all([getEventById(eventId), listCategories(eventId), listRegistrations(eventId)]);
      setEvent(ev);
      setCategories(cats);
      setRegistrations(regs);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleCheckin = async (entry) => {
    try {
      if (entry.checkedIn) {
        await expireCheckin(entry.regId, entry.slot);
        const field = entry.slot === 'player2' ? 'player2_checked_in_at' : 'player1_checked_in_at';
        setRegistrations((prev) => prev.map((r) => (r.id === entry.regId ? { ...r, [field]: null } : r)));
      } else {
        const updated = await checkInPlayer(entry.regId, entry.slot);
        setRegistrations((prev) => prev.map((r) => (r.id === entry.regId ? { ...r, ...updated } : r)));
      }
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const players = useMemo(() => flattenApprovedPlayers(registrations, categories), [registrations, categories]);

  const totals = useMemo(() => ({ total: players.length, checkedIn: players.filter((p) => p.checkedIn).length }), [players]);

  const q = query.trim().toLowerCase();

  const sections = useMemo(() => {
    return categories
      .map((cat) => {
        const catPlayers = players.filter((p) => p.categoryId === cat.id);
        const visible = catPlayers.filter((p) => {
          if (q && !p.name.toLowerCase().includes(q)) return false;
          if (filter === 'pending' && p.checkedIn) return false;
          if (filter === 'done' && !p.checkedIn) return false;
          return true;
        });
        return {
          category: cat,
          total: catPlayers.length,
          checkedIn: catPlayers.filter((p) => p.checkedIn).length,
          visible,
        };
      })
      .filter((s) => s.total > 0);
  }, [categories, players, q, filter]);

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Check-in</h1>
          <p className="text-sm text-ink-500">Who's arrived — search a name or scan the QR at the door.</p>
        </div>
        {event?.slug && <EventCheckinQr eventName={event.name} checkinUrl={`${window.location.origin}/e/${event.slug}/checkin`} />}
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <>
          <div className="relative mb-4">
            <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a player by name…"
              autoFocus
              className="w-full rounded-2xl border-2 border-ink-200 bg-white py-4 pl-14 pr-14 text-base font-semibold text-ink-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-100 hover:text-ink-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <UserCheck size={20} strokeWidth={2.3} />
              </span>
              <div>
                <div className="font-display text-lg font-bold leading-none text-ink-900">
                  {totals.checkedIn} <span className="text-ink-400">/ {totals.total} checked in</span>
                </div>
                <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${totals.total ? (totals.checkedIn / totals.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-ink-50 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    filter === f.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {sections.map(({ category, total, checkedIn, visible }) => (
              <div key={category.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
                  <span className="font-display text-sm font-bold text-ink-800">{category.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      checkedIn === total ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {checkedIn} / {total} checked in
                  </span>
                </div>
                {visible.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-ink-400">No matching players.</div>
                ) : (
                  <div className="divide-y divide-ink-50">
                    {visible.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => toggleCheckin(p)}
                        title={p.checkedIn ? 'Checked in — click to undo' : 'Check in manually'}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-ink-50/60"
                      >
                        {p.checkedIn ? (
                          <CheckCircle2 size={18} className="shrink-0 text-brand-500" />
                        ) : (
                          <Circle size={18} className="shrink-0 text-ink-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink-800">
                            {p.name}
                            {p.partnerName && <span className="font-normal text-ink-400"> &nbsp;with {p.partnerName}</span>}
                          </div>
                          {p.club && <div className="truncate text-xs text-ink-400">{p.club}</div>}
                        </div>
                        {p.checkedIn && p.checkedInAt && (
                          <div className="shrink-0 text-[11px] font-semibold text-brand-600">
                            {new Date(p.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sections.length === 0 && (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-16 text-center text-sm text-ink-400">
                <Users size={22} className="mx-auto mb-2 text-ink-300" />
                No approved players yet.
              </div>
            )}
          </div>
        </>
      )}
    </EventWorkspaceLayout>
  );
}
