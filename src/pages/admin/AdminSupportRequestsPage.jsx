import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import AccountTypeCard from '../../components/ui/AccountTypeCard';
import AdminNavLinks from '../../components/admin/AdminNavLinks';
import Select from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { adminListChangeRequests } from '../../data/changeRequestsApi';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  under_review: 'bg-brand-100 text-brand-700',
  waiting_for_organizer: 'bg-violet-50 text-violet-700',
  approved: 'bg-brand-100 text-brand-700',
  rejected: 'bg-rose-100 text-rose-600',
  completed: 'bg-ink-100 text-ink-600',
};

const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under review',
  waiting_for_organizer: 'Waiting for organizer',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

const REQUEST_TYPE_LABELS = {
  start_date: 'Start date change',
  end_date: 'End date change',
  both_dates: 'Date change',
  extend_registration: 'Extend registration',
  event_info: 'Event information',
  plan_upgrade: 'Plan upgrade',
  billing: 'Billing / payment',
  technical: 'Technical problem',
  other: 'Other',
};

const STATUS_FILTERS = ['', 'pending', 'under_review', 'waiting_for_organizer', 'approved', 'rejected', 'completed'];

// The admin's queue for every event_change_requests row — see "EVENT CHANGE
// REQUESTS" in schema.sql. A row here links to AdminRequestDetailPage.jsx,
// the dedicated page where an admin actually reviews/approves/rejects one.
export default function AdminSupportRequestsPage() {
  const { accountType } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = (forStatus) => {
    adminListChangeRequests(forStatus || null)
      .then((rows) => {
        setRequests(rows);
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(e.message);
        pushToast(e.message, 'error');
      });
  };

  useEffect(() => load(''), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clearing the list happens here, from the event that actually changed
  // the filter, rather than as a side effect derived from `status` — so
  // switching filters never shows a stale page's rows underneath "Loading…".
  const handleStatusChange = (next) => {
    setStatus(next);
    setRequests(null);
    load(next);
  };

  return (
    <OrganizerLayout backTo="/admin" backLabel="Dashboard">
      <div className="mb-4">
        <AccountTypeCard accountType={accountType} />
      </div>
      <AdminNavLinks />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Support requests</h1>
          <p className="text-sm text-ink-500">Date changes and other organizer requests — review, ask questions, approve or reject.</p>
        </div>
        <Select value={status} onChange={(e) => handleStatusChange(e.target.value)} className="rounded-xl border border-ink-200 px-3.5 py-2 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s ? (STATUS_LABELS[s] ?? s) : 'All statuses'}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <LifeBuoy size={17} strokeWidth={2.3} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Requests</h2>
            <p className="text-xs text-ink-500">Click a row to open it.</p>
          </div>
        </div>
        {requests === null && !loadError && <p className="text-sm text-ink-400">Loading…</p>}
        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>Couldn't load requests — {loadError}</span>
            <button onClick={() => load(status)} className="shrink-0 rounded-full border border-rose-200 px-3 py-1 text-xs font-bold hover:bg-rose-100">
              Retry
            </button>
          </div>
        )}
        {requests && requests.length === 0 && <p className="text-sm text-ink-400">No requests match this filter.</p>}
        {requests && requests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2.5 text-left">Request #</th>
                  <th className="px-4 py-2.5 text-left">Organizer</th>
                  <th className="px-4 py-2.5 text-left">Event</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Submitted</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/admin/support-requests/${r.id}`)}
                    className="cursor-pointer border-b border-ink-50 transition hover:bg-ink-50/60"
                  >
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.request_number}</td>
                    <td className="px-4 py-3 text-xs text-ink-600">{r.organizer_email}</td>
                    <td className="px-4 py-3 text-xs text-ink-600">{r.event_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-600">{REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[r.status]}`}>{STATUS_LABELS[r.status] ?? r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </OrganizerLayout>
  );
}
