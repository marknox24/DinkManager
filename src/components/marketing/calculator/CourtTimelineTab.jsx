import { formatClock } from '../../../utils/calculator/timeFormat.js';

const STAGE_LABEL = { group: 'Group', knockout: 'Knockout' };

function MatchCard({ item, placement, startAtMs }) {
  const isBye = item.isBye;
  return (
    <div
      className={`rounded-xl border p-2.5 text-xs ${
        isBye ? 'border-dashed border-ink-200 bg-ink-50/50 text-ink-400' : item.projected ? 'border-dashed border-ink-200 bg-white' : 'border-ink-100 bg-white shadow-sm'
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-ink-400">
        <span>{item.bracketName}</span>
        <span>{STAGE_LABEL[item.stage] || item.stage}</span>
      </div>
      {isBye ? (
        <div className="font-semibold text-ink-500">{item.teamALabel} — bye</div>
      ) : (
        <>
          <div className={`font-semibold ${item.projected ? 'italic text-ink-400' : 'text-ink-800'}`}>{item.teamALabel}</div>
          <div className={`font-semibold ${item.projected ? 'italic text-ink-400' : 'text-ink-800'}`}>{item.teamBLabel}</div>
        </>
      )}
      {!isBye && (
        <div className="mt-1.5 text-[11px] tabular-nums text-ink-400">
          {formatClock(placement.startMs, startAtMs)} – {formatClock(placement.endMs, startAtMs)}
        </div>
      )}
    </div>
  );
}

export default function CourtTimelineTab({ result, bracketFilter, courtFilter }) {
  const { items, schedule, summary } = result;
  const visible = items.filter((it) => (bracketFilter === 'all' || it.bracketId === bracketFilter) && !it.isBye);
  const courts = Array.from({ length: summary.courtCount }, (_, i) => i + 1).filter((c) => courtFilter === 'all' || String(c) === courtFilter);

  if (visible.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-400">No matches to show for this filter.</p>;
  }

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {courts.map((court) => {
        const courtItems = visible
          .filter((it) => schedule.placedByKey.get(it.key)?.court === court)
          .sort((a, b) => schedule.placedByKey.get(a.key).startMs - schedule.placedByKey.get(b.key).startMs);
        return (
          <div key={court} className="flex w-56 shrink-0 flex-col gap-2">
            <div className="rounded-xl bg-ink-900 px-3 py-2 text-center text-xs font-bold text-white">Court {court}</div>
            {courtItems.map((it) => (
              <MatchCard key={it.key} item={it} placement={schedule.placedByKey.get(it.key)} startAtMs={summary.startAtMs} />
            ))}
            {courtItems.length === 0 && <p className="px-1 text-center text-xs text-ink-300">No matches on this court.</p>}
          </div>
        );
      })}
    </div>
  );
}
