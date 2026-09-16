import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, MailCheck, Pencil, RefreshCw, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import StaffPermissionToggles from '../../../components/organizer/StaffPermissionToggles';
import EditStaffModal from '../../../components/organizer/EditStaffModal';
import StaffLoginModal from '../../../components/organizer/StaffLoginModal';
import TempAccessFields from '../../../components/organizer/TempAccessFields';
import TempCredentialsReveal from '../../../components/organizer/TempCredentialsReveal';
import FormField, { inputClass } from '../../../components/ui/FormField';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { getEventById } from '../../../data/eventsApi';
import { listEventStaff, removeEventStaff } from '../../../data/staffApi';
import { DEFAULT_PERMISSIONS, EVENT_PERMISSIONS } from '../../../data/permissions';
import { daysLeftLabel, generatePassword, generateUsername } from '../../../utils/tempAccess';

function InviteCard({ eventId, onInvited }) {
  const { inviteEventStaff } = useAuth();
  const { pushToast } = useToast();
  const [mode, setMode] = useState('email'); // 'email' | 'temporary'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(() => generateUsername());
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [days, setDays] = useState(7);
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'temporary') {
      const daysNum = Number(days);
      if (!Number.isInteger(daysNum) || daysNum < 1) {
        pushToast('Enter a valid number of days', 'error');
        return;
      }
      if (password.length < 6) {
        pushToast('Password must be at least 6 characters', 'error');
        return;
      }
    }
    setSubmitting(true);
    setResult(null);
    try {
      const data = await inviteEventStaff({
        eventId,
        email: mode === 'temporary' ? username : email,
        permissions,
        ...(mode === 'temporary' ? { temporaryAccess: { days: Number(days), password } } : {}),
      });
      setResult(data);
      setEmail('');
      setUsername(generateUsername());
      setPermissions(DEFAULT_PERMISSIONS);
      setPassword(generatePassword());
      onInvited?.();
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <UserPlus size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Invite a helper</h2>
          <p className="text-xs text-ink-500">They get their own login, scoped to just this event and whatever you switch on below.</p>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-full bg-ink-50 p-1">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${mode === 'email' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
        >
          Send email invite
        </button>
        <button
          type="button"
          onClick={() => setMode('temporary')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${mode === 'temporary' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
        >
          Generate temporary login
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'email' ? (
          <FormField label="Helper's email" className="max-w-sm">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="helper@email.com" />
          </FormField>
        ) : (
          <FormField label="Username" hint="Pre-generated — no real email needed. This is what your helper types into the Email field when they sign in.">
            <div className="flex items-center gap-2">
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} font-mono`} />
              <button
                type="button"
                title="Generate a new username"
                onClick={() => setUsername(generateUsername())}
                className="flex h-full shrink-0 items-center justify-center rounded-xl border border-ink-200 px-3 text-ink-500 transition hover:bg-ink-50"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </FormField>
        )}

        {mode === 'temporary' && <TempAccessFields days={days} onDaysChange={setDays} password={password} onPasswordChange={setPassword} />}

        <StaffPermissionToggles value={permissions} onChange={setPermissions} />

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? (mode === 'temporary' ? 'Generating…' : 'Sending…') : mode === 'temporary' ? 'Generate temporary login' : 'Send invite'}
          </button>
        </div>
      </form>

      {result && mode === 'temporary' && (
        <div className="mt-4">
          <TempCredentialsReveal email={result.email} password={result.password} expiresAt={result.staff.access_expires_at} />
        </div>
      )}
      {result && mode === 'email' && result.existingAccount && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
          <UserCheck size={16} />
          <span>
            <strong>{result.email}</strong> already had an account, so no invite email was sent — access was granted directly. They can sign
            in with their existing password.
          </span>
        </div>
      )}
      {result && mode === 'email' && !result.existingAccount && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-700">
          <MailCheck size={16} />
          <span>
            Invite sent to <strong>{result.email}</strong> — they'll set their own password by following the link in their email.
          </span>
        </div>
      )}
    </div>
  );
}

function permissionSummary(staff) {
  const granted = EVENT_PERMISSIONS.filter((p) => p.navId && staff[p.column]).map((p) => p.label);
  return granted.length ? granted.join(', ') : 'No pages granted';
}

function StaffList({ eventId, staffList, onEdit, onManageLogin, onRemoved }) {
  const { pushToast } = useToast();
  const confirm = useConfirm();

  const handleRemove = async (staff) => {
    const ok = await confirm({
      title: `Remove ${staff.email}?`,
      confirmLabel: 'Remove',
      message: 'They lose access to this event immediately. Their login and any other events they help with are unaffected.',
    });
    if (!ok) return;
    try {
      await removeEventStaff(staff.id);
      onRemoved(staff.id);
      pushToast('Removed from this event', 'success');
    } catch (err) {
      pushToast(err.message, 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-display text-base font-bold text-ink-900">Helpers on this event</h2>
      {staffList === null && <p className="text-sm text-ink-400">Loading…</p>}
      {staffList && staffList.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-400">
          <Users size={20} className="mx-auto mb-2 text-ink-300" />
          No helpers invited yet.
        </div>
      )}
      {staffList && staffList.length > 0 && (
        <div className="flex flex-col divide-y divide-ink-100">
          {staffList.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-ink-900">{s.email}</p>
                  {daysLeftLabel(s.access_expires_at) && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${daysLeftLabel(s.access_expires_at).tone}`}>
                      {daysLeftLabel(s.access_expires_at).text}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-500">{permissionSummary(s)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  title="Edit permissions"
                  onClick={() => onEdit(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50"
                >
                  <Pencil size={13} />
                </button>
                <button
                  title="Manage temporary login"
                  onClick={() => onManageLogin(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50"
                >
                  <KeyRound size={13} />
                </button>
                <button
                  title="Remove"
                  onClick={() => handleRemove(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-rose-500 transition hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const [event, setEvent] = useState(null);
  const [staffList, setStaffList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [managingLogin, setManagingLogin] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [ev, staff] = await Promise.all([getEventById(eventId), listEventStaff(eventId)]);
      setEvent(ev);
      setStaffList(staff);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Team</h1>
        <p className="text-sm text-ink-500">Appoint people to help run this event, with exactly the pages and features they need.</p>
      </div>

      <div className="flex flex-col gap-5">
        <InviteCard eventId={eventId} onInvited={reload} />
        <StaffList
          eventId={eventId}
          staffList={staffList}
          onEdit={setEditing}
          onManageLogin={setManagingLogin}
          onRemoved={(id) => setStaffList((prev) => prev.filter((s) => s.id !== id))}
        />
      </div>

      {managingLogin && (
        <StaffLoginModal
          staff={managingLogin}
          onClose={() => setManagingLogin(null)}
          onSaved={(updated) => setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
        />
      )}

      {editing && (
        <EditStaffModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setEditing(null);
          }}
        />
      )}
    </EventWorkspaceLayout>
  );
}
