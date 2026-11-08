import { formatClock } from '../../../utils/calculator/timeFormat.js';

export default function MatchListTab({ result, bracketFilter, courtFilter }) {
  const { items, schedule, summary } = result;
  const rows = items
    .filter((it) => !it.isBye)
    .filter((it) => bracketFilter === 'all' || it.bracketId === bracketFilter)
    .filter((it) => courtFilter === 'all' || String(schedule.placedByKey.get(it.key)?.court) === courtFilter)
    .map((it) => ({ item: it, placement: schedule.placedByKey.get(it.key) }))
    .sort((a, b) => a.placement.startMs - b.placement.startMs);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-400">No matches to show for this filter.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
            <th className="px-3 py-2">Start</th>
            <th className="px-3 py-2">Court</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Round</th>
            <th className="px-3 py-2">Matchup</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {rows.map(({ item, placement }) => (
            <tr key={item.key}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-700">{formatClock(placement.startMs, summary.startAtMs)}</td>
              <td className="px-3 py-2 text-ink-500">{placement.court ?? '—'}</td>
              <td className="px-3 py-2 font-semibold text-ink-800">{item.bracketName}</td>
              <td className="px-3 py-2 text-ink-500">{item.matchLabel}</td>
              <td className={`px-3 py-2 ${item.projected ? 'italic text-ink-400' : 'text-ink-700'}`}>
                {item.teamALabel} <span className="text-ink-300">vs</span> {item.teamBLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
