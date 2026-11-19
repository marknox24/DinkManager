import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Coins, Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { getSemifinalCandidates } from '../../data/playoffApi';
import { POINTS_METRICS, SEMIFINAL_PAIRINGS, formatPointsValue, hasPointsTie, rankByPoints } from '../../utils/playoffLadder';
import { teamLabel } from '../../utils/match';
import { SemifinalPointsFields, SemifinalSeedingCards } from './SemifinalSetupFields';

// Shown every time the semifinals are generated, so the setup can't be
// forgotten by whoever happens to be running the event. It opens on what was
// saved for the category (Event Details > Categories > Playoffs), so a setup
// done ahead of time is one click to confirm, and it can still be changed here.
// With the points system, the four semifinalists are listed by point
// differential; teams level on it are flagged and only they can be moved, and
// Generate stays off until the organizer confirms the coin toss, so ties are
// settled by the organizer and never by the app. `onConfirm` closes the popup
// itself once the semifinals are generated and resolves false when they
// weren't, so the popup stays open with the organizer's choices intact.
export default function SemifinalSetupModal({ level, category, opensKnockout, onConfirm, onClose }) {
  const { pushToast } = useToast();
  const [seeding, setSeeding] = useState(category.playoff_semifinal_seeding === 'points' ? 'points' : 'crossover');
  const [pairing, setPairing] = useState(Object.hasOwn(SEMIFINAL_PAIRINGS, category.playoff_semifinal_pairing ?? '') ? category.playoff_semifinal_pairing : '1v4');
  const [metric, setMetric] = useState(category.playoff_points_metric === 'average' ? 'average' : 'total');
  const [candidates, setCandidates] = useState(null); // the four teams, unranked
  const [loadError, setLoadError] = useState(null);
  const [tieOrder, setTieOrder] = useState([]); // team ids; breaks ties between equal teams
  const [tieSettled, setTieSettled] = useState(false); // the organizer confirmed the coin toss
  const [submitting, setSubmitting] = useState(false);

  const poolCount = category.playoff_pool_count;
  const pointsChosen = seeding === 'points';
  const needsCrossoverStep = !pointsChosen && opensKnockout && poolCount !== 1;

  useEffect(() => {
    if (!pointsChosen || candidates || loadError) return undefined;
    let cancelled = false;
    getSemifinalCandidates(category.id)
      .then((result) => {
        if (!cancelled) setCandidates(result);
      })
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [pointsChosen, candidates, loadError, category.id]);

  // Re-ranked whenever the metric changes; the organizer's tie order carries
  // over, so an order picked for one metric still decides any tie in another.
  const ranked = useMemo(() => {
    if (!candidates) return [];
    const rank = new Map(tieOrder.map((id, i) => [id, i]));
    const ordered = [...candidates].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
    return rankByPoints(ordered, metric);
  }, [candidates, metric, tieOrder]);

  const tiedGroups = new Set(ranked.filter((r, i) => ranked.some((o, j) => j !== i && o.group === r.group)).map((r) => r.group));

  const move = (index, delta) => {
    const ids = ranked.map((r) => r.team.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    setTieOrder(ids);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const generated = await onConfirm({
        settings: { seeding, pairing, metric },
        seedOrder: pointsChosen ? ranked.map((r) => r.team.id) : null,
      });
      // Refused (often because a score changed meanwhile): reload the
      // standings so the next try uses fresh ones. A tie may have changed,
      // so the coin toss is confirmed again.
      if (generated === false && pointsChosen) {
        setCandidates(null);
        setLoadError(null);
        setTieSettled(false);
      }
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // A different metric can create or dissolve a tie, so the toss is confirmed again.
  const changeMetric = (value) => {
    setMetric(value);
    setTieSettled(false);
  };

  const seedName = (n) => teamLabel(ranked[n - 1]?.team);
  const pairingMatches = SEMIFINAL_PAIRINGS[pairing].matches;
  const tieOpen = pointsChosen && hasPointsTie(ranked) && !tieSettled;
  const canConfirm = !submitting && (!pointsChosen || (candidates && !loadError)) && !tieOpen;

  return (
    <Modal open onClose={onClose} title={`Generate ${level.label}`} icon={Trophy} maxWidth="max-w-lg">
      <p className="mb-3 text-sm text-ink-600">
        Check how the semifinals are matched before they're created. This is what was set up for <span className="font-semibold text-ink-900">{category.name}</span>;
        change it here if needed.
      </p>

      <div className="mb-4">
        <SemifinalSeedingCards poolCount={poolCount} opensKnockout={opensKnockout} value={seeding} onChange={setSeeding} />
      </div>

      {!pointsChosen ? (
        <p className="mb-4 rounded-xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-600">
          {!opensKnockout
            ? 'Winners of the earlier round meet in bracket order: SF1 is the winners of the first two matches, SF2 the next two.'
            : poolCount === 1
              ? 'Seeded by the pool standings: 1st plays 4th, 2nd plays 3rd.'
              : "Pools meet as paired. You'll confirm the pairing in the next step."}
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <SemifinalPointsFields pairing={pairing} onPairingChange={setPairing} metric={metric} onMetricChange={changeMetric} />
          </div>

          {loadError ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">{loadError}</p>
          ) : !candidates ? (
            <p className="mb-4 text-sm text-ink-400">Loading the standings…</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-500">
                {opensKnockout ? 'The four qualifiers' : 'The four teams that won through'} are ranked by{' '}
                <span className="font-semibold text-ink-700">{POINTS_METRICS[metric].label.toLowerCase()}</span> from round robin. Wins and losses don't count.
              </p>

              {hasPointsTie(ranked) && (
                <div className="mb-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <div className="flex items-start gap-2">
                    <Coins size={14} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">Tied teams.</span> Settle it with a coin toss, then use the arrows to put the winner of the toss higher.
                    </span>
                  </div>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 pl-[22px] font-semibold">
                    <input
                      type="checkbox"
                      checked={tieSettled}
                      onChange={(e) => setTieSettled(e.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border-amber-300 accent-brand-600"
                    />
                    Coin toss done. The order below is the result.
                  </label>
                </div>
              )}

              <ol className="mb-3 flex flex-col gap-1.5">
                {ranked.map((r, i) => {
                  const tied = tiedGroups.has(r.group);
                  const canUp = i > 0 && ranked[i - 1].group === r.group;
                  const canDown = i < ranked.length - 1 && ranked[i + 1].group === r.group;
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
                          {r.team.dead && <span className="ml-1.5 font-bold text-rose-600">Forfeited · opponent gets a walkover</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-ink-800">{formatPointsValue(r.team, metric)}</span>
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
                {pairingMatches.map(([a, b], i) => (
                  <div key={i} className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    <span className="font-bold text-ink-800">SF{i + 1}</span> · Seed {a} {seedName(a)} <span className="text-ink-400">vs</span> Seed {b} {seedName(b)}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Generating…' : needsCrossoverStep ? 'Next' : `Generate ${level.label}`}
        </button>
      </div>
    </Modal>
  );
}
