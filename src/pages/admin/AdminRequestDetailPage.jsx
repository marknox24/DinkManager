import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, LifeBuoy, MessageCircleQuestion, Send, XCircle } from 'lucide-react';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import AccountTypeCard from '../../components/ui/AccountTypeCard';
import AdminNavLinks from '../../components/admin/AdminNavLinks';
import Modal from '../../components/ui/Modal';
import FormField, { textareaClass } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  addChangeRequestMessage,
  adminGetChangeRequest,
  adminReviewChangeRequest,
  listChangeRequestMessages,
} from '../../data/changeRequestsApi';

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
  start_date: 'Change Event Start Date',
  end_date: 'Change Event End Date',
  both_dates: 'Change Event Dates',
  extend_registration: 'Extend Registration',
  event_info: 'Change Event Information',
  plan_upgrade: 'Plan Upgrade',
  billing: 'Billing / Payment',
  technical: 'Technical Problem',
  other: 'Other',
};

const isDateType = (t) => t === 'start_date' || t === 'end_date' || t === 'both_dates';

function ApproveConfirmModal({ request, onClose, onConfirmed }) {
  const { pushToast } = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const willApplyDates = isDateType(request.request_type);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const updated = await adminReviewChangeRequest(request.id, 'approve', note.trim() || null);
      pushToast(willApplyDates ? 'Request approved — the event dates have been updated.' : `${request.request_number} approved`, 'success');
      onConfirmed(updated);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Approve request?" icon={Check}>
      <div className="flex flex-col gap-4">
        {willApplyDates ? (
          <div className="rounded-xl bg-ink-50 p-4 text-sm">
            <div className="font-bold text-ink-800">Current</div>
            <div className="text-ink-600">
              {request.current_start_date || '—'} – {request.current_end_date || '—'}
            </div>
            <div className="mt-2 font-bold text-ink-800">New</div>
            <div className="text-brand-700">
              {request.requested_start_date || request.current_start_date || '—'} – {request.requested_end_date || request.current_end_date || '—'}
            </div>
            <p className="mt-3 text-xs text-ink-500">This will update the official event dates immediately.</p>
          </div>
        ) : (
          <p className="text-sm text-ink-600">This marks {request.request_number} as approved. Phase 1 has no automatic action for this request type — you'll still need to follow up manually.</p>
        )}
        <FormField label="Note to organizer" hint="Optional">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
        </FormField>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Confirming…' : 'Confirm Approval'}
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({ request, onClose, onConfirmed }) {
  const { pushToast } = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      pushToast('A reason is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await adminReviewChangeRequest(request.id, 'reject', note.trim());
      pushToast(`${request.request_number} rejected`, 'success');
      onConfirmed(updated);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Reject request" icon={XCircle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Reason for rejection">
          <textarea required value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
        </FormField>
        <button type="submit" disabled={submitting} className="rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60">
          {submitting ? 'Rejecting…' : 'Reject Request'}
        </button>
      </form>
    </Modal>
  );
}

function RequestInfoModal({ request, onClose, onConfirmed }) {
  const { pushToast } = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      pushToast('A message is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await adminReviewChangeRequest(request.id, 'request_info', note.trim());
      pushToast('Message sent — status set to Waiting for Organizer', 'success');
      onConfirmed(updated);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Request more information" icon={MessageCircleQuestion}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Message to organizer">
          <textarea required value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} placeholder="Please provide confirmation from the venue before we can approve this request." />
        </FormField>
        <button type="submit" disabled={submitting} className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </form>
    </Modal>
  );
}

