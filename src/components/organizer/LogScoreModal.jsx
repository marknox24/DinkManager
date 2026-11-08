import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import UmpirePicker from './UmpirePicker';
import { useToast } from '../../context/ToastContext';
import { resultTag, teamLabel } from '../../utils/match';
import { matchLevelLabel } from '../../data/playoffApi';

// Editing a result also offers Clear result, for a score logged by mistake:
// a result needs a winner, so Edit score can't take a match back to 0-0.
// `clearLockReason` explains why clearing isn't possible, when it isn't.
export default function LogScoreModal({ match, categoryName, umpires, workload, onSave, onClear, clearLockReason, onClose }) {
  const { pushToast } = useToast();
  const isEditing = match.status === 'completed';
  const isForfeit = isEditing && Boolean(resultTag(match.result_type));
  const [scoreA, setScoreA] = useState(isEditing ? String(match.score_a) : '0');
  const [scoreB, setScoreB] = useState(isEditing ? String(match.score_b) : '0');
  const [umpireName, setUmpireName] = useState(match.umpire_name || '');
  const [saving, setSaving] = useState(false);
  // Keeps an umpire who has since been removed from the pool choosable, so
  // editing their old match doesn't silently drop who officiated it.
  const choices = useMemo(
    () =>
      match.umpire_name && !umpires.some((u) => u.name === match.umpire_name)
        ? [...umpires, { id: `removed:${match.umpire_name}`, name: match.umpire_name, removed: true }]
        : umpires,
    [umpires, match.umpire_name]
  );

  const handleSave = async () => {
    const sA = parseInt(scoreA, 10);
    const sB = parseInt(scoreB, 10);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      pushToast('Enter valid, non-negative scores', 'error');
      return;
    }
    if (sA === sB) {
      pushToast(isEditing && sA === 0 ? 'To undo a score logged by mistake, use Clear result' : 'Ties are not allowed', 'error');
      return;
    }
    if (!umpireName) {
      pushToast('Select an umpire', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave(match, sA, sB, umpireName);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isForfeit ? 'Replace forfeit with played score' : isEditing ? 'Edit score' : 'Log score'}${match.match_code ? ` — ${match.match_code}` : ''}`}
      icon={Trophy}
      maxWidth="max-w-sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
            {categoryName}: {matchLevelLabel(match)}
          </p>
          <p className="text-sm text-ink-600">
            <span className="font-semibold text-ink-800">{teamLabel(match.team_a)}</span>
            <span className="mx-1.5 text-ink-300">vs</span>
            <span className="font-semibold text-ink-800">{teamLabel(match.team_b)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Score A">
            <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className={`${inputClass} text-center`} autoFocus />
          </FormField>
          <FormField label="Score B">
            <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className={`${inputClass} text-center`} />
          </FormField>
        </div>

        {/* Whoever is picked here is credited with the game on the Umpires
            page, so this is also where a replacement umpire gets recorded.
            No recommendation: this records who did officiate, not who
            should. */}
        {choices.length === 0 ? (
          <FormField label="Umpire who officiated">
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600">
              No umpires added yet. Add one from the Umpires page first.
            </p>
          </FormField>
        ) : (
          <UmpirePicker label="Umpire who officiated" umpires={choices} workload={workload} value={umpireName} onChange={setUmpireName} />
        )}

        {isEditing && clearLockReason && <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">Can't clear this result: {clearLockReason}</p>}

        <div className="mt-1 flex items-center justify-end gap-2.5">
          {isEditing && !clearLockReason && (
            <button
              onClick={() => onClear(match)}
              disabled={saving}
              className="mr-auto rounded-full px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              Clear result
            </button>
          )}
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || choices.length === 0}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEditing ? 'Update result' : 'Save result'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
