import { Pencil, Trash2, Trophy } from 'lucide-react';
import FormField, { inputClass } from '../../ui/FormField';
import Select from '../../ui/Select';
import Switch from '../../ui/Switch';
import NumberInput from '../../ui/NumberInput';

const FORMATS = ['Round Robin', 'Single Elimination', 'Round Robin + Playoffs'];

// How many physical brackets this category produces — matches the real
// product's model (a category can contain several brackets: one per group,
// plus a knockout bracket). Single Elimination is always a single bracket;
// Round Robin + Playoffs is one bracket per group plus one knockout
// bracket; a split Round Robin is one independent bracket per pool (no
// knockout); a plain Round Robin is a single bracket.
function bracketCountFor(bracket) {
  if (bracket.format === 'Round Robin + Playoffs') {
    return (bracket.groupSizes || []).length + 1;
  }
  if (bracket.format === 'Round Robin' && bracket.splitIntoBrackets) {
    return (bracket.groupSizes || []).length;
  }
  return 1;
}

// Both Round Robin + Playoffs and a split Round Robin describe their team
// counts via `groupSizes` (one entry per bracket) instead of a single flat
// `teamCount` — this decides whether the per-bracket breakdown shows.
function usesGroupSizes(bracket) {
  return bracket.format === 'Round Robin + Playoffs' || (bracket.format === 'Round Robin' && bracket.splitIntoBrackets);
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

// Pure array-in-local-state pattern (mirrors ContactsEditor.jsx) — there's
// no backend here, so unlike the real app's CategoryEditor this never
// "commits" anything; every keystroke just calls onChange with the next
// bracket object.
export default function BracketCard({ bracket, errors, totalMatches, onChange, onRemove }) {
  const set = (patch) => onChange({ ...bracket, ...patch });

  // Round Robin only: the total-teams field also drives the per-bracket
  // split (when one is active) so "Teams / Pairs" stays the single source
  // of truth for the category's size — editing it re-balances evenly
  // rather than leaving the per-bracket chips stale.
  const setTeamCount = (v) => {
    if (bracket.format === 'Round Robin' && bracket.splitIntoBrackets) {
      const n = (bracket.groupSizes || []).length || 1;
      set({ teamCount: v, groupSizes: evenSplit(v, n) });
    } else {
      set({ teamCount: v });
    }
  };

  // Number of brackets is itself the on/off control now (1 = no split) —
  // changing it always re-derives an even split from the current team
  // count, which is the whole point: type a count and a bracket number,
  // get a working breakdown with no manual per-bracket math.
  const setBracketCount = (count) => {
    const n = Math.max(1, Math.min(8, count ?? 1));
    set({ splitIntoBrackets: n > 1, groupSizes: evenSplit(bracket.teamCount, n) });
  };

  const setGroupCount = (count) => {
    const n = Math.max(1, Math.min(8, count ?? 1));
    const sizes = bracket.groupSizes || [];
    const next = Array.from({ length: n }, (_, i) => sizes[i] ?? 4);
    set({ groupSizes: next });
  };
  const setGroupSize = (idx, size) => {
    const next = [...(bracket.groupSizes || [])];
    next[idx] = size ?? 2;
    set({ groupSizes: next });
  };

  const bracketCountValue = bracket.splitIntoBrackets ? (bracket.groupSizes || []).length : 1;

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
          <Select value={bracket.format} onChange={(e) => set({ format: e.target.value })} className={inputClass}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </FormField>

        {bracket.format !== 'Round Robin + Playoffs' && (
          <FormField label="Teams / Pairs" hint={errors?.teamCount}>
            <NumberInput value={bracket.teamCount} onChange={setTeamCount} min={2} max={128} className={errors?.teamCount ? 'border-rose-300' : ''} />
          </FormField>
        )}

        {bracket.format === 'Round Robin' && (
          <FormField label="Number of brackets" hint="Most categories split into a few brackets — 1 keeps it as one">
            <NumberInput value={bracketCountValue} onChange={setBracketCount} min={1} max={8} />
          </FormField>
        )}

        {bracket.format === 'Round Robin' && (
          <FormField label="Rounds">
            <Select value={bracket.doubleRoundRobin ? 'twice' : 'once'} onChange={(e) => set({ doubleRoundRobin: e.target.value === 'twice' })} className={inputClass}>
              <option value="once">Play once</option>
              <option value="twice">Play twice (double round robin)</option>
            </Select>
          </FormField>
        )}

        {bracket.format === 'Single Elimination' && (
          <FormField label="3rd place match" hint="Only offered when a real 4-player semifinal exists">
            <div className="flex h-[42px] items-center">
              <Switch checked={bracket.thirdPlace} onChange={(v) => set({ thirdPlace: v })} />
            </div>
          </FormField>
        )}

        {bracket.format === 'Round Robin + Playoffs' && (
          <>
            <FormField label="Number of groups">
              <NumberInput value={(bracket.groupSizes || []).length} onChange={setGroupCount} min={1} max={8} />
            </FormField>
            <FormField label="Advance per group" hint={errors?.advancePerGroup || 'Supports 1, 2, or 4 advancing to a clean knockout bracket'}>
              <NumberInput value={bracket.advancePerGroup} onChange={(v) => set({ advancePerGroup: v })} min={1} max={4} className={errors?.advancePerGroup ? 'border-rose-300' : ''} />
            </FormField>
            <FormField label="3rd place match">
              <div className="flex h-[42px] items-center">
                <Switch checked={bracket.thirdPlace} onChange={(v) => set({ thirdPlace: v })} />
              </div>
            </FormField>
          </>
        )}
      </div>

      {usesGroupSizes(bracket) && (
        <div className="animate-slide-down mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            {bracket.format === 'Round Robin + Playoffs' ? 'Teams per group' : 'Teams per bracket'}
            {errors?.groupSizes ? <span className="ml-2 font-semibold normal-case text-rose-600">{errors.groupSizes}</span> : null}
          </p>
          {bracket.format === 'Round Robin' && <p className="mb-1.5 text-[11px] text-ink-400">Divided evenly from Teams / Pairs — edit any bracket below to fine-tune.</p>}
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
    </div>
  );
}
