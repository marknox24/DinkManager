import { useState } from 'react';
import { Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { teamLabel } from '../../utils/match';

export default function LogScoreModal({ match, umpires, onSave, onClose }) {
  const { pushToast } = useToast();
  const isEditing = match.status === 'completed';
  const [scoreA, setScoreA] = useState(isEditing ? String(match.score_a) : '11');
  const [scoreB, setScoreB] = useState(isEditing ? String(match.score_b) : '7');
  const [umpireName, setUmpireName] = useState(match.umpire_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const sA = parseInt(scoreA, 10);
    const sB = parseInt(scoreB, 10);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      pushToast('Enter valid, non-negative scores', 'error');
      return;
    }
    if (sA === sB) {
      pushToast('Ties are not allowed', 'error');
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
      title={`${isEditing ? 'Edit score' : 'Log score'}${match.match_code ? ` — ${match.match_code}` : ''}`}
      icon={Trophy}
      maxWidth="max-w-sm"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-800">{teamLabel(match.team_a)}</span>
          <span className="mx-1.5 text-ink-300">vs</span>
          <span className="font-semibold text-ink-800">{teamLabel(match.team_b)}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Score A">
            <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className={`${inputClass} text-center`} autoFocus />
          </FormField>
          <FormField label="Score B">
            <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className={`${inputClass} text-center`} />
          </FormField>
        </div>

        <FormField label="Umpire">
          {umpires.length === 0 ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600">
              No umpires added yet. Add one from the Umpires page first.
            </p>
          ) : (
            <select value={umpireName} onChange={(e) => setUmpireName(e.target.value)} className={inputClass}>
              <option value="" disabled>
                Select umpire
              </option>
              {umpires.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || umpires.length === 0}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEditing ? 'Update result' : 'Save result'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
