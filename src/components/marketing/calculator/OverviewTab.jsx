export default function OverviewTab({ result }) {
  const { brackets, schedule } = result;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Matches by category</h4>
        <div className="flex flex-col divide-y divide-ink-50 rounded-xl border border-ink-100">
          {brackets.map((b) => (
            <div key={b.bracketId} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-ink-800">{b.name}</span>
              <span className="tabular-nums text-ink-500">{b.shape?.totalMatches ?? b.items.filter((it) => !it.isBye).length} matches</span>
            </div>
          ))}
          {brackets.length === 0 && <div className="px-3.5 py-6 text-center text-sm text-ink-400">No categories yet.</div>}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Court utilization</h4>
        <p className="mb-2 text-[11px] text-ink-400">Busy playing time ÷ available court time (breaks excluded).</p>
        <div className="flex flex-col gap-2">
          {schedule.courtUtilization.map((c) => (
            <div key={c.court} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-bold text-ink-600">Court {c.court}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full ${c.utilizationPct < 50 ? 'bg-amber-400' : 'bg-brand-500'}`}
                  style={{ width: `${Math.min(100, c.utilizationPct)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-500">{c.utilizationPct}%</span>
            </div>
          ))}
          {schedule.courtUtilization.length === 0 && <p className="text-sm text-ink-400">No matches scheduled yet.</p>}
        </div>
      </div>
    </div>
  );
}
