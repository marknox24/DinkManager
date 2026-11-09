import { Pencil, Trash2, Trophy } from 'lucide-react';
import FormField, { inputClass } from '../../ui/FormField';
import Select from '../../ui/Select';
import Switch from '../../ui/Switch';
import NumberInput from '../../ui/NumberInput';
import { groupKnockoutShape } from '../../../utils/calculator/bracketMath.js';
import { hasPlayoffs, poolSizesFor } from '../../../utils/calculator/index.js';

// Double Round Robin is a format choice here, not a separate "Rounds"
// field: it's stored as a Round Robin with doubleRoundRobin on, which is
// all the engine needs. Playoffs aren't a format either — they're a switch
// on either Round Robin, since they add a stage rather than replace one.
const FORMATS = ['Round Robin', 'Double Round Robin', 'Single Elimination'];

function formatValue(bracket) {
  if (bracket.format === 'Single Elimination') return 'Single Elimination';
  return bracket.doubleRoundRobin ? 'Double Round Robin' : 'Round Robin';
}

const isRoundRobin = (bracket) => bracket.format !== 'Single Elimination';

// How many physical brackets this category produces — matches the real
// product's model (a category can contain several brackets: one per group,
// plus a knockout bracket when playoffs are on).
function bracketCountFor(bracket) {
  if (!isRoundRobin(bracket)) return 1;
  return poolSizesFor(bracket).length + (hasPlayoffs(bracket) ? 1 : 0);
}

