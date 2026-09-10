import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass, textareaClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function EarningFormModal({ earning, onSave, onClose }) {
  const { pushToast } = useToast();
  const [name, setName] = useState(earning?.name || '');
  const [amount, setAmount] = useState(earning?.amount ?? '');
  const [earningDate, setEarningDate] = useState(earning?.earning_date || todayIso());
  const [notes, setNotes] = useState(earning?.notes || '');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() && Number(amount) >= 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        amount: parseFloat(amount) || 0,
        earning_date: earningDate,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={earning ? 'Edit earning' : 'Add earning'} icon={DollarSign} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <FormField label="Description">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Concession stand sales" className={inputClass} autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Amount">
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Date">
            <input type="date" value={earningDate} onChange={(e) => setEarningDate(e.target.value)} className={inputClass} />
          </FormField>
        </div>

        <FormField label="Notes" hint="Optional">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
        </FormField>

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : earning ? 'Save changes' : 'Add earning'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
