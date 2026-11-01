import { useState } from 'react';
import { Flag } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { teamLabel } from '../../utils/match';
import { FORFEIT_POINTS } from '../../utils/forfeit';
import { matchLevelLabel } from '../../data/playoffApi';

// Closes a match nobody will finish. No umpire is asked for, since nobody
// officiated it. onSave receives the winner's team id, or null for a double
// forfeit (see forfeitResult in utils/forfeit.js).
export default function ForfeitModal({ match, categoryName, onSave, onClose }) {
  const { pushToast } = useToast();
  const [choice, setChoice] = useState(null);
  const [saving, setSaving] = useState(false);

  const nameA = teamLabel(match.team_a);
  const nameB = teamLabel(match.team_b);
  const options = [
    { value: 'a', label: `${nameA} forfeits`, result: `${nameB} wins ${FORFEIT_POINTS}–0` },
    { value: 'b', label: `${nameB} forfeits`, result: `${nameA} wins ${FORFEIT_POINTS}–0` },
    { value: 'both', label: 'Both forfeit', result: 'Loss for both, 0–0, no points' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(match, choice === 'both' ? null : choice === 'a' ? match.team_b_id : match.team_a_id);
    } catch (e) {
      pushToast(e.message, 'error');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Record forfeit${match.match_code ? ` — ${match.match_code}` : ''}`} icon={Flag} maxWidth="max-w-sm">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
            {categoryName}: {matchLevelLabel(match)}
          </p>
          <p className="text-sm text-ink-600">
            <span className="font-semibold text-ink-800">{nameA}</span>
            <span className="mx-1.5 text-ink-300">vs</span>
            <span className="font-semibold text-ink-800">{nameB}</span>
          </p>
        </div>

        <div role="radiogroup" aria-label="Who forfeits" className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={choice === o.value}
              onClick={() => setChoice(o.value)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                choice === o.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-ink-200 hover:bg-ink-50'
              }`}
            >
              <div className="text-sm font-bold text-ink-900">{o.label}</div>
              <div className="text-xs text-ink-500">{o.result}</div>
            </button>
          ))}
        </div>

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !choice}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Record forfeit'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
