import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronDown, Clock, Search, WifiOff, X } from 'lucide-react';
import Select from '../ui/Select';
import { inputClass } from '../ui/FormField';
import { matchLevelLabel } from '../../data/playoffApi';
import { useMatchSchedule } from '../../hooks/useMatchSchedule';
import { teamLabel } from '../../utils/match';
import { useNow } from '../../hooks/useNow';

const STATUS_STYLES = {
  live: { label: 'Live', className: 'bg-rose-100 text-rose-700' },
  next: { label: 'Up next', className: 'bg-brand-100 text-brand-700' },
  scheduled: { label: 'Scheduled', className: 'bg-ink-100 text-ink-600' },
  completed: { label: 'Done', className: 'bg-emerald-100 text-emerald-700' },
};

function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function timeOnly(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function clock(ms, now) {
  return isSameDay(ms, now) ? timeOnly(ms) : `${new Date(ms).toLocaleDateString([], { weekday: 'short' })} ${timeOnly(ms)}`;
}

function relative(row, now) {
  const mins = Math.round((row.startMs - now) / 60000);
  if (mins <= 0) return 'Starting now';
  if (mins < 60) return `in ${mins} min`;
  return `in ${minutesText(mins)}`;
}

function levelLabel(row) {
  if (row.projected) {
    const base = matchLevelLabel(row);
    return row.stageMatchCount > 1 ? `${base.replace(/s$/, '')} ${row.stageIndex}` : base;
  }
  return matchLevelLabel(row);
}

function matchupText(row) {
  if (row.projected) return 'Teams to be decided';
  return `${teamLabel(row.teamA)} vs ${teamLabel(row.teamB)}`;
}

function searchText(row) {
  return [teamLabel(row.teamA), teamLabel(row.teamB), row.matchCode, row.categoryName, levelLabel(row)].join(' ').toLowerCase();
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.className}`}>{s.label}</span>;
}

function minutesText(mins) {
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
}

function DelayBanner({ summary, now }) {
  const { behindMinutes, liveCount, remainingCount, estimatedFinishMs } = summary;
  let tone = 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  let text = 'On schedule';
  if (behindMinutes == null) {
    tone = 'bg-ink-50 text-ink-600 ring-ink-100';
    text = 'Estimated schedule';
  } else if (behindMinutes >= 5) {
    tone = 'bg-amber-50 text-amber-700 ring-amber-100';
    text = `Running about ${minutesText(behindMinutes)} behind`;
  } else if (behindMinutes <= -5) {
    text = `Running about ${minutesText(Math.abs(behindMinutes))} ahead`;
  }
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-sm ring-1 ${tone}`}>
      <span className="flex items-center gap-2 font-bold">
        <Clock size={16} />
        {text}
      </span>
      <span className="text-xs font-semibold opacity-80">
        {liveCount} live · {remainingCount} to play{estimatedFinishMs ? ` · est. finish ${clock(estimatedFinishMs, now)}` : ''}
      </span>
    </div>
  );
}

