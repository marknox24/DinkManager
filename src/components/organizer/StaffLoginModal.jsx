import { useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import Modal from '../ui/Modal';
import TempAccessFields from './TempAccessFields';
import TempCredentialsReveal from './TempCredentialsReveal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { clearStaffExpiry } from '../../data/staffApi';
import { generatePassword } from '../../utils/tempAccess';

// Manages one staffer's login independent of their feature permissions
// (those live in EditStaffModal) — generate/regenerate a temporary login,
// or revert them back to permanent access.
export default function StaffLoginModal({ staff, onClose, onSaved }) {
  const { inviteEventStaff } = useAuth();
  const { pushToast } = useToast();
  const [days, setDays] = useState(7);
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [clearing, setClearing] = useState(false);

  const hadPermanentAccess = !staff.access_expires_at;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const daysNum = Number(days);
    if (!Number.isInteger(daysNum) || daysNum < 1) {
      pushToast('Enter a valid number of days', 'error');
      return;
    }
    if (password.length < 6) {
      pushToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const data = await inviteEventStaff({
        eventId: staff.event_id,
        email: staff.email,
        permissions: {},
        temporaryAccess: { days: daysNum, password },
      });
      setResult(data);
      onSaved(data.staff);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMakePermanent = async () => {
    setClearing(true);
    try {
      const updated = await clearStaffExpiry(staff.id);
      pushToast('Access is now permanent', 'success');
      onSaved(updated);
      onClose();
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Temporary login" icon={KeyRound}>
      <p className="mb-4 text-sm text-ink-500">
        <strong className="text-ink-800">{staff.email}</strong>
      </p>

      {result ? (
        <TempCredentialsReveal email={result.email} password={result.password} expiresAt={result.staff.access_expires_at} onDone={onClose} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {hadPermanentAccess && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3.5 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>This helper currently has permanent access. Generating a temporary login will make their account expire in the number of days you set below.</span>
            </div>
          )}
          <TempAccessFields days={days} onDaysChange={setDays} password={password} onPasswordChange={setPassword} />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Generating…' : 'Generate temporary login'}
          </button>
          {!hadPermanentAccess && (
            <button
              type="button"
              onClick={handleMakePermanent}
              disabled={clearing}
              className="text-sm font-semibold text-ink-500 transition hover:text-ink-800 disabled:opacity-60"
            >
              {clearing ? 'Updating…' : 'Make permanent'}
            </button>
          )}
        </form>
      )}
    </Modal>
  );
}
