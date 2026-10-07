import { useEffect, useState } from 'react';
import { ChevronDown, GitBranch, Users } from 'lucide-react';
import Select from '../ui/Select';
import { inputClass } from '../ui/FormField';
import { useMatchSchedule } from '../../hooks/useMatchSchedule';
import BracketTreeView from './BracketTreeView';

// Every registered team for a Single Elimination category, grouped by
// bracket — shown regardless of whether the bracket has been drawn yet, so
// a player with a bye (never gets a match row) or one waiting on the draw
// is never invisible. Collapsed by default once a tree exists (the tree
// already shows most names in context); expanded when it's the only thing
// there is to show.
function EntrantList({ entrants, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const total = entrants.reduce((n, b) => n + b.teams.length, 0);
  return (
    <div className="rounded-2xl border border-ink-100 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-ink-800">
          <Users size={15} className="text-brand-600" /> Entrants ({total})
        </span>
        <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-ink-100 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {entrants.map((b) => (
            <div key={b.bracketLetter}>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">Bracket {b.bracketLetter}</div>
              <ol className="flex flex-col gap-1">
                {b.teams.map((t) => (
                  <li key={t.id} className="flex items-baseline gap-2 text-sm text-ink-700">
                    <span className="w-4 shrink-0 text-right text-xs font-semibold text-ink-300">{t.seed}</span>
                    <span className={`min-w-0 truncate font-semibold ${t.status === 'eliminated' ? 'text-ink-400 line-through decoration-ink-300' : ''}`}>{t.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The visual bracket-tree view — Single Elimination categories and the
// playoff crossover ladder only (utils/bracketTree.js); Round Robin has no
// tree shape, Double Elimination has no losers-bracket data model yet.
// Shares useMatchSchedule with MatchScheduleView so this costs no extra
// fetch beyond whichever of the two tabs is mounted first.
export default function BracketView({ event, categories: initialCategories }) {
  const { categoryTrees, loading } = useMatchSchedule({ event, categories: initialCategories, offlineCapable: false });
  const [categoryId, setCategoryId] = useState('');
  const [treeKey, setTreeKey] = useState('');

  const selected = categoryTrees.find((c) => c.category.id === categoryId) || categoryTrees[0];
  const tree = selected?.trees.find((t) => t.key === treeKey) || selected?.trees[0];

  // Reset the bracket sub-selection when the category changes (or the list
  // itself changes, e.g. a tree gets generated for the first time) so a
  // stale key from a previous category never silently fails to match.
  useEffect(() => {
    setTreeKey(selected?.trees[0]?.key || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.category.id]);

  if (loading) return <p className="py-6 text-center text-sm text-ink-400">Loading…</p>;

  if (categoryTrees.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <GitBranch size={22} className="text-ink-300" />
        <p className="text-sm text-ink-400">No knockout bracket to show yet — this appears once a Single Elimination or playoff bracket is drawn.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2.5">
        {categoryTrees.length > 1 && (
          <div className="sm:max-w-xs">
            <Select
              value={selected.category.id}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
              aria-label="Choose a category"
            >
              {categoryTrees.map(({ category }) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {selected.trees.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {selected.trees.map((t) => (
              <button
                key={t.key}
                onClick={() => setTreeKey(t.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  t.key === (tree?.key || '') ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.entrants.length > 0 && <EntrantList entrants={selected.entrants} defaultOpen={!tree} />}
      {tree ? (
        <BracketTreeView tree={tree} />
      ) : (
        selected.entrants.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <GitBranch size={22} className="text-ink-300" />
            <p className="text-sm text-ink-400">No knockout bracket to show yet — this appears once a Single Elimination or playoff bracket is drawn.</p>
          </div>
        )
      )}
    </div>
  );
}
