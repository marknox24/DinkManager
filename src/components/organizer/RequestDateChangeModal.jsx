import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass, textareaClass } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { submitEventChangeRequest } from '../../data/changeRequestsApi';

const CONCERNS = [
  { value: 'start_date', label: 'Event start date' },
  { value: 'end_date', label: 'Event end date' },
  { value: 'both_dates', label: 'Both start and end dates' },
];

// The organizer's way to ask for a locked event's dates to move — see
// "EVENT CHANGE REQUESTS" in schema.sql. Every field here maps straight
// onto submit_event_change_request()'s params; the admin reviews it from
// AdminRequestDetailPage.jsx and, on approval, the event's real dates
// change automatically (no separate "apply" step for the organizer to wait
// through beyond the admin's decision).
export default function RequestDateChangeModal({ event, onClose, onSubmitted }) {
  const { pushToast } = useToast();
  const [concern, setConcern] = useState('both_dates');
  const [requestedStart, setRequestedStart] = useState(event.start_date || '');
  const [requestedEnd, setRequestedEnd] = useState(event.end_date || '');
  const [reason, setReason] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsStart = concern === 'start_date' || concern === 'both_dates';
  const needsEnd = concern === 'end_date' || concern === 'both_dates';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      pushToast('A reason is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const request = await submitEventChangeRequest(event.id, {
        requestType: concern,
        requestedStartDate: needsStart ? requestedStart : null,
        requestedEndDate: needsEnd ? requestedEnd : null,
        reason: reason.trim(),
        additionalInfo: additionalInfo.trim() || null,
      });
      pushToast(`Request ${request.request_number} submitted`, 'success');
      onSubmitted?.(request);
    } catch (err) {
      pushToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Request a Change" icon={CalendarClock}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="What would you like to change?">
          <div className="flex flex-col gap-2 rounded-xl bg-ink-50/60 px-3.5 py-3">
            {CONCERNS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm text-ink-800">
                <input type="radio" checked={concern === c.value} onChange={() => setConcern(c.value)} /> {c.label}
              </label>
            ))}
          </div>
        </FormField>

        {needsStart && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Current start date">
              <div className={`${inputClass} cursor-not-allowed bg-ink-50 text-ink-500`}>{event.start_date || '—'}</div>
            </FormField>
            <FormField label="Requested start date">
              <input type="date" required value={requestedStart} onChange={(e) => setRequestedStart(e.target.value)} className={inputClass} />
            </FormField>
          </div>
        )}
        {needsEnd && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Current end date">
              <div className={`${inputClass} cursor-not-allowed bg-ink-50 text-ink-500`}>{event.end_date || '—'}</div>
            </FormField>
            <FormField label="Requested end date">
              <input type="date" required value={requestedEnd} onChange={(e) => setRequestedEnd(e.target.value)} className={inputClass} />
            </FormField>
          </div>
        )}

        <FormField label="Reason for request">
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="e.g. Venue is not available on the original date." />
        </FormField>
        <FormField label="Additional information" hint="Optional">
          <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} className={textareaClass} />
        </FormField>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </Modal>
  );
}
