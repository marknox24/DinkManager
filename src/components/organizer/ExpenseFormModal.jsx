import { useState } from 'react';
import { Loader2, Receipt as ReceiptIcon, UploadCloud } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass, textareaClass } from '../ui/FormField';
import { EXPENSE_CATEGORIES } from '../../data/constants';
import { uploadExpenseReceipt } from '../../data/eventsApi';
import { useToast } from '../../context/ToastContext';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function ExpenseFormModal({ eventId, expense, onSave, onClose }) {
  const { pushToast } = useToast();
  const [name, setName] = useState(expense?.name || '');
  const [category, setCategory] = useState(expense?.category || EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState(expense?.amount ?? '');
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date || todayIso());
  const [notes, setNotes] = useState(expense?.notes || '');
  const [receiptPath, setReceiptPath] = useState(expense?.receipt_path || null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() && Number(amount) >= 0;

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const { path } = await uploadExpenseReceipt(eventId, file);
      setReceiptPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        category,
        amount: parseFloat(amount) || 0,
        expense_date: expenseDate,
        notes: notes.trim() || null,
        receipt_path: receiptPath,
      });
      onClose();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={expense ? 'Edit expense' : 'Add expense'} icon={ReceiptIcon} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <FormField label="Expense name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Court rental" className={inputClass} autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Amount">
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </FormField>
        </div>

        <FormField label="Date">
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Receipt" hint="Optional — attach a photo of the receipt">
          {receiptPath ? (
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/60 px-3.5 py-2.5 text-xs font-semibold text-ink-600">
              <ReceiptIcon size={14} className="text-brand-500" /> Receipt attached
              <label className="ml-auto cursor-pointer text-brand-600 hover:text-brand-700">
                Replace
                <input type="file" accept="image/*" onChange={(e) => handleReceiptUpload(e.target.files?.[0])} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-bold text-ink-500 transition hover:bg-ink-50">
              {uploadingReceipt ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {uploadingReceipt ? 'Uploading…' : 'Upload photo of receipt'}
              <input type="file" accept="image/*" onChange={(e) => handleReceiptUpload(e.target.files?.[0])} className="hidden" />
            </label>
          )}
        </FormField>

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
            {saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
