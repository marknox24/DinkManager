import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, Users, X } from 'lucide-react';
import RegistrationStatusBadge from '../player/RegistrationStatusBadge';
import { countPlayers, filterRoster, groupRoster, initials, rosterSummary, teamMembers } from '../../utils/roster';

// How many of the latest registrations show before "Show all players", so a
// big roster doesn't push the schedule a long way down the page.
const PREVIEW_ROWS = 5;
const STRIP_FACES = 3;

function Initials({ name, ring }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700 ring-2 ${ring}`}>
      {initials(name)}
    </span>
  );
}

function InitialsStack({ names, ring }) {
  return (
    <span className="flex shrink-0 -space-x-1">
      {names.map((name, i) => (
        <Initials key={i} name={name} ring={ring} />
      ))}
    </span>
  );
}

// The way in from the top of the page, so nobody has to scroll to find out
// who's playing. `hasRegistrations` comes from the event bundle, which is
// already loaded: it holds the strip's place while the names arrive, so the
// page doesn't jump.
export function PlayersStrip({ rows, hasRegistrations, onOpen }) {
  if (rows.length === 0 && !hasRegistrations) return null;
  const players = countPlayers(rows);
  return (
    <a href="#players" onClick={onOpen} className="press-scale mt-4 flex w-full items-center gap-3 rounded-xl bg-ink-50 px-3.5 py-3 hover:bg-ink-100 sm:w-96">
      {rows.length > 0 && <InitialsStack names={rows.slice(0, STRIP_FACES).map((row) => row.player_name)} ring="ring-ink-50" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink-900">
          {players > 0 ? `${players} player${players === 1 ? '' : 's'}` : 'Registered players'}
        </span>
        <span className="block text-xs text-ink-500">See who's registered</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-400" />
    </a>
  );
}

// `division` is for lists that mix divisions; the full list has a heading for
// each one instead.
function RosterRow({ row, division }) {
  const members = teamMembers(row);
  return (
    <li className="flex items-center gap-3 border-t border-ink-100 py-2.5">
      <InitialsStack names={members} ring="ring-white" />
      <div className="min-w-0 flex-1">
        {members.map((name, i) => (
          <div key={i} className="break-words text-sm font-bold text-ink-900">
            {name}
          </div>
        ))}
        <div className="text-xs text-ink-500">{[row.club_name || 'No club listed', division].filter(Boolean).join(' · ')}</div>
      </div>
      {row.status !== 'approved' && <RegistrationStatusBadge status={row.status} />}
    </li>
  );
}

function RosterSkeleton() {
  return (
    <ul className="grid animate-pulse grid-cols-1 gap-x-8 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: PREVIEW_ROWS }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-t border-ink-100 py-2.5">
          <span className="h-8 w-8 shrink-0 rounded-full bg-ink-100" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-2/5 rounded bg-ink-100" />
            <span className="h-3 w-1/4 rounded bg-ink-100" />
          </span>
        </li>
      ))}
    </ul>
  );
}

const headingClass = 'text-[11px] font-bold uppercase tracking-wide text-ink-500';

// Who's registered, for anyone viewing the event, signed in or not. Denied
// registrations never reach this component: public_event_roster() excludes
// them server-side, so there's nothing to filter out here.
//
// Opens on the latest registrations rather than the start of the full list,
// which would be the same few A-names from the first division on every visit.
export default function WhosPlayingSection({ categories, counts, roster, closed, expanded, onExpandedChange }) {
  const { rows, loading, error } = roster;
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const sectionRef = useRef(null);

  const inDivision = useMemo(() => (categoryId ? rows.filter((row) => row.category_id === categoryId) : rows), [rows, categoryId]);
  const groups = useMemo(() => groupRoster(filterRoster(inDivision, search), categories), [inDivision, categories, search]);

  const chips = useMemo(
    () => [
      { id: '', label: 'All', count: countPlayers(rows) },
      ...categories.map((cat) => ({ id: cat.id, label: cat.name, count: countPlayers(rows.filter((row) => row.category_id === cat.id)) })),
    ],
    [rows, categories]
  );

  if (!loading && !error && rows.length === 0 && (closed || categories.length === 0)) return null;

  const showAll = expanded && rows.length > PREVIEW_ROWS;
  const showToggle = showAll || inDivision.length > PREVIEW_ROWS;

  // Only the everyone view mixes divisions, so only its rows need labelling.
  const divisionLabel = (id) => (categories.length > 1 && !categoryId ? categories.find((cat) => cat.id === id)?.name : undefined);

  const slotsLabel = ({ max_slots: maxSlots, id }) => {
    if (maxSlots == null) return `${chips.find((chip) => chip.id === id)?.count} registered`;
    return `${counts.find((c) => c.category_id === id)?.active_count || 0}/${maxSlots} slots`;
  };

  const selectedCategory = categories.find((cat) => cat.id === categoryId);

  const collapse = () => {
    onExpandedChange(false);
    setSearch('');
    sectionRef.current?.scrollIntoView();
  };

  return (
    <section ref={sectionRef} id="players" className="scroll-mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Users size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">{closed ? 'Who played' : "Who's playing"}</h2>
          <p className="text-xs text-ink-500">{loading ? 'Checking who has registered…' : rows.length > 0 ? rosterSummary(rows) : 'No one has registered yet.'}</p>
        </div>
      </div>

      {loading ? (
        <RosterSkeleton />
      ) : error ? (
        <p className="py-6 text-center text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <p className="text-sm font-bold text-ink-800">Be the first to register</p>
          <p className="text-xs text-ink-500">Choose a division above to sign up.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {showAll && (
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a player or club"
                aria-label="Search a player or club"
                className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-10 pr-10 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-100 hover:text-ink-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          )}

          {categories.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setCategoryId(chip.id)}
                  aria-pressed={categoryId === chip.id}
                  className={`press-scale shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${
                    categoryId === chip.id ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {chip.label} <span className={categoryId === chip.id ? 'text-brand-100' : 'text-ink-400'}>{chip.count}</span>
                </button>
              ))}
            </div>
          )}

          {!showAll ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className={`min-w-0 ${headingClass}`}>Latest registrations</h3>
                {selectedCategory && <span className="shrink-0 text-[11px] font-semibold text-ink-400">{slotsLabel(selectedCategory)}</span>}
              </div>
              {inDivision.length === 0 ? (
                <p className="border-t border-ink-100 py-6 text-center text-sm text-ink-400">No one has registered for this division yet.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                  {inDivision.slice(0, PREVIEW_ROWS).map((row) => (
                    <RosterRow key={row.id} row={row} division={divisionLabel(row.category_id)} />
                  ))}
                </ul>
              )}
            </div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No players match your search.</p>
          ) : (
            groups.map((group) => (
              <div key={group.category.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className={`min-w-0 ${headingClass}`}>{group.category.name}</h3>
                  <span className="shrink-0 text-[11px] font-semibold text-ink-400">{slotsLabel(group.category)}</span>
                </div>
                <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                  {group.rows.map((row) => (
                    <RosterRow key={row.id} row={row} />
                  ))}
                </ul>
              </div>
            ))
          )}

          {showToggle && (
            <button
              onClick={showAll ? collapse : () => onExpandedChange(true)}
              className="press-scale self-center px-3 py-1.5 text-sm font-bold text-brand-600 hover:text-brand-700"
            >
              {showAll ? 'Show less' : 'Show all players'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