// Divides `total` teams as evenly as possible across `n` brackets — any
// remainder goes to the first brackets (21 teams / 4 brackets -> [6,5,5,5]).
// Means entering a team count and a bracket count is enough on its own;
// the chips below are still there to hand-tune any one bracket afterward.
function evenSplit(total, n) {
  const base = Math.floor((total || 0) / n);
  const remainder = (total || 0) % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Every "top N advance" choice that forms a real knockout bracket for these
// groups, labeled with the stage it starts at. Asks the engine itself, so
// the dropdown can only ever offer what the calculator will accept.
function advanceOptions(groupSizes) {
  return [1, 2, 4, 8, 16]
    .map((n) => ({ n, shape: groupKnockoutShape({ groupSizes, advancePerGroup: n }) }))
    .filter(({ shape }) => shape.valid)
    .map(({ n, shape }) => ({ n, firstStage: shape.knockoutLevels[0].label }));
}

// Keeps advancePerGroup on a valid choice whenever groups change, so the
// card never sits in a state the dropdown can't show. Prefers the current
// value, then the largest valid one below it, then the smallest.
function withValidAdvance(bracket) {
  if (!hasPlayoffs(bracket)) return bracket;
  const options = advanceOptions(poolSizesFor(bracket)).map((o) => o.n);
  if (options.length === 0 || options.includes(bracket.advancePerGroup)) return bracket;
  const below = options.filter((n) => n < bracket.advancePerGroup);
  return { ...bracket, advancePerGroup: below.length ? below[below.length - 1] : options[0] };
}

// Pure array-in-local-state pattern (mirrors ContactsEditor.jsx) — there's
// no backend here, so unlike the real app's CategoryEditor this never
// "commits" anything; every keystroke just calls onChange with the next
// bracket object.
export default function BracketCard({ bracket, errors, totalMatches, onChange, onRemove }) {
  const set = (patch) => onChange(withValidAdvance({ ...bracket, ...patch }));

  const setFormat = (value) => {
    if (value === 'Single Elimination') set({ format: 'Single Elimination' });
    else set({ format: 'Round Robin', doubleRoundRobin: value === 'Double Round Robin' });
  };

  // Teams / Pairs is the category's size for every format. With groups, it
  // re-balances them evenly rather than leaving the per-group chips stale.
  const setTeamCount = (v) => {
    if (isRoundRobin(bracket) && bracket.splitIntoBrackets) {
      const n = (bracket.groupSizes || []).length || 1;
      set({ teamCount: v, groupSizes: evenSplit(v, n) });
    } else {
      set({ teamCount: v });
    }
  };

  // The group count is itself the on/off control for splitting (1 = no
  // split) — changing it always re-derives an even split from the current
  // team count, so there's no manual per-group math.
  const setGroupCount = (count) => {
    const n = Math.max(1, Math.min(8, count ?? 1));
    set({ splitIntoBrackets: n > 1, groupSizes: evenSplit(bracket.teamCount, n) });
  };

  // Fine-tuning one group keeps Teams / Pairs equal to the sum of groups.
  const setGroupSize = (idx, size) => {
    const next = [...(bracket.groupSizes || [])];
    next[idx] = size ?? 2;
    set({ groupSizes: next, teamCount: next.reduce((sum, s) => sum + s, 0) });
  };

  const roundRobin = isRoundRobin(bracket);
  const playoffs = roundRobin && hasPlayoffs(bracket);
  const groupCount = bracket.splitIntoBrackets ? (bracket.groupSizes || []).length : 1;
  const groupWord = playoffs ? 'group' : 'bracket';
  const options = playoffs ? advanceOptions(poolSizesFor(bracket)) : [];

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Trophy size={16} />
          </span>
          <div className="min-w-0">
            <div className="group relative flex items-center">
              <input
                value={bracket.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Beginner, Mixed Doubles"
                aria-label="Category name"
                className={`font-display w-full border-0 border-b border-transparent bg-transparent p-0 pr-5 text-base font-bold text-ink-900 outline-none focus:border-brand-400 ${
                  errors?.name ? 'border-rose-300' : ''
                }`}
              />
              <Pencil
                size={12}
                className="pointer-events-none absolute right-0 shrink-0 text-ink-300 transition group-hover:text-ink-400 group-focus-within:text-brand-500"
              />
            </div>
            {typeof totalMatches === 'number' && (
              <p className="mt-0.5 text-xs text-ink-400">
                {totalMatches} match{totalMatches === 1 ? '' : 'es'} · {bracketCountFor(bracket)} bracket{bracketCountFor(bracket) === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label={`Remove ${bracket.name || 'category'}`}
          className="press-scale shrink-0 rounded-full p-2 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {errors?.name && <p className="-mt-2 mb-3 text-[11px] font-semibold text-rose-600">{errors.name}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Format">
          <Select value={formatValue(bracket)} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Teams / Pairs" hint={errors?.teamCount}>
          <NumberInput value={bracket.teamCount} onChange={setTeamCount} min={2} max={128} className={errors?.teamCount ? 'border-rose-300' : ''} />
        </FormField>

        {roundRobin && (
          <FormField label={`Number of ${groupWord}s`} hint={`Each ${groupWord} plays its own round robin. 1 keeps everyone together.`}>
            <NumberInput value={groupCount} onChange={setGroupCount} min={1} max={8} />
          </FormField>
        )}

        {!roundRobin && (
          <FormField label="3rd place match" hint="Only added when there's a real semifinal">
            <div className="flex h-[42px] items-center">
              <Switch checked={bracket.thirdPlace} onChange={(v) => set({ thirdPlace: v })} />
            </div>
          </FormField>
        )}
      </div>

      {roundRobin && bracket.splitIntoBrackets && (
        <div className="animate-slide-down mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            Teams per {groupWord}
            {errors?.groupSizes ? <span className="ml-2 font-semibold normal-case text-rose-600">{errors.groupSizes}</span> : null}
          </p>
          <p className="mb-1.5 text-[11px] text-ink-400">Divided evenly from Teams / Pairs. Edit any {groupWord} to fine-tune.</p>
          <div className="flex flex-wrap gap-2">
            {(bracket.groupSizes || []).map((size, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-ink-50/50 px-2.5 py-1.5">
                <span className="text-[11px] font-bold text-ink-500">{String.fromCharCode(65 + i)}</span>
                <NumberInput value={size} onChange={(v) => setGroupSize(i, v)} min={2} max={32} className="w-14 border-0 bg-transparent px-1 py-0 text-center focus:ring-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {roundRobin && (
        <div className={`mt-4 rounded-xl border transition-colors duration-200 ${playoffs ? 'border-brand-200 bg-brand-50/40' : 'border-ink-100 bg-ink-50/40'}`}>
          <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink-900">Add playoffs</span>
              <span className="block text-[11px] text-ink-500">Top teams from each group move on to a knockout bracket</span>
            </span>
            <Switch checked={playoffs} onChange={(v) => set({ playoffs: v })} />
          </label>

          {playoffs && (
            <div className="animate-slide-down grid grid-cols-1 gap-3 border-t border-brand-100 px-4 pt-3 pb-4 sm:grid-cols-2">
              {options.length > 0 ? (
                <FormField label="Advance per group" hint={errors?.advancePerGroup}>
                  <Select value={bracket.advancePerGroup} onChange={(e) => set({ advancePerGroup: Number(e.target.value) })} className={inputClass}>
                    {options.map(({ n, firstStage }) => (
                      <option key={n} value={n}>
                        Top {n} → {firstStage}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <p className="text-xs font-semibold text-amber-700 sm:col-span-2">
                  {groupCount === 1
                    ? 'Playoffs need at least 2 teams in the group.'
                    : 'Playoffs pair groups against each other, so use 1, 2, 4 or 8 groups.'}
                </p>
              )}
              {options.length > 0 && (
                <FormField label="3rd place match">
                  <div className="flex h-[42px] items-center">
                    <Switch checked={bracket.thirdPlace} onChange={(v) => set({ thirdPlace: v })} />
                  </div>
                </FormField>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