export default function AdminRequestDetailPage() {
  const { requestId } = useParams();
  const { accountType } = useAuth();
  const { pushToast } = useToast();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [modal, setModal] = useState(null); // 'approve' | 'reject' | 'info' | null

  const reload = () => {
    adminGetChangeRequest(requestId)
      .then((d) => {
        setData(d);
        return listChangeRequestMessages(requestId);
      })
      .then((msgs) => {
        setMessages(msgs);
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(e.message);
        pushToast(e.message, 'error');
      });
  };

  useEffect(reload, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSendingReply(true);
    try {
      await addChangeRequestMessage(requestId, reply.trim());
      setReply('');
      setMessages(await listChangeRequestMessages(requestId));
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleResolved = (updatedRequest) => {
    setModal(null);
    setData((prev) => (prev ? { ...prev, request: updatedRequest } : prev));
    reload();
  };

  if (!data) {
    return (
      <OrganizerLayout backTo="/admin/support-requests" backLabel="Support requests">
        {loadError ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-2xl bg-rose-50 p-6 text-center">
            <p className="text-sm text-rose-700">Couldn't load this request — {loadError}</p>
            <button onClick={reload} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
              Retry
            </button>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
        )}
      </OrganizerLayout>
    );
  }

  const r = data.request;
  const resolved = r.status === 'approved' || r.status === 'rejected' || r.status === 'completed';

  return (
    <OrganizerLayout backTo="/admin/support-requests" backLabel="Support requests">
      <div className="mb-4">
        <AccountTypeCard accountType={accountType} />
      </div>
      <AdminNavLinks />

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <LifeBuoy size={17} strokeWidth={2.3} />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold text-ink-900">
                Request #{r.request_number} — {REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}
              </h1>
              <p className="text-xs text-ink-500">
                Organizer: <strong className="font-semibold text-ink-700">{data.organizer_email}</strong>
                {data.event_name && (
                  <>
                    {' '}
                    · Event: <strong className="font-semibold text-ink-700">{data.event_name}</strong>
                  </>
                )}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[r.status]}`}>{STATUS_LABELS[r.status] ?? r.status}</span>
        </div>

        {isDateType(r.request_type) && (
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-4 text-sm">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Current</div>
              <div className="mt-0.5 font-semibold text-ink-800">
                {r.current_start_date || '—'} – {r.current_end_date || '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Requested</div>
              <div className="mt-0.5 font-semibold text-brand-700">
                {r.requested_start_date || '—'} – {r.requested_end_date || '—'}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Reason</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{r.reason}</p>
          {r.additional_info && (
            <>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Additional information</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{r.additional_info}</p>
            </>
          )}
          {r.admin_resolution_note && (
            <>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Resolution note</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{r.admin_resolution_note}</p>
            </>
          )}
        </div>

        <div className="border-t border-ink-100 pt-4">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Conversation</div>
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm ${m.sender_role === 'admin' ? 'self-start bg-ink-50 text-ink-800' : 'self-end bg-brand-600 text-white'}`}>
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">
                  {m.sender_role === 'admin' ? 'Admin' : 'Organizer'} · {new Date(m.created_at).toLocaleString()}
                </div>
                {m.message}
              </div>
            ))}
          </div>
          {!resolved && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to the organizer…"
                className="flex-1 rounded-full border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button
                onClick={sendReply}
                disabled={sendingReply || !reply.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition hover:bg-ink-800 disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>

        {!resolved && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            <button onClick={() => setModal('approve')} className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700">
              <Check size={13} /> Approve
            </button>
            <button onClick={() => setModal('reject')} className="flex items-center gap-1.5 rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50">
              <XCircle size={13} /> Reject
            </button>
            <button onClick={() => setModal('info')} className="flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50">
              <MessageCircleQuestion size={13} /> Request Information
            </button>
          </div>
        )}
      </div>

      {modal === 'approve' && <ApproveConfirmModal request={r} onClose={() => setModal(null)} onConfirmed={handleResolved} />}
      {modal === 'reject' && <RejectModal request={r} onClose={() => setModal(null)} onConfirmed={handleResolved} />}
      {modal === 'info' && <RequestInfoModal request={r} onClose={() => setModal(null)} onConfirmed={handleResolved} />}
    </OrganizerLayout>
  );
}
