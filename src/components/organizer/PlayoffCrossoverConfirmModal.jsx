import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { deriveLadder, expandFirstStageSlots, unpairedPools } from '../../data/playoffApi';

// Shown right before generating the FIRST knockout stage. The organizer set
// an intended crossover back in Event Details, but that was before the
// Randomizer ran — this is the moment to confirm (or fix) it against the
// pools actually drawn, rather than letting a mismatch fail generation with
// no way to recover in place.
export default function PlayoffCrossoverConfirmModal({ level, poolLetters, plan, onConfirm, onClose }) {
  const { pushToast } = useToast();
  const [pairs, setPairs] = useState(() => {
    const knownLetters = new Set(poolLetters);
    const validSaved = (plan.playoff_pool_pairs || []).filter(([a, b]) => knownLetters.has(a) && knownLetters.has(b));
    const usedLetters = new Set(validSaved.flat());
    const leftover = poolLetters.filter((l) => !usedLetters.has(l));
    const autoPairs = [];
    for (let i = 0; i < leftover.length - 1; i += 2) autoPairs.push([leftover[i], leftover[i + 1]]);
    return [...validSaved, ...autoPairs];
  });
  const [advance, setAdvance] = useState(plan.playoff_advance_per_pool);
  const [submitting, setSubmitting] = useState(false);

  const setPairRight = (index, newRight) => {
    setPairs((prev) => {
      const next = prev.map((p) => [...p]);
      const conflictIndex = next.findIndex((p, i) => i !== index && p[1] === newRight);
      if (conflictIndex !== -1) next[conflictIndex][1] = next[index][1];
      next[index][1] = newRight;
      return next;
    });
  };

  const ladder = useMemo(() => deriveLadder({ poolPairs: pairs, advancePerPool: advance, thirdPlace: plan.playoff_third_place }), [pairs, advance, plan.playoff_third_place]);
  const slots = useMemo(() => expandFirstStageSlots(pairs, advance), [pairs, advance]);
  // deriveLadder only checks the paired letters against each other — it has
  // no notion of "every pool that was actually drawn," so an odd number of
  // drawn pools (or a leftover reconciliation from a stale saved plan) could
  // silently leave one pool's teams out of the knockout stage entirely.
  const missing = useMemo(() => unpairedPools(poolLetters, pairs), [poolLetters, pairs]);
  const canGenerate = ladder.valid && missing.length === 0;

  const handleConfirm = async () => {
    if (!canGenerate) {
      pushToast(missing.length > 0 ? `Pool${missing.length === 1 ? '' : 's'} ${missing.join(', ')} ${missing.length === 1 ? "isn't" : "aren't"} paired with anything.` : ladder.error, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ playoff_pool_pairs: pairs, playoff_advance_per_pool: advance });
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Generate ${level.label}`} icon={Trophy} maxWidth="max-w-lg">
      <p className="mb-4 text-sm text-ink-600">
        These pools were actually drawn: <span className="font-semibold text-ink-900">{poolLetters.join(', ')}</span>. Confirm the crossover
        below before generating — this is your last chance to adjust it.
      </p>

      <div className="mb-4 flex flex-col gap-2">
        {pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-ink-700">{pair[0]}</span>
            <span className="text-xs font-bold uppercase tracking-wide text-ink-400">crosses with</span>
            <Select value={pair[1]} onChange={(e) => setPairRight(i, e.target.value)} className="ml-auto w-20 rounded-lg py-1.5 text-center text-xs font-extrabold" dense>
              {poolLetters
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

      {!canGenerate ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
          {missing.length > 0
            ? `Pool${missing.length === 1 ? '' : 's'} ${missing.join(', ')} ${missing.length === 1 ? "isn't" : "aren't"} paired with anything — every pool needs a crossover partner.`
            : ladder.error}
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {slots.map((slot, i) => (
            <span key={i} className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600">
              {slot.a.letter}
              {slot.a.rank} vs {slot.b.letter}
              {slot.b.rank}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting || !canGenerate}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Generating…' : `Generate ${level.label}`}
        </button>
      </div>
    </Modal>
  );
}
