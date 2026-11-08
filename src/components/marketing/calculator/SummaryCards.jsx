import { CalendarClock, CheckCircle2, Clock3, Trophy, Users, XCircle } from 'lucide-react';
import { formatClock, formatDurationMinutes, minutesBetween } from '../../../utils/calculator/timeFormat.js';

function Card({ icon: Icon, label, value, sub, highlight }) {
  return (
    <div className={`hover-lift rounded-2xl border p-4 ${highlight ? 'border-brand-200 bg-brand-50/60' : 'border-ink-100 bg-white'}`}>
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${highlight ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}>
        <Icon size={15} />
      </div>
      <div className="font-display tabular-nums text-xl font-bold text-ink-950">{value}</div>
      <div className="text-xs font-semibold text-ink-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-400">{sub}</div>}
    </div>
  );
}

// Trimmed to the numbers an organizer actually scans for first. "Courts"
// was dropped — it's a dial they just set two inches above this, so
// repeating it here is noise, not information.
export default function SummaryCards({ summary }) {
  const { totalTeams, totalMatches, startAtMs, finishMs, projectedFinishRange, feasible, targetFinishMs } = summary;
  const durationMinutes = minutesBetween(startAtMs, finishMs);
  const [rangeLo, rangeHi] = projectedFinishRange;
  const finishLabel =
    rangeHi > rangeLo ? `${formatClock(rangeLo, startAtMs)} – ${formatClock(rangeHi, startAtMs)}` : formatClock(finishMs, startAtMs);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card icon={Users} label="Teams / pairs" value={totalTeams} />
      <Card icon={Trophy} label="Total matches" value={totalMatches} />
      <Card
        icon={CalendarClock}
        label="Projected finish"
        value={finishLabel}
        sub={rangeHi > rangeLo ? `${formatDurationMinutes(durationMinutes)} of play` : 'capacity estimate'}
        highlight
      />
      {targetFinishMs != null ? (
        <Card
          icon={feasible ? CheckCircle2 : XCircle}
          label="Vs. target finish"
          value={feasible ? 'On track' : 'Over target'}
          sub={`Target: ${formatClock(targetFinishMs, startAtMs)}`}
        />
      ) : (
        <Card icon={Clock3} label="Estimated duration" value={formatDurationMinutes(durationMinutes)} />
      )}
    </div>
  );
}
