import { useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import Select from '../ui/Select';

function isDoublesFormat(matchType) {
  return /doubles/i.test(matchType || '');
}

export default function EditRegistrationModal({ registration, categories, onSave, onClose }) {
  const [categoryId, setCategoryId] = useState(registration.category_id);
  const [player1, setPlayer1] = useState(registration.player_name);
  const [player2, setPlayer2] = useState(registration.player2_name || '');
  const [email, setEmail] = useState(registration.player_email || '');
  const [phone, setPhone] = useState(registration.phone || '');
  const [clubName, setClubName] = useState(registration.club_name || '');
  const [address, setAddress] = useState(registration.address || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategoryId(registration.category_id);
    setPlayer1(registration.player_name);
    setPlayer2(registration.player2_name || '');
    setEmail(registration.player_email || '');
    setPhone(registration.phone || '');
    setClubName(registration.club_name || '');
    setAddress(registration.address || '');
  }, [registration]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isDoubles = isDoublesFormat(selectedCategory?.match_type);

  const handleSave = async () => {
    if (!player1.trim()) return;
    if (isDoubles && !player2.trim()) return;
    setSaving(true);
    try {
      await onSave({
        category_id: categoryId,
        player_name: player1.trim(),
        player2_name: isDoubles ? player2.trim() : null,
        player_email: email.trim() || null,
        phone: phone.trim() || null,
        club_name: clubName.trim() || null,
        address: address.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = player1.trim() && (!isDoubles || player2.trim());

  return (
    <Modal open onClose={onClose} title="Edit registration" icon={UserCog} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <FormField label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.match_type})
              </option>
            ))}
          </Select>
          {selectedCategory?.id !== registration.category_id && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">Moving this pair to a different category.</p>
          )}
        </FormField>

        <FormField label={isDoubles ? 'Player 1 name' : 'Player name'}>
          <input value={player1} onChange={(e) => setPlayer1(e.target.value)} className={inputClass} />
        </FormField>

        {isDoubles && (
          <FormField label="Player 2 name">
            <input value={player2} onChange={(e) => setPlayer2(e.target.value)} className={inputClass} />
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Email" hint="Optional">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Phone">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Club name">
            <input value={clubName} onChange={(e) => setClubName(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Address">
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </FormField>
        </div>

        <div className="mt-2 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
