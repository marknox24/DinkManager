import { useState } from 'react';
import { UserCog } from 'lucide-react';
import Modal from '../ui/Modal';
import StaffPermissionToggles from './StaffPermissionToggles';
import { updateStaffPermissions } from '../../data/staffApi';
import { PERMISSION_COLUMNS } from '../../data/permissions';
import { useToast } from '../../context/ToastContext';

export default function EditStaffModal({ staff, onClose, onSaved }) {
  const { pushToast } = useToast();
  const [value, setValue] = useState(() => {
    const initial = {};
    PERMISSION_COLUMNS.forEach((col) => {
      initial[col] = Boolean(staff[col]);
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateStaffPermissions(staff.id, value);
      pushToast('Permissions updated', 'success');
      onSaved(updated);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={staff.email} icon={UserCog}>
      <p className="mb-4 text-xs text-ink-500">Changes apply the next time they load a page — not live in an already-open tab.</p>
      <StaffPermissionToggles value={value} onChange={setValue} />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
