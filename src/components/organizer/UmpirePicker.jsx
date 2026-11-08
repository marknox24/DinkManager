import { useEffect, useMemo, useRef } from 'react';
import { gamesLabel, rankUmpires } from '../../utils/umpireRotation';

// The umpire choice in Start match and Log score: every umpire with how many
// games they've officiated, fewest first, so the organizer can see who's
// behind. `recommend` marks the top one, for a new assignment only; nothing
// is ever picked for the organizer. `workload` is null when the counts
// couldn't be loaded, and the list then keeps the pool's order with no
// counts or recommendation.
export default function UmpirePicker({ label = 'Umpire', umpires, workload, value, onChange, recommend = false }) {
  const showCounts = workload != null;
  const ranked = useMemo(
    () => (showCounts ? rankUmpires(umpires, workload) : umpires.map((umpire) => ({ umpire, count: 0, share: 0 }))),
    [umpires, workload, showCounts]
  );
  // A recommendation needs someone to be recommended over.
  const recommendedName = recommend && showCounts && ranked.length > 1 ? ranked[0].umpire.name : null;

  // An umpire chosen before the window opened (Edit score) can sit below the
  // fold of a sorted list; bring them into view so it's clear who's credited.
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector('input:checked')?.closest('label');
    if (row) list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
  }, []);

  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-xs font-bold uppercase tracking-wide text-ink-500">
        {label}
        {showCounts && <span className="text-[10px] font-semibold normal-case tracking-normal text-ink-400">Fewest games first</span>}
      </legend>
      {/* The padding keeps the rows' outlines clear of the scroll clip. */}
      <div ref={listRef} className="relative -mx-1 flex max-h-72 flex-col gap-1.5 overflow-y-auto px-1 py-0.5">
        {ranked.map(({ umpire, count, share }) => {
          const selected = value === umpire.name;
          const recommended = umpire.name === recommendedName;
          return (
            <label
              key={umpire.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition ${
                selected ? 'bg-brand-50 ring-brand-400' : 'bg-white ring-ink-200 hover:bg-ink-50'
              }`}
            >
              <input
                type="radio"
                name="umpire"
                value={umpire.name}
                checked={selected}
                onChange={() => onChange(umpire.name)}
                className="h-4 w-4 shrink-0 accent-brand-600"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words text-sm font-semibold text-ink-800">{umpire.name}</span>
                  {recommended && (
                    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Recommended
                    </span>
                  )}
                  {umpire.removed && (
                    <span className="whitespace-nowrap rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">Removed</span>
                  )}
                </span>
                {showCounts && (
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <span className={`block h-full rounded-full ${recommended ? 'bg-amber-400' : 'bg-brand-400'}`} style={{ width: `${share * 100}%` }} />
                    </span>
                    <span className="w-14 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink-500">{gamesLabel(count)}</span>
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
