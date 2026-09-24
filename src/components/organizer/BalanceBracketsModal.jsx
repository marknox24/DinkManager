import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { moveBracketTeams } from '../../data/bracketsApi';
import { teamLabel } from '../../utils/match';

// Number balancing only — never uses skill, ranking or results to decide
// who plays whom. Target sizes spread the teams as evenly as possible (they
// differ by at most one), with the extra slots going to whichever brackets
// are largest now so the fewest teams move. Teams to move come from the
// over-target brackets, preferring ones with no recorded result yet (W+L =
// 0), then the most recently added. Returns null when the teams can't fit
// under the max per bracket.
function planBalance(brackets, capacity) {
  const total = brackets.reduce((sum, b) => sum + b.teams.length, 0);
  const count = brackets.length;
  if (count === 0) return { moves: [], targets: {} };
  const base = Math.floor(total / count);
  const extra = total % count;
  if (capacity != null && base + (extra > 0 ? 1 : 0) > capacity) return null;

  const bySize = [...brackets].sort((a, b) => b.teams.length - a.teams.length || a.letter.localeCompare(b.letter));
  const targets = {};
  bySize.forEach((b, i) => {
    targets[b.id] = base + (i < extra ? 1 : 0);
  });

  const surplus = [];
  brackets.forEach((b) => {
    const over = b.teams.length - targets[b.id];
    if (over <= 0) return;
    const candidates = [...b.teams].sort(
      (x, y) => Number(x.wins + x.losses > 0) - Number(y.wins + y.losses > 0) || new Date(y.created_at) - new Date(x.created_at)
    );
    candidates.slice(0, over).forEach((team) => surplus.push({ team, from: b }));
  });

  const moves = [];
  [...brackets]
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .forEach((b) => {
      for (let need = targets[b.id] - b.teams.length; need > 0 && surplus.length > 0; need -= 1) {
        const { team, from } = surplus.shift();
        moves.push({ team, from, to: b });
      }
    });
  return { moves, targets };
}

export default function BalanceBracketsModal({ categoryId, brackets, capacity, matchlist, onApplied, onClose }) {
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const plan = useMemo(() => planBalance(brackets, capacity), [brackets, capacity]);

  const handleApply = async () => {
    setSaving(true);
    try {
      await moveBracketTeams(
        categoryId,
        plan.moves.map((m) => ({ team_id: m.team.id, to_bracket_id: m.to.id })),
        'balanced'
      );
      pushToast(`Brackets balanced — ${plan.moves.length} ${plan.moves.length === 1 ? 'team' : 'teams'} moved`, 'success');
      onApplied();
    } catch (e) {
      pushToast(e.message, 'error');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Balance Brackets" icon={Scale}>
      {plan === null ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {brackets.reduce((s, b) => s + b.teams.length, 0)} teams can't fit into {brackets.length} brackets of at most {capacity}. Raise the max teams
            per bracket first.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100">
              Close
            </button>
          </div>
        </div>
      ) : plan.moves.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={15} /> These brackets are already balanced — nothing to move.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-600">
            A recommended distribution based only on team counts. Nothing changes until you apply it.
          </p>

          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-ink-50 px-4 py-3 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Bracket</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Current</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recommended</span>
            {brackets.map((b) => (
              <div key={b.id} className="contents">
                <span className="font-bold text-ink-900">{b.letter}</span>
                <span className="tabular-nums text-ink-600">{b.teams.length}</span>
                <span className={`tabular-nums font-semibold ${plan.targets[b.id] !== b.teams.length ? 'text-brand-700' : 'text-ink-600'}`}>
                  {plan.targets[b.id]}
                </span>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {plan.moves.length} {plan.moves.length === 1 ? 'move' : 'moves'}
            </p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {plan.moves.map((m) => (
                <li key={m.team.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-ink-50/60">
                  <span className="truncate font-semibold text-ink-800">{teamLabel(m.team)}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-ink-500">
                    {m.from.letter} <ArrowRight size={12} /> {m.to.letter}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {matchlist?.hasResults ? (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Matches for this category already contain recorded results. Moving these teams and regenerating the matchlist may affect the existing
              tournament structure. Recorded scores are never deleted.
            </p>
          ) : (
            matchlist?.exists && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                These changes will make the current matchlist outdated. Your existing matchlist will remain unchanged until you regenerate it.
              </p>
            )
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={saving}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? 'Applying…' : 'Apply Recommended Balance'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
