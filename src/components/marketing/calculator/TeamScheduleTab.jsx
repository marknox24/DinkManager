import { useMemo, useState } from 'react';
import Select from '../../ui/Select';
import { inputClass } from '../../ui/FormField';
import { formatClock, minutesBetween } from '../../../utils/calculator/timeFormat.js';

export default function TeamScheduleTab({ result }) {
  const { brackets, items, schedule, summary } = result;
  const [bracketId, setBracketId] = useState(brackets[0]?.bracketId || '');

  const teamOptions = useMemo(() => {
    const labels = new Map();
    items
      .filter((it) => it.bracketId === bracketId)
      .forEach((it) => {
        if (it.teamAId) labels.set(it.teamAId, it.teamALabel);
        if (it.teamBId) labels.set(it.teamBId, it.teamBLabel);
      });
    return [...labels.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items, bracketId]);

  const [teamId, setTeamId] = useState('');
  const activeTeamId = teamOptions.some(([id]) => id === teamId) ? teamId : teamOptions[0]?.[0] || '';

  const teamMatches = items
    .filter((it) => !it.isBye && (it.teamAId === activeTeamId || it.teamBId === activeTeamId))
    .map((it) => ({ item: it, placement: schedule.placedByKey.get(it.key) }))
    .sort((a, b) => a.placement.startMs - b.placement.startMs);

  if (brackets.length === 0) return <p className="py-10 text-center text-sm text-ink-400">Add a category to see a team's schedule.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={bracketId}
          onChange={(e) => {
            setBracketId(e.target.value);
            setTeamId('');
          }}
          className={`${inputClass} w-auto`}
        >
          {brackets.map((b) => (
            <option key={b.bracketId} value={b.bracketId}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select value={activeTeamId} onChange={(e) => setTeamId(e.target.value)} className={`${inputClass} w-auto`}>
          {teamOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {teamMatches.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No matches yet for this team.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {teamMatches.map(({ item, placement }, i) => {
            const prevEnd = i > 0 ? teamMatches[i - 1].placement.endMs : null;
            const restMinutes = prevEnd != null ? minutesBetween(prevEnd, placement.startMs) : null;
            return (
              <div key={item.key}>
                {restMinutes != null && (
                  <div className="py-1 text-center text-[11px] text-ink-400">{restMinutes} min rest before next match</div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-3.5 py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-ink-800">
                      {item.bracketName} · {item.matchLabel}
                    </div>
                    <div className="text-xs text-ink-500">
                      vs {item.teamAId === activeTeamId ? item.teamBLabel : item.teamALabel}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums text-ink-500">
                    <div className="font-bold text-ink-700">Court {placement.court}</div>
                    <div>{formatClock(placement.startMs, summary.startAtMs)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
