const STATUS_STYLES = {
  upcoming: 'bg-brand-50 text-brand-700',
  ongoing: 'bg-amber-100 text-amber-800',
  finished: 'bg-ink-100 text-ink-500',
  cancelled: 'bg-rose-50 text-rose-600',
  rescheduled: 'bg-violet-50 text-violet-700',
};

const STATUS_LABELS = {
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  finished: 'Finished',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[status] || STATUS_STYLES.upcoming}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
