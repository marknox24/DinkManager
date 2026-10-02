export function formatElapsed(totalSeconds) {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(mins) {
  mins = Math.max(0, Math.round(mins));
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDateRange(start, end, fallback = 'Dates TBD') {
  if (!start && !end) return fallback;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

export function formatRelativeTime(dateString) {
  const diffMs = new Date(dateString).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(diffSec / secs), unit);
    }
  }
  return 'just now';
}

// Local-date key ("2026-10-02"), NOT toISOString().slice(0, 10): that is the
// UTC date, which lands on the wrong day for anyone registering late in the
// evening ahead of (or early morning behind) UTC. Callers bucket timestamps
// with this same helper so the picker and the filter always agree.
export function toLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
