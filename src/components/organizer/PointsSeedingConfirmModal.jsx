import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Coins, Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { getPointsSeeding } from '../../data/playoffApi';
import { POINTS_METRICS, formatPointsValue } from '../../utils/playoffLadder';
import { teamLabel } from '../../utils/match';

// Shown right before generating a points-seeded semifinal (the counterpart
// to PlayoffCrossoverConfirmModal). Lists the four qualifiers ranked by
// point differential and the matchups that produces. Teams level on the
// metric are flagged, and only they can be moved, so the organizer settles a
// tie (coin toss) without being able to override the differential itself.
export default function PointsSeedingConfirmModal({ level, categoryId, onConfirm, onClose }) {
  const { pushToast } = useToast();
  const [seeding, setSeeding] = useState(null); // { metric, pairing, ranked }
  const [order, setOrder] = useState([]); // [{ team, group }], best first
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPointsSeeding(categoryId)
      .then((result) => {
        if (cancelled) return;
        setSeeding(result);
        setOrder(result.ranked);
      })
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const tiedGroups = new Set(order.filter((r, i) => order.some((o, j) => j !== i && o.group === r.group)).map((r) => r.group));

  const move = (index, delta) => {
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(order.map((r) => r.team.id));
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const seedName = (n) => teamLabel(order[n - 1]?.team);

  return (
    <Modal open onClose={onClose} title={`Generate ${level.label}`} icon={Trophy} maxWidth="max-w-lg">
      {loadError ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">{loadError}</p>
      ) : !seeding ? (
        <p className="mb-4 text-sm text-ink-400">Loading the standings…</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-600">
            Semifinalists ranked by <span className="font-semibold text-ink-900">{POINTS_METRICS[seeding.metric].label.toLowerCase()}</span> from round
            robin. Wins and losses don't count here.
          </p>

          {tiedGroups.size > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              <Coins size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Tied teams.</span> Settle it with a coin toss, then use the arrows to put the winner of the toss higher.
              </span>
            </div>
          )}

          <ol className="mb-4 flex flex-col gap-1.5">
            {order.map((r, i) => {
              const tied = tiedGroups.has(r.group);
              const canUp = i > 0 && order[i - 1].group === r.group;
              const canDown = i < order.length - 1 && order[i + 1].group === r.group;
              return (
                <li
                  key={r.team.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${tied ? 'border-amber-200 bg-amber-50/50' : 'border-ink-100 bg-white'}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{teamLabel(r.team)}</span>
                    <span className="block text-[11px] text-ink-500">
                      Pool {r.team.pool_letter} · {r.team.wins}–{r.team.losses}
                      {tied && <span className="ml-1.5 font-bold text-amber-700">Tied</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ink-800">{formatPointsValue(r.team, seeding.metric)}</span>
                  {tied && (
                    <span className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={!canUp}
                        aria-label={`Move ${teamLabel(r.team)} up`}
                        className="rounded p-0.5 text-ink-500 transition hover:bg-amber-100 disabled:opacity-25"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={!canDown}
                        aria-label={`Move ${teamLabel(r.team)} down`}
                        className="rounded p-0.5 text-ink-500 transition hover:bg-amber-100 disabled:opacity-25"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mb-4 flex flex-col gap-1.5">
            {seeding.pairing.matches.map(([a, b], i) => (
              <div key={i} className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                <span className="font-bold text-ink-800">SF{i + 1}</span> · Seed {a} {seedName(a)} <span className="text-ink-400">vs</span> Seed {b} {seedName(b)}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting || !seeding}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Generating…' : `Generate ${level.label}`}
        </button>
      </div>
    </Modal>
  );
}
