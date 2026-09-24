import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ListChecks, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import { listMatchesForCategory, planMatchListForCategory } from '../../data/bracketsApi';
import { MATCH_STATUS, expectedRoundRobin, matchCounts, progressLabel } from '../../utils/scheduling';
import { teamLabel } from '../../utils/match';

// One view of a category's matchlist, in two modes picked automatically:
//   - Plan (no matches generated yet): exactly what "Generate" will create —
//     planMatchListForCategory is the same function the generators insert
//     from — every match upcoming (○). Opened from Match List's Generate,
//     or from the Brackets page.
//   - Progress (a matchlist exists): the real matches round by round with
//     their status from the database — ✓ completed (with score), ▶ live,
//     ○ upcoming, ✕ cancelled — and each player/pair's progress.
// Either way, per bracket: team count, target games per team, total
// matches, and a Player/Pair table showing "completed/total" (see
// progressLabel/matchCounts: only status 'completed' counts as completed,
// canceled matches don't count at all). A doubles pair is one row —
// partners are never counted separately. A custom games-per-team bracket
// shows Target vs Generated, with a notice when teams × target is odd.
export default function MatchlistPreviewModal({ category, generating, onGenerate, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([planMatchListForCategory(category.id), listMatchesForCategory(category.id)])
      .then(([plan, matches]) => {
        if (cancelled) return;
        const poolIds = new Set(plan.brackets.map((b) => b.id));
        const actual = matches.filter((m) => poolIds.has(m.bracket_id));
        setData({ plan, matches: actual.length > 0 ? actual : null });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [category.id]);

  const isProgress = Boolean(data?.matches);
  const plan = data?.plan;
  const isRR = plan?.kind === 'round_robin';

  const view = useMemo(() => {
    if (!data) return null;
    const { plan: p } = data;
    // Plan rows are all upcoming; real matches carry their own status.
    const allRows = data.matches ?? p.rows.map((r) => ({ ...r, id: r.match_code }));
    const teamById = new Map(p.teams.map((t) => [t.id, t]));
    const { byTeam } = matchCounts(allRows);
    const sections = p.brackets.map((b) => {
      const teams = p.teams.filter((t) => t.bracket_id === b.id);
      const rows = allRows.filter((r) => r.bracket_id === b.id);
      const roundNumbers = [...new Set(rows.map((r) => r.round_number ?? null))].sort((x, y) => (x ?? Infinity) - (y ?? Infinity));
      const rounds = roundNumbers.map((n) => {
        const matches = rows.filter((r) => (r.round_number ?? null) === n);
        const playing = new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]));
        return { number: n, matches, byes: data.matches ? [] : teams.filter((t) => !playing.has(t.id)) };
      });
      const games = p.gamesByBracket?.[b.id] ?? null;
      const counts = teams.map((t) => byTeam.get(t.id)?.total ?? 0);
      const live = rows.filter((r) => r.status !== 'canceled');
      return {
        bracket: b,
        teams,
        rounds,
        games,
        total: live.length,
        completed: live.filter((r) => r.status === 'completed').length,
        target: p.kind === 'round_robin' ? (games ?? expectedRoundRobin(teams.length, p.isDouble).perTeam) : null,
        generatedMin: counts.length ? Math.min(...counts) : 0,
        generatedMax: counts.length ? Math.max(...counts) : 0,
        seBye: p.byes.find((x) => x.bracket.id === b.id)?.team,
      };
    });
    const total = sections.reduce((s, x) => s + x.total, 0);
    const completed = sections.reduce((s, x) => s + x.completed, 0);
    return { sections, teamById, byTeam, total, completed, teamCount: p.teams.length };
  }, [data]);

  return (
    <Modal open onClose={onClose} title="Matchlist Preview" icon={ListChecks} maxWidth="max-w-3xl">
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : !view ? (
        <p className="py-10 text-center text-sm text-ink-400">Building the preview…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-ink-50/70 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-wide text-ink-900">{category.name}</p>
                <p className="text-xs text-ink-500">
                  {view.teamCount} {view.teamCount === 1 ? 'team' : 'teams'} · {view.total} total {view.total === 1 ? 'match' : 'matches'}
                  {isRR ? (plan.isDouble ? ' · Double Round Robin' : ' · Round Robin') : ' · Single Elimination, Round 1'}
                </p>
              </div>
              {isProgress ? (
                <p className="text-xs text-ink-600">
                  Completed: <strong className="font-bold text-ink-900">{view.completed}/{view.total}</strong> · Remaining:{' '}
                  <strong className="font-bold text-ink-900">{view.total - view.completed}</strong>
                </p>
              ) : (
                <p className="text-xs font-semibold text-ink-500">Not generated yet — nothing is saved until you generate.</p>
              )}
            </div>
            {isProgress && (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-ink-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${view.total ? (100 * view.completed) / view.total : 0}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-ink-500">
                  {view.completed}/{view.total} matches completed
                </p>
              </>
            )}
            <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-ink-500">
              {Object.entries(MATCH_STATUS).map(([key, s]) => (
                <span key={key}>
                  <span className="font-bold">{s.icon}</span> {s.label}
                </span>
              ))}
            </p>
          </div>

          {view.sections.map(({ bracket, teams, rounds, games, total, completed, target, generatedMin, generatedMax, seBye }) => (
            <section key={bracket.id} className="rounded-2xl border border-ink-100">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-4 py-3">
                <h4 className="font-display text-sm font-bold text-ink-900">Bracket {bracket.letter}</h4>
                <p className="text-xs font-semibold text-ink-500">
                  {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                  {target != null && ` · Target: ${target} games/team`}
                  {` · ${total} total ${total === 1 ? 'match' : 'matches'}`}
                  {isProgress
                    ? ` · ${completed}/${total} completed`
                    : games != null && ` · Generated: ${generatedMin === generatedMax ? generatedMin : `${generatedMin}–${generatedMax}`} games/team`}
                </p>
              </div>

              {!isProgress && games != null && generatedMax > generatedMin && (
                <p className="mx-4 mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Because this bracket has an odd number of teams and a target of {games} games/team, exactly {games} games for every team is
                    mathematically impossible. The system generated the most balanced schedule possible.
                  </span>
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_220px]">
                <div className="flex min-w-0 flex-col gap-3">
                  {rounds.length === 0 && <p className="text-xs text-ink-400">Not enough teams in this bracket for a match.</p>}
                  {rounds.map((round) => (
                    <div key={round.number ?? 'other'}>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                        {round.number != null ? `Round ${round.number}` : 'Other matches'}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {round.matches.map((m) => (
                          <MatchRow key={m.id} match={m} teamById={view.teamById} />
                        ))}
                        {isRR &&
                          round.byes.map((t) => (
                            <li key={t.id} className="px-2.5 text-[11px] text-ink-400">
                              Bye: {teamLabel(t)}
                            </li>
                          ))}
                        {!isRR && !isProgress && seBye && <li className="px-2.5 text-[11px] text-ink-400">Bye: {teamLabel(seBye)}</li>}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="min-w-0">
                  <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wide text-ink-400">
                    <span>{teams.some((t) => t.player2_name) ? 'Pair / Team' : 'Player'}</span>
                    <span>Matches</span>
                  </div>
                  <ul className="flex flex-col divide-y divide-ink-50 rounded-lg ring-1 ring-ink-100">
                    {teams.map((team) => {
                      const counts = view.byTeam.get(team.id) ?? { total: 0, completed: 0, remaining: 0 };
                      const p = progressLabel(counts);
                      const aboveTarget = !isProgress && games != null && counts.total > games;
                      return (
                        <li
                          key={team.id}
                          title={p.detail}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs ${aboveTarget ? 'bg-amber-50' : ''}`}
                        >
                          <span className="min-w-0 truncate text-ink-700">{teamLabel(team)}</span>
                          <span className="shrink-0 text-right">
                            <span className={`block font-mono font-bold ${aboveTarget ? 'text-amber-700' : 'text-ink-900'}`}>{p.short}</span>
                            <span className={`block text-[10px] ${p.done ? 'font-semibold text-emerald-600' : 'text-ink-400'}`}>{p.secondary}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </section>
          ))}

          <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-white/95 px-6 py-4 backdrop-blur">
            {onGenerate ? (
              <Link
                to={`/events/${category.event_id}/brackets`}
                className="mr-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100"
              >
                <ArrowLeft size={14} /> Back to Bracket Setup
              </Link>
            ) : (
              <Link
                to={`/events/${category.event_id}/matchlist`}
                className="mr-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-brand-600 transition hover:bg-brand-50"
              >
                Open Match List →
              </Link>
            )}
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-100">
              {onGenerate && !isProgress ? 'Cancel' : 'Close'}
            </button>
            {onGenerate && !isProgress && (
              <button
                onClick={onGenerate}
                disabled={generating || plan.rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
              >
                <Sparkles size={14} /> {generating ? 'Generating…' : isRR ? 'Generate Match List' : 'Generate Round 1'}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// One match line: status icon, code, the two teams — with the score and
// winner (✓, bold) once completed, a Live chip while in progress, and struck
// through when cancelled.
function MatchRow({ match, teamById }) {
  const status = MATCH_STATUS[match.status] ?? MATCH_STATUS.scheduled;
  const teamA = teamById.get(match.team_a_id) ?? match.team_a;
  const teamB = teamById.get(match.team_b_id) ?? match.team_b;
  const done = match.status === 'completed';
  const canceled = match.status === 'canceled';
  const aWon = done && match.winner_team_id === match.team_a_id;
  const bWon = done && match.winner_team_id === match.team_b_id;
  const side = (team, won, score, align) => (
    <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'left' && done && <span className="w-5 shrink-0 font-mono font-bold tabular-nums text-ink-900">{score ?? '–'}</span>}
      <span className={`min-w-0 break-words md:truncate ${won ? 'font-bold text-ink-900' : 'font-semibold text-ink-700'}`}>{teamLabel(team)}</span>
      {align === 'right' && done && <span className="w-5 shrink-0 font-mono font-bold tabular-nums text-ink-900">{score ?? '–'}</span>}
    </span>
  );
  return (
    <li
      title={status.label}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${canceled ? 'bg-ink-50/40 text-ink-400 line-through' : done ? 'bg-emerald-50/60' : 'bg-ink-50/60'}`}
    >
      <span
        className={`w-4 shrink-0 text-center font-bold ${done ? 'text-emerald-600' : match.status === 'in_progress' ? 'text-rose-600' : canceled ? 'text-ink-400' : 'text-ink-300'}`}
        aria-label={status.label}
      >
        {status.icon}
      </span>
      <span className="w-8 shrink-0 font-mono font-bold text-ink-400">{match.match_code}</span>
      {side(teamA, aWon, match.score_a, 'right')}
      <span className="shrink-0 text-ink-400">vs</span>
      {side(teamB, bWon, match.score_b, 'left')}
      {match.status === 'in_progress' && (
        <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 no-underline">
          Live{match.court ? ` · Court ${match.court}` : ''}
        </span>
      )}
    </li>
  );
}
