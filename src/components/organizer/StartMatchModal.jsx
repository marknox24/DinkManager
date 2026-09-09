import { useState } from 'react';
import { Play } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { teamLabel } from '../../utils/match';

// Court and umpire are required before a match can go live — keeps every
// live match tied to a real court/official and never over the venue's
// configured court count. Both lists already exclude anything in use by
// another live match (courts already occupied, umpires already officiating).
export default function StartMatchModal({ match, availableCourts, availableUmpires, onStart, onClose }) {
  const { pushToast } = useToast();
  const [court, setCourt] = useState('');
  const [umpireName, setUmpireName] = useState('');
  const [starting, setStarting] = useState(false);

  const canStart = availableCourts.length > 0 && availableUmpires.length > 0;

  const handleStart = async () => {
    if (!court) {
      pushToast('Select a court', 'error');
      return;
    }
    if (!umpireName) {
      pushToast('Select an umpire', 'error');
      return;
    }
    setStarting(true);
    try {
      await onStart(match, { court: parseInt(court, 10), umpire_name: umpireName });
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Start match${match.match_code ? ` — ${match.match_code}` : ''}`} icon={Play} maxWidth="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-800">{teamLabel(match.team_a)}</span>
          <span className="mx-1.5 text-ink-300">vs</span>
          <span className="font-semibold text-ink-800">{teamLabel(match.team_b)}</span>
        </p>

        {availableCourts.length === 0 ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600">
            All courts are currently in use. Finish or cancel a live match to free one up.
          </p>
        ) : availableUmpires.length === 0 ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600">
            No umpires available. Add one from the Umpires page, or wait for one to free up from a live match.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Court">
              <select value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass} autoFocus>
                <option value="" disabled>
                  Select court
                </option>
                {availableCourts.map((c) => (
                  <option key={c} value={c}>
                    Court {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Umpire">
              <select value={umpireName} onChange={(e) => setUmpireName(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  Select umpire
                </option>
                {availableUmpires.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting || !canStart}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {starting ? 'Starting…' : 'Start match'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
