import { useMemo, useState } from 'react';
import { AlertTriangle, Layers, ListChecks, Lock, SlidersHorizontal, Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import Switch from '../ui/Switch';
import Select from '../ui/Select';
import FormField, { inputClass } from '../ui/FormField';
import { deriveLadder, expandFirstStageSlots, readPlan, unpairedPools } from '../../data/playoffApi';

// Same visual language as RandomizerModal's bracket cards, so a pool looks
// the same everywhere it shows up in the app.
const BRACKET_COLORS = [
  'border-brand-300 bg-brand-50/60 text-brand-700',
  'border-sky-300 bg-sky-50/60 text-sky-700',
  'border-violet-300 bg-violet-50/60 text-violet-700',
  'border-amber-300 bg-amber-50/60 text-amber-700',
  'border-rose-300 bg-rose-50/60 text-rose-700',
  'border-teal-300 bg-teal-50/60 text-teal-700',
];

function letterAt(i) {
  return String.fromCharCode(65 + i);
}

// [[A,C],[B,D]] for 4 pools, [[A,E],[B,F],[C,G],[D,H]] for 8, etc. — pairs
// the first half of the alphabet with the second half so a pool never faces
// itself, matching the plan's "adjacent" default crossover.
function defaultPairs(poolCount) {
  const half = Math.floor(poolCount / 2);
  return Array.from({ length: half }, (_, i) => [letterAt(i), letterAt(i + half)]);
}

// One row of the vertical level timeline in the preview column — a numbered
// circle connected to the next row by a line, so the whole ladder reads as
// one continuous journey rather than a flat stack of cards.
function TimelineRow({ num, isLast, locked, children }) {
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && <div className="absolute bottom-0 left-[15px] top-8 w-px bg-ink-200" />}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
          locked ? 'bg-ink-100 text-ink-400' : 'bg-brand-600 text-white'
        }`}
      >
        {locked ? <Lock size={12} /> : num}
      </div>
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  );
}

export default function PlayoffStagesEditor({ category, onSave, onClose }) {
  const initial = useMemo(() => readPlan(category), [category]);
  const [enabled, setEnabled] = useState(initial.playoff_enabled);
  const [poolCount, setPoolCount] = useState(initial.playoff_pool_count || 4);
  const [advance, setAdvance] = useState(initial.playoff_advance_per_pool || 2);
  const [pairs, setPairs] = useState(initial.playoff_pool_pairs.length > 0 ? initial.playoff_pool_pairs : defaultPairs(initial.playoff_pool_count || 4));
  const [thirdPlace, setThirdPlace] = useState(initial.playoff_third_place);

  const handlePoolCountChange = (value) => {
    // Rounded to even: pool pairing always needs an even count, and the
    // input's step={2} only constrains the spinner arrows, not typed values
    // — an odd count here used to leave one pool permanently unpaired (and
    // silently excluded from the knockout stage) with no error shown.
    const n = Math.max(2, Math.round((parseInt(value, 10) || 2) / 2) * 2);
    setPoolCount(n);
    setPairs(defaultPairs(n));
  };

  // Swaps the two pairs' right-hand letters if the newly-picked one was
  // already assigned elsewhere, so every pool still appears exactly once.
  const setPairRight = (index, newRight) => {
    setPairs((prev) => {
      const next = prev.map((p) => [...p]);
      const conflictIndex = next.findIndex((p, i) => i !== index && p[1] === newRight);
      if (conflictIndex !== -1) next[conflictIndex][1] = next[index][1];
      next[index][1] = newRight;
      return next;
    });
  };

  const ladder = useMemo(() => deriveLadder({ poolPairs: pairs, advancePerPool: advance, thirdPlace }), [pairs, advance, thirdPlace]);
  const firstStageSlots = useMemo(() => expandFirstStageSlots(pairs, advance), [pairs, advance]);
  const allLetters = useMemo(() => Array.from({ length: poolCount }, (_, i) => letterAt(i)), [poolCount]);
  // Belt-and-suspenders: deriveLadder only checks pairs against each other,
  // not against every pool that's supposed to exist — a plan saved before
  // poolCount was forced even (or loaded from a stale record) could still
  // leave one pool out entirely.
  const missing = useMemo(() => unpairedPools(allLetters, pairs), [allLetters, pairs]);

  const canSave = !enabled || (ladder.valid && missing.length === 0);

  const handleSave = () => {
    onSave({
      playoff_enabled: enabled,
      playoff_pool_count: poolCount,
      playoff_advance_per_pool: advance,
      playoff_pool_pairs: pairs,
      playoff_third_place: thirdPlace,
    });
  };

  return (
    <Modal open onClose={onClose} title="Playoff levels" icon={Trophy} maxWidth="max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
        <div>
          <div className="text-sm font-bold text-ink-900">Knockout stage after pool play</div>
          <div className="text-xs text-ink-500">Off by default — pool play (round robin) alone decides the standings.</div>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      {!enabled ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white p-4 text-ink-400">
          <Lock size={15} />
          <div className="text-xs font-semibold">Level 1 · Round Robin — each pair plays every other pair once (already set up).</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: everything the organizer actually configures. */}
          <div>
            <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
              <SlidersHorizontal size={13} /> Configure
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Number of pools">
                <input type="number" min={2} step={2} value={poolCount} onChange={(e) => handlePoolCountChange(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Advance per pool">
                <Select value={advance} onChange={(e) => setAdvance(parseInt(e.target.value, 10))} className={inputClass}>
                  <option value={1}>Top 1 (winner)</option>
                  <option value={2}>Top 2</option>
                </Select>
              </FormField>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-ink-100 bg-white p-3.5">
              <div>
                <div className="text-sm font-semibold text-ink-800">Fight for 3rd place</div>
                <div className="text-xs text-ink-500">Both semifinal losers play a decider for bronze.</div>
              </div>
              <Switch checked={thirdPlace} onChange={setThirdPlace} />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Pool crossover</div>
              <p className="mb-2 text-xs text-ink-400">Which pools feed into each other for the first knockout round.</p>
              <div className="flex flex-col gap-2">
                {pairs.map((pair, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${BRACKET_COLORS[i % BRACKET_COLORS.length]}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold">{pair[0]}</span>
                    <span className="text-xs font-bold uppercase tracking-wide opacity-70">crosses with</span>
                    <Select
                      value={pair[1]}
                      onChange={(e) => setPairRight(i, e.target.value)}
                      className="ml-auto w-20 rounded-lg border-0 bg-white/80 py-1.5 text-center text-xs font-extrabold"
                      dense
                    >
                      {allLetters
                        .filter((l) => l !== pair[0])
                        .map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: a live, always-in-sync preview of the resulting ladder. */}
          <div>
            <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
              <Layers size={13} /> Your bracket
            </div>

            <div className="rounded-2xl border border-ink-100 bg-white p-4">
              <TimelineRow num={1} locked isLast={!ladder.valid && ladder.levels.length === 0}>
                <div className="text-sm font-bold text-ink-400">Round Robin</div>
                <div className="text-xs text-ink-400">Already set up — every pair plays once.</div>
              </TimelineRow>

              {!ladder.valid || missing.length > 0 ? (
                <TimelineRow num={2} isLast>
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {missing.length > 0
                        ? `Pool${missing.length === 1 ? '' : 's'} ${missing.join(', ')} ${missing.length === 1 ? "isn't" : "aren't"} paired with anything — every pool needs a crossover partner.`
                        : ladder.error}
                    </span>
                  </div>
                </TimelineRow>
              ) : (
                ladder.levels.map((level, i) => (
                  <TimelineRow key={level.kind} num={i + 2} isLast={i === ladder.levels.length - 1}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-ink-900">{level.label}</div>
                      <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-500">
                        {level.matchCount} match{level.matchCount === 1 ? '' : 'es'}
                      </span>
                    </div>
                    {i === 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {firstStageSlots.map((slot, si) => (
                          <span key={si} className="flex items-center gap-1 rounded-full bg-ink-50 px-2 py-1 text-[11px] font-semibold text-ink-600">
                            <ListChecks size={11} className="text-ink-300" />
                            {slot.a.letter}
                            {slot.a.rank} vs {slot.b.letter}
                            {slot.b.rank}
                          </span>
                        ))}
                      </div>
                    )}
                  </TimelineRow>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          Save levels
        </button>
      </div>
    </Modal>
  );
}
