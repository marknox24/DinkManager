import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import Select from '../ui/Select';

function isDoublesFormat(matchType) {
  return /doubles/i.test(matchType || '');
}

export default function AddPlayerModal({ categories, defaultCategoryId, onAdd, onClose }) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [clubName, setClubName] = useState('');
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isDoubles = isDoublesFormat(selectedCategory?.match_type);
  const canSave = player1.trim() && (!isDoubles || player2.trim()) && categoryId;

  const handleAdd = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onAdd({
        category_id: categoryId,
        player_name: player1.trim(),
        player2_name: isDoubles ? player2.trim() : null,
        club_name: clubName.trim() || null,
      });
      setAddedCount((c) => c + 1);
      setPlayer1('');
      setPlayer2('');
      setClubName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add player" icon={UserPlus} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <FormField label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.match_type})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={isDoubles ? 'Player 1 name' : 'Player name'}>
          <input value={player1} onChange={(e) => setPlayer1(e.target.value)} className={inputClass} autoFocus />
        </FormField>

        {isDoubles && (
          <FormField label="Player 2 name">
            <input value={player2} onChange={(e) => setPlayer2(e.target.value)} className={inputClass} />
          </FormField>
        )}

        <FormField label="Club name" hint="Optional">
          <input value={clubName} onChange={(e) => setClubName(e.target.value)} className={inputClass} />
        </FormField>

        {addedCount > 0 && (
          <p className="text-xs font-semibold text-brand-600">
            {addedCount} player{addedCount > 1 ? 's' : ''} added — approved automatically.
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Done
          </button>
          <button
            onClick={handleAdd}
            disabled={!canSave || saving}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add player'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
