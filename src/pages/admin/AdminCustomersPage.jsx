import { useEffect, useState } from 'react';
import { MailCheck, UserPlus } from 'lucide-react';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';

function daysLeftLabel(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: 'Expired', tone: 'text-rose-600 bg-rose-50' };
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: 'text-brand-700 bg-brand-50' };
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

      {result && (
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

function CustomersList({ refreshKey }) {
  const [customers, setCustomers] = useState(null);
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
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{c.email}</p>
                  <p className="text-xs text-ink-500">
                    {c.role} · up to {c.max_events ?? '∞'} event{c.max_events === 1 ? '' : 's'} · issued{' '}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                {badge && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.tone}`}>{badge.text}</span>}
              </div>
            );
          })}
        </div>
      )}
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
