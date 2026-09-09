import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Crown, Radio, Timer, Trophy } from 'lucide-react';
import { getEventById, listCategories } from '../../../data/eventsApi';
import {
  getBracketProgressForCategory,
  listBracketsForCategory,
  listLiveMatchesForEvent,
  listMatchesForCategory,
  listTeamsForCategory,
} from '../../../data/bracketsApi';
import AutoCarousel from '../../../components/organizer/AutoCarousel';
import { formatDuration } from '../../../utils/format';
import { teamLabel } from '../../../utils/match';

const REFRESH_MS = 6000;
const SLIDE_MS = 7000;

function rankTeams(teams) {
  const enriched = teams.map((t) => ({ ...t, diff: t.points_for - t.points_against }));
  enriched.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.diff !== b.diff) return b.diff - a.diff;
    return b.points_for - a.points_for;
  });
  return enriched.map((t, i) => ({ ...t, rank: i + 1 }));
}

export default function PreviewDisplayPage() {
  const { eventId, categoryId } = useParams();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [brackets, setBrackets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [bracketProgress, setBracketProgress] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, cats, bkts, live, bp] = await Promise.all([
        getEventById(eventId),
        listCategories(eventId),
        listBracketsForCategory(categoryId),
        listLiveMatchesForEvent(eventId),
        getBracketProgressForCategory(categoryId),
      ]);
      setEvent(ev);
      setCategory(cats.find((c) => c.id === categoryId) || null);
      setBrackets(bkts);
      setLiveMatches(live);
      setBracketProgress(bp);
      const [tms, mts] = await Promise.all([listTeamsForCategory(categoryId, bkts), listMatchesForCategory(categoryId)]);
      setTeams(tms);
      setMatches(mts);
    } catch {
      // Spectator display — fail silently and retry on the next poll rather
      // than showing an error screen to whoever is watching the monitor.
    } finally {
      setLoaded(true);
    }
  }, [eventId, categoryId]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const bracketLetterById = useMemo(() => new Map(brackets.map((b) => [b.id, b.letter])), [brackets]);

  const standingsByBracket = useMemo(() => {
    return brackets
      .map((b) => ({ bracket: b, ranked: rankTeams(teams.filter((t) => t.bracket_id === b.id)) }))
      .sort((a, b) => a.bracket.letter.localeCompare(b.bracket.letter));
  }, [brackets, teams]);

  const nextMatches = useMemo(() => matches.filter((m) => m.status === 'scheduled').slice(0, 3), [matches]);

  const recentWinners = useMemo(
    () =>
      matches
        .filter((m) => m.status === 'completed' && m.winner_team_id)
        .sort((a, b) => new Date(b.finished_at || b.created_at).getTime() - new Date(a.finished_at || a.created_at).getTime())
        .slice(0, 3),
    [matches]
  );

  const numCourts = event?.num_courts ?? 4;
  const courtsInPlay = liveMatches.length;

  // Matches run courts-at-a-time, not one after another, so the ETA divides
  // the category's remaining matches across all courts before multiplying
  // by the per-match duration. Scoped to the selected category only.
  const progress = useMemo(() => {
    const totalMatches = bracketProgress.reduce((sum, b) => sum + b.totalMatches, 0);
    const completed = bracketProgress.reduce((sum, b) => sum + b.completedCount, 0);
    const remaining = totalMatches - completed;
    const perMatchMinutes = category?.estimated_match_minutes || event?.match_duration_minutes || 18;
    const estimatedMinutes = Math.ceil(remaining / Math.max(1, numCourts)) * perMatchMinutes;
    return { totalMatches, completed, remaining, estimatedMinutes };
  }, [bracketProgress, category, event, numCourts]);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f0f1f4] text-sm font-medium text-ink-400">Loading preview…</div>;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f5f5f7] to-[#e7e8ec] p-4 sm:p-6 lg:p-8">
      <div className="sticky top-4 z-10 mb-6 rounded-3xl border border-white/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="font-display text-lg font-extrabold tracking-tight text-ink-900 sm:text-xl">{event?.name}</div>
            <div className="text-xs font-semibold text-ink-500 sm:text-sm">{category?.name}</div>
          </div>
          {progress.totalMatches > 0 && (
            <div className="text-right leading-tight">
              <div className="flex items-center justify-end gap-1.5 text-base font-extrabold text-ink-900 sm:text-lg">
                <Timer size={16} className="text-brand-500" />
                {progress.remaining > 0 ? `~${formatDuration(progress.estimatedMinutes)}` : 'Done'}
              </div>
              <div className="text-[10px] font-semibold text-ink-400">
                {progress.remaining > 0 ? `${progress.remaining} matches left` : 'All matches played'}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-ink-100/70 px-6 py-3.5">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-ink-400">
            <span>Courts</span>
            <span>
              {courtsInPlay}/{numCourts} in play
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: numCourts }, (_, i) => i + 1).map((c) => {
              const m = liveMatches.find((lm) => lm.court === c);
              return (
                <div
                  key={c}
                  className={`rounded-2xl px-3 py-2.5 transition ${
                    m ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-ink-50/70 ring-1 ring-ink-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold tracking-wide ${m ? 'text-emerald-700' : 'text-ink-400'}`}>
                      COURT {c}
                    </span>
                    {m && <Radio size={10} className="animate-pulse text-emerald-500" />}
                  </div>
                  {m ? (
                    <div className="mt-1 text-[11px] font-bold leading-snug text-ink-900">
                      <div className="truncate">{teamLabel(m.team_a)}</div>
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-500">vs</div>
                      <div className="truncate">{teamLabel(m.team_b)}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-ink-300">No match</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          {standingsByBracket.length === 0 ? (
            <div className="rounded-3xl border border-white/60 bg-white/70 p-10 text-center text-sm text-ink-400 shadow-sm backdrop-blur-xl">
              No brackets drawn yet for this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {standingsByBracket.map(({ bracket, ranked }) => (
                <div key={bracket.id} className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.05)] backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-ink-100/70 px-5 py-3.5">
                    <span className="font-display text-base font-extrabold text-ink-900">Bracket {bracket.letter}</span>
                    <span className="text-[11px] font-semibold text-ink-400">{ranked.length} teams</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                          <th className="px-4 py-2 text-center">#</th>
                          <th className="px-2 py-2 text-left">Team</th>
                          <th className="px-2 py-2 text-center">W</th>
                          <th className="px-2 py-2 text-center">L</th>
                          <th className="px-4 py-2 text-center">Diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {ranked.map((t) => (
                          <tr key={t.id} className={t.rank === 1 ? 'bg-amber-50/70' : ''}>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-extrabold ${
                                  t.rank === 1 ? 'bg-amber-400 text-amber-950' : 'bg-ink-100 text-ink-600'
                                }`}
                              >
                                {t.rank === 1 && <Crown size={11} />}
                                {t.rank}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 font-semibold text-ink-800">{teamLabel(t)}</td>
                            <td className="px-2 py-2.5 text-center font-mono">{t.wins}</td>
                            <td className="px-2 py-2.5 text-center font-mono">{t.losses}</td>
                            <td className={`px-4 py-2.5 text-center font-mono font-bold ${t.diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
                              {t.diff >= 0 ? `+${t.diff}` : t.diff}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.05)] backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ink-800">
              <Clock size={15} className="text-brand-500" /> Next Matches
            </div>
            <AutoCarousel
              items={nextMatches}
              intervalMs={SLIDE_MS}
              emptyMessage="No upcoming matches"
              renderItem={(m) => (
                <div className="flex flex-col items-center gap-1.5 py-1 text-center">
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                    {m.match_code} · Bracket {bracketLetterById.get(m.bracket_id)}
                  </span>
                  <div className="text-sm font-bold leading-snug text-ink-900">{teamLabel(m.team_a)}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-brand-400">vs</div>
                  <div className="text-sm font-bold leading-snug text-ink-900">{teamLabel(m.team_b)}</div>
                </div>
              )}
            />
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.05)] backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ink-800">
              <Trophy size={15} className="text-amber-500" /> Recent Winners
            </div>
            <AutoCarousel
              items={recentWinners}
              intervalMs={SLIDE_MS}
              emptyMessage="No results yet"
              renderItem={(m) => {
                const winnerIsA = m.winner_team_id === m.team_a_id;
                const winner = winnerIsA ? m.team_a : m.team_b;
                const loser = winnerIsA ? m.team_b : m.team_a;
                return (
                  <div className="flex flex-col items-center gap-1 py-1 text-center">
                    <Trophy size={18} className="text-amber-400" />
                    <div className="text-sm font-extrabold leading-snug text-ink-900">{teamLabel(winner)}</div>
                    <div className="text-[11px] text-ink-400">defeated {teamLabel(loser)}</div>
                    <div className="font-mono text-sm font-bold text-brand-600">
                      {m.score_a}–{m.score_b}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
