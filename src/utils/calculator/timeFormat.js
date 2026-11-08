// Date/time math for the Tournament Time Calculator — all plain millisecond
// timestamps in, plain timestamps or display strings out. No Date-object
// state threaded through the engine, so every function here is trivially
// pure and testable.
const MIN = 60000;

// Combines a 'YYYY-MM-DD' date (defaults to today, local time) with an
// 'HH:mm' clock time into a local-time millisecond timestamp.
export function combineDateAndTime(dateStr, timeStr) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date(new Date().toDateString());
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  base.setHours(hh || 0, mm || 0, 0, 0);
  return base.getTime();
}

export function addMinutes(ms, minutes) {
  return ms + minutes * MIN;
}

export function minutesBetween(startMs, endMs) {
  return Math.round((endMs - startMs) / MIN);
}

// 'h:mm AM/PM' (no leading zero on the hour), with a '(+1 day)' /
// '(+2 days)' suffix once the timestamp has rolled past the tournament's
// start day — so a schedule that runs past midnight stays unambiguous
// instead of silently wrapping back to an earlier-looking clock time.
export function formatClock(ms, anchorDayStartMs) {
  const d = new Date(ms);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const clock = `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
  if (anchorDayStartMs == null) return clock;
  const anchorDay = new Date(anchorDayStartMs);
  anchorDay.setHours(0, 0, 0, 0);
  const thisDay = new Date(ms);
  thisDay.setHours(0, 0, 0, 0);
  const dayOffset = Math.round((thisDay.getTime() - anchorDay.getTime()) / (24 * 60 * MIN));
  if (dayOffset <= 0) return clock;
  return `${clock} (+${dayOffset} day${dayOffset === 1 ? '' : 's'})`;
}

// 'Xh Ym' / 'Ym' duration label for a minute count (e.g. total tournament
// length, or a team's rest gap).
export function formatDurationMinutes(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}
