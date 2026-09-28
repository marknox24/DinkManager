import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass, textareaClass } from '../ui/FormField';
import Select from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { submitEventChangeRequest } from '../../data/changeRequestsApi';

// The general "I need help with something that isn't a date change" entry
// point (see "EVENT CHANGE REQUESTS" in schema.sql) — same request table
// and admin review queue as RequestDateChangeModal, just without the
// current/requested date fields for topics that aren't about dates.
const TOPICS = [
  { value: 'start_date', label: 'Change Event Start Date' },
  { value: 'end_date', label: 'Change Event End Date' },
  { value: 'extend_registration', label: 'Extend Registration' },
  { value: 'event_info', label: 'Change Event Information' },
  { value: 'plan_upgrade', label: 'Plan Upgrade' },
  { value: 'billing', label: 'Billing / Payment' },
  { value: 'technical', label: 'Technical Problem' },
  { value: 'other', label: 'Other' },
];

export default function ContactAdminModal({ event, onClose, onSubmitted }) {
  const { pushToast } = useToast();
  const [topic, setTopic] = useState(TOPICS[0].value);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      pushToast('Please describe what you need', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const request = await submitEventChangeRequest(event?.id ?? null, {
        requestType: topic,
        reason: message.trim(),
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
    <Modal open onClose={onClose} title="Contact Admin" icon={MessageCircleQuestion}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="What's this about?">
          <Select value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass}>
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Message">
          <textarea required value={message} onChange={(e) => setMessage(e.target.value)} className={textareaClass} placeholder="Tell us what you need help with." />
        </FormField>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send to Admin'}
        </button>
      </form>
    </Modal>
  );
}
