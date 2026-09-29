// Mirrors src/components/organizer/StatusBadge.jsx's pattern, but for a
// registration's own status (registrations.status check constraint) rather
// than an event's lifecycle status — the two are visually similar but
// semantically different, so they stay separate components.
const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-700',
  denied: 'bg-rose-100 text-rose-600',
  waitlisted: 'bg-violet-100 text-violet-700',
};

export const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Confirmed',
  denied: 'Rejected',
  waitlisted: 'Waitlisted',
};

export default function RegistrationStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[status] || 'bg-ink-100 text-ink-500'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
