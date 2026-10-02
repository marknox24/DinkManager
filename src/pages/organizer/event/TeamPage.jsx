import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ChevronDown, KeyRound, Mail, MailCheck, Pencil, Plus, RefreshCw, Send, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
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
import { useEventAccess } from '../../../context/EventAccessContext';
import { clearStaffExpiry, listEventStaff, removeEventStaff } from '../../../data/staffApi';
import { DEFAULT_PERMISSIONS, EVENT_PERMISSIONS } from '../../../data/permissions';
import { daysLeftLabel, generatePassword, generateUsername } from '../../../utils/tempAccess';

// Temporary login leads (and is the default): it's the faster path for
// event day — no real email needed, hand over a username and password —
// so it sits first rather than behind the email option.
const INVITE_MODES = [
  { id: 'temporary', icon: KeyRound, title: 'Temporary login', description: 'Generate a username and password — no email needed. Expires on its own.', badge: 'Fastest' },
  { id: 'email', icon: Mail, title: 'Email invite', description: 'They get a link by email and choose their own password.' },
];

function ModeOption({ mode, selected, onSelect }) {
  const Icon = mode.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.98] ${
        selected ? 'border-brand-500 bg-brand-50/60' : 'border-ink-100 bg-white hover:border-ink-200'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
          selected ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500'
        }`}
      >
        <Icon size={17} strokeWidth={2.3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink-900">{mode.title}</span>
          {mode.badge && <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">{mode.badge}</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-500">{mode.description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-transparent'
        }`}
      >
        <Check size={10} strokeWidth={3.5} />
      </span>
    </button>
  );
}

// Collapsed by default: the 12-row permission list used to sit between the
// login fields and the submit button, pushing the one thing the organizer
// came here to do far down the page. The summary line still says what the
// helper will be able to open, and "Customize" reveals the switches.
function AccessSection({ permissions, onChange }) {
  const [open, setOpen] = useState(false);
  const allowed = EVENT_PERMISSIONS.filter((p) => permissions[p.column]);
  const summary = allowed.length ? allowed.map((p) => p.label).join(', ') : 'Nothing yet — turn on at least one area';

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 text-left transition-colors duration-150 hover:bg-ink-50 active:scale-[0.995]"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide text-ink-500">What they can access</span>
          <span className="mt-0.5 block truncate text-sm text-ink-700">
            <strong className="font-bold text-ink-900">
              {allowed.length} of {EVENT_PERMISSIONS.length}
            </strong>{' '}
            · {summary}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-600">
          {open ? 'Hide' : 'Customize'}
          <ChevronDown size={14} className={`transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="animate-slide-down">
          <StaffPermissionToggles value={permissions} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function InviteCard({ eventId, onInvited }) {
  const { inviteEventStaff } = useAuth();
  const { pushToast } = useToast();
  const [mode, setMode] = useState('temporary'); // 'temporary' | 'email'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(() => generateUsername());
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [days, setDays] = useState(7);
  const [neverExpires, setNeverExpires] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const isTemporary = mode === 'temporary';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isTemporary) {
      const daysNum = neverExpires ? 1 : Number(days);
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
        email: isTemporary ? username : email,
        permissions,
        // The server requires an expiry, so "No expiry" is created with the
        // minimum and cleared immediately below (same call as "Make permanent").
        ...(isTemporary ? { temporaryAccess: { days: neverExpires ? 1 : Number(days), password } } : {}),
      });
      if (isTemporary && neverExpires) {
        try {
          data.staff = await clearStaffExpiry(data.staff.id);
        } catch {
          pushToast("Login created, but its expiry couldn't be removed — use the key icon on the helper below to make it permanent.", 'error');
        }
      }
      setResult({ ...data, mode });
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

      {/* Once a login is generated this replaces the whole form (instead of
          appearing below a long list the organizer has to scroll to find) —
          and the method switcher is gone with it, so the one-time password
          can't be wiped by an accidental tap on the other option. */}
      {result ? (
        <div className="flex animate-rise-in flex-col gap-3">
          {result.mode === 'temporary' ? (
            <TempCredentialsReveal email={result.email} password={result.password} expiresAt={result.staff.access_expires_at} />
          ) : result.existingAccount ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
              <UserCheck size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>{result.email}</strong> already had an account, so no invite email was sent — access was granted directly. They can sign in with their existing password.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-700">
              <MailCheck size={16} className="mt-0.5 shrink-0" />
              <span>
                Invite sent to <strong>{result.email}</strong> — they'll set their own password by following the link in their email.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="flex items-center justify-center gap-1.5 self-start rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.97]"
          >
            <Plus size={15} /> {result.mode === 'temporary' ? 'Generate another login' : 'Invite another helper'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div role="radiogroup" aria-label="How to invite" className="grid gap-2.5 sm:grid-cols-2">
            {INVITE_MODES.map((m) => (
              <ModeOption key={m.id} mode={m} selected={mode === m.id} onSelect={() => setMode(m.id)} />
            ))}
          </div>

          {isTemporary ? (
            <div className="flex flex-col gap-4">
              <FormField label="Username" hint="Pre-generated — no real email needed. Your helper types this into the Email field when they sign in.">
                <div className="flex items-center gap-2">
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} font-mono`} />
                  <button
                    type="button"
                    title="Generate a new username"
                    onClick={() => setUsername(generateUsername())}
                    className="flex h-full shrink-0 items-center justify-center rounded-xl border border-ink-200 px-3 text-ink-500 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.95]"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </FormField>
              <TempAccessFields days={days} onDaysChange={setDays} password={password} onPasswordChange={setPassword} neverExpires={neverExpires} onNeverExpiresChange={setNeverExpires} />
            </div>
          ) : (
            <FormField label="Helper's email" className="max-w-sm">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="helper@email.com" />
            </FormField>
          )}

          <AccessSection permissions={permissions} onChange={setPermissions} />

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 sm:self-start"
          >
            {isTemporary ? <KeyRound size={15} /> : <Send size={15} />}
            {submitting ? (isTemporary ? 'Generating…' : 'Sending…') : isTemporary ? 'Generate temporary login' : 'Send invite'}
          </button>
        </form>
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
  const { event } = useEventAccess();
  const [staffList, setStaffList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [managingLogin, setManagingLogin] = useState(null);

  const reload = useCallback(async () => {
    try {
      setStaffList(await listEventStaff(eventId));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <EventWorkspaceLayout event={event}>
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
