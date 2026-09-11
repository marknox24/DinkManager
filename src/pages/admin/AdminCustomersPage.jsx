import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MailCheck, Pencil, RefreshCw, Trash2, UserCheck, UserPlus } from 'lucide-react';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';

function daysLeftLabel(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: 'Expired', tone: 'text-rose-600 bg-rose-50' };
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: 'text-brand-700 bg-brand-50' };
}

// Not security-sensitive on its own — the admin hands this to the customer
// as a starting password, same as any temporary/trial credential.
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function CreateTrialCard({ onCreated }) {
  const { createTrialAccount } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [days, setDays] = useState(7);
  const [maxEvents, setMaxEvents] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const data = await createTrialAccount({ email, days: Number(days), maxEvents: Number(maxEvents), role: 'organizer' });
      setResult(data);
      setEmail('');
      onCreated?.();
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
          <h2 className="font-display text-base font-bold text-ink-900">Invite a trial customer</h2>
          <p className="text-xs text-ink-500">Emails an invite link. They set their own password, can create one event, and lose access once it expires.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <FormField label="Customer email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="customer@email.com" />
        </FormField>
        <FormField label="Valid for (days)">
          <input type="number" min={1} required value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Event limit">
          <input type="number" min={1} required value={maxEvents} onChange={(e) => setMaxEvents(e.target.value)} className={inputClass} />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {result && result.existingAccount && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
          <UserCheck size={16} />
          <span>
            <strong>{result.email}</strong> already had an account, so no invite email was sent — trial access was granted directly.
            They can sign in with their existing password. Up to {result.maxEvents} event{result.maxEvents === 1 ? '' : 's'}, expires in{' '}
            {days} day{Number(days) === 1 ? '' : 's'}.
          </span>
        </div>
      )}
      {result && !result.existingAccount && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-700">
          <MailCheck size={16} />
          <span>
            Invite sent to <strong>{result.email}</strong> — they can create up to {result.maxEvents} event
            {result.maxEvents === 1 ? '' : 's'}, and access expires in {days} day{Number(days) === 1 ? '' : 's'}.
          </span>
        </div>
      )}
    </div>
  );
}

function EditCustomerModal({ customer, onClose, onSaved }) {
  const { updateCustomer } = useAuth();
  const { pushToast } = useToast();
  const [days, setDays] = useState(7);
  const [maxEvents, setMaxEvents] = useState(customer.max_events ?? 1);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await updateCustomer({ userId: customer.id, days: Number(days), maxEvents: Number(maxEvents) });
      pushToast('Customer updated', 'success');
      onSaved(data.customer);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit customer" icon={Pencil}>
      <p className="mb-4 text-sm text-ink-500">
        <strong className="text-ink-800">{customer.email}</strong>
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Extend access to (days from now)">
          <input type="number" min={1} required value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Event limit">
          <input type="number" min={1} required value={maxEvents} onChange={(e) => setMaxEvents(e.target.value)} className={inputClass} />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}

function SetPasswordModal({ customer, onClose }) {
  const { setCustomerPassword } = useAuth();
  const { pushToast } = useToast();
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      pushToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await setCustomerPassword({ userId: customer.id, password });
      setDone(true);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Set password" icon={KeyRound}>
      <p className="mb-4 text-sm text-ink-500">
        <strong className="text-ink-800">{customer.email}</strong>
      </p>

      {done ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-700">
            Password set. This is the only time it's shown — copy it now and share it with the customer.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2.5">
            <code className="flex-1 select-all font-mono text-sm text-ink-900">{password}</code>
            <button onClick={handleCopy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-ink-600 hover:bg-white">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={onClose} className="rounded-xl bg-ink-900 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="New password">
            <div className="flex items-center gap-2">
              <input
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                title="Generate a new random password"
                onClick={() => setPassword(generatePassword())}
                className="flex h-full shrink-0 items-center justify-center rounded-xl border border-ink-200 px-3 text-ink-500 transition hover:bg-ink-50"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </FormField>
          <p className="text-xs text-ink-400">The customer can sign in with this immediately — no email confirmation needed.</p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Setting…' : 'Set password'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function CustomersList({ refreshKey }) {
  const [customers, setCustomers] = useState(null);
  const [editing, setEditing] = useState(null);
  const [settingPassword, setSettingPassword] = useState(null);
  const { deleteCustomer } = useAuth();
  const confirm = useConfirm();
  const { pushToast } = useToast();

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, role, access_expires_at, max_events, created_at')
      .not('access_expires_at', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          pushToast(error.message, 'error');
          return;
        }
        setCustomers(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleRemove = async (c) => {
    const ok = await confirm({
      title: `Remove ${c.email}?`,
      confirmLabel: 'Remove',
      message: 'This permanently deletes their login and every event they created. This cannot be undone.',
    });
    if (!ok) return;
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      pushToast('Customer removed', 'success');
    } catch (err) {
      pushToast(err.message, 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-display text-base font-bold text-ink-900">Issued trial logins</h2>
      {customers === null && <p className="text-sm text-ink-400">Loading…</p>}
      {customers && customers.length === 0 && <p className="text-sm text-ink-400">No trial logins issued yet.</p>}
      {customers && customers.length > 0 && (
        <div className="flex flex-col divide-y divide-ink-100">
          {customers.map((c) => {
            const badge = daysLeftLabel(c.access_expires_at);
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{c.email}</p>
                  <p className="text-xs text-ink-500">
                    {c.role} · up to {c.max_events ?? '∞'} event{c.max_events === 1 ? '' : 's'} · issued{' '}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {badge && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.tone}`}>{badge.text}</span>}
                  <button
                    title="Edit trial terms"
                    onClick={() => setEditing(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title="Set password"
                    onClick={() => setSettingPassword(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50"
                  >
                    <KeyRound size={13} />
                  </button>
                  <button
                    title="Remove customer"
                    onClick={() => handleRemove(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-rose-500 transition hover:bg-rose-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditCustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setEditing(null);
          }}
        />
      )}
      {settingPassword && <SetPasswordModal customer={settingPassword} onClose={() => setSettingPassword(null)} />}
    </div>
  );
}

export default function AdminCustomersPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <OrganizerLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Customer logins</h1>
        <p className="text-sm text-ink-500">Issue temporary trial access for customers testing DinkManager.</p>
      </div>
      <div className="flex flex-col gap-5">
        <CreateTrialCard onCreated={() => setRefreshKey((k) => k + 1)} />
        <CustomersList refreshKey={refreshKey} />
      </div>
    </OrganizerLayout>
  );
}