function CourtStrip({ courts }) {
  if (!courts.some((c) => c.live || c.next)) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {courts.map((c) => (
        <div key={c.court} className="rounded-2xl border border-ink-100 bg-white p-3 shadow-sm">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">Court {c.court}</div>
          {c.live ? (
            <div className="text-sm">
              <span className="mr-1.5 inline-block rounded-full bg-rose-100 px-1.5 py-px text-[10px] font-bold text-rose-700">NOW</span>
              <span className="font-semibold text-ink-900">{matchupText(c.live)}</span>
            </div>
          ) : (
            <div className="text-sm text-ink-400">Free</div>
          )}
          {c.next && (
            <div className="mt-1 text-xs text-ink-500">
              <span className="font-bold text-brand-700">Next:</span> {matchupText(c.next)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScheduleRow({ row, now, mode, eventId }) {
  const completed = row.status === 'completed';
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 bg-white px-4 py-3 sm:grid-cols-[10.5rem_1fr_auto] sm:gap-x-4">
      <div className="whitespace-nowrap">
        {completed ? (
          <div className="text-sm font-bold text-ink-500">{row.endMs ? clock(row.endMs, now) : 'Finished'}</div>
        ) : row.status === 'live' ? (
          <>
            <div className="text-sm font-bold text-rose-700">{row.paused ? 'Paused' : 'In play'}</div>
            <div className="text-xs text-ink-400">{row.runningLong ? 'Running long' : `Est. end ${clock(row.endMs, now)}`}</div>
          </>
        ) : (
          <>
            <div className="text-sm font-bold text-ink-900">
              {clock(row.startMs, now)}
              <span className="font-semibold text-ink-400"> – {timeOnly(row.endMs)}</span>
            </div>
            <div className="text-xs text-ink-400">{relative(row, now)}</div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 sm:order-3">
        {row.delayed && !completed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">+{minutesText(row.delayMinutes)}</span>}
        <StatusPill status={row.status} />
        {mode === 'organizer' && !completed && !row.projected && (
          <Link to={`/events/${eventId}/matchlist`} className="text-xs font-bold text-brand-600 hover:underline">
            Open
          </Link>
        )}
      </div>
      <div className="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
        <div className="text-sm font-bold text-ink-900">{matchupText(row)}</div>
        <div className="text-xs text-ink-500">
          <span className="font-semibold text-ink-600">{row.categoryName}</span> · {levelLabel(row)}
          {row.court ? ` · Court ${row.court}${row.courtEstimated ? ' (est.)' : ''}` : ''}
          {row.matchCode && !row.projected ? ` · ${row.matchCode}` : ''}
        </div>
        {completed && row.scoreA != null && (
          <div className="text-xs font-semibold text-ink-600">
            Score {row.scoreA} – {row.scoreB}
          </div>
        )}
      </div>
    </div>
  );
}

// The estimated timetable, shared by the public event page tab and the
// organizer workspace page. It owns no data of its own: matches are read
// live (useMatchSchedule) and projected by utils/timetable.js.
export default function MatchScheduleView({ event: initialEvent, categories: initialCategories, mode = 'public' }) {
  const { event, categories, timetable, loading, error, fromCache } = useMatchSchedule({
    event: initialEvent,
    categories: initialCategories,
    offlineCapable: mode === 'organizer',
  });
  const now = useNow(15000);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const q = search.trim().toLowerCase();
  const { upcoming, completed } = useMemo(() => {
    if (!timetable) return { upcoming: [], completed: [] };
    const rows = timetable.rows.filter((r) => (!categoryId || r.categoryId === categoryId) && (!q || searchText(r).includes(q)));
    return {
      upcoming: rows.filter((r) => r.status !== 'completed').sort((a, b) => a.startMs - b.startMs),
      completed: rows.filter((r) => r.status === 'completed').sort((a, b) => (b.endMs || 0) - (a.endMs || 0)),
    };
  }, [timetable, categoryId, q]);

  const filtering = Boolean(q || categoryId);

  return (
    <div className="flex flex-col gap-4">
      {fromCache && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
          <WifiOff size={14} /> Offline — showing the last schedule saved on this device.
        </div>
      )}

      {timetable && timetable.rows.length > 0 && (
        <>
          <DelayBanner summary={timetable.summary} now={now} />
          <CourtStrip courts={timetable.courts} />
        </>
      )}

      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player or team…"
          aria-label="Search the match schedule"
          className="w-full rounded-2xl border-2 border-ink-200 bg-white py-4 pl-14 pr-14 text-base font-semibold text-ink-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-100 hover:text-ink-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="sm:max-w-xs">
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass} aria-label="Filter by category">
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
      ) : timetable.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarClock size={22} className="text-ink-300" />
          <p className="text-sm text-ink-400">The match schedule will appear here once matches are created.</p>
        </div>
      ) : (
        <>
          {upcoming.length === 0 && completed.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">No matches match your search.</p>
          ) : (
            upcoming.length > 0 && (
              <div className="flex flex-col divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100">
                {upcoming.map((row) => (
                  <ScheduleRow key={row.key} row={row} now={now} mode={mode} eventId={event.id} />
                ))}
              </div>
            )
          )}
          {upcoming.length === 0 && completed.length > 0 && !filtering && <p className="py-4 text-center text-sm text-ink-400">All matches are complete.</p>}

          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted || filtering}
                className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-500 transition hover:text-ink-800"
              >
                <ChevronDown size={14} className={`transition-transform duration-150 ${showCompleted || filtering ? 'rotate-180' : ''}`} />
                Completed ({completed.length})
              </button>
              {(showCompleted || filtering) && (
                <div className="flex flex-col divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100">
                  {completed.map((row) => (
                    <ScheduleRow key={row.key} row={row} now={now} mode={mode} eventId={event.id} />
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-center text-xs text-ink-400">
            Times are estimates and update automatically as matches finish.
            {!timetable.summary.hasPlannedStart && ' Estimated from the current time.'}
          </p>
        </>
      )}
    </div>
  );
}
