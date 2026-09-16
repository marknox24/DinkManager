import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Crown, Radio, Shuffle, Timer } from 'lucide-react';
import { getEventById, listCategories, listRegistrations } from '../../../data/eventsApi';
import {
  cancelLiveMatch,
  deleteBracketsForCategory,
  deleteMatch,
  finishMatch,
  generateBrackets,
  getBracketProgressForCategory,
  listBracketsForCategory,
  listLiveMatchesForEvent,
  listMatchesForBracket,
  listTeamsForBracket,
  pauseMatch,
  resumeMatch,
} from '../../../data/bracketsApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { useEventAccess } from '../../../context/EventAccessContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import RandomizerModal from '../../../components/organizer/RandomizerModal';
import LiveMatchCard from '../../../components/organizer/LiveMatchCard';
import { useNow } from '../../../hooks/useNow';
import { formatDuration } from '../../../utils/format';
import { liveElapsedSeconds, teamLabel } from '../../../utils/match';
import { rankTeams } from '../../../utils/standings';

// One collapsible section per drawn pool — standings + its own recent
// matches. Starting/logging matches now lives entirely on Match List, so
// this page is read-only: draw brackets, watch progress, see results.
// (Printable Round Robin score sheets also moved to Match List — see its
// header action — since a print run spans every pool bracket in a
// category, grouped by round, rather than one bracket at a time.)
function BracketSection({ bracket, progress, expanded, onToggle, teams, matches }) {
  const rankedTeams = useMemo(() => rankTeams(teams || []), [teams]);
  const loaded = !!teams;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-ink-50/60"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-extrabold text-brand-700">
            {bracket.letter}
          </span>
          <div>
            <div className="text-sm font-bold text-ink-900">Bracket {bracket.letter}</div>
            {progress && (
              <div className="text-xs text-ink-500">
                {progress.completedCount}/{progress.totalMatches} matches played
                {progress.remaining > 0 ? ` · ${progress.remaining} left` : ' · Complete'}
              </div>
            )}
          </div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="border-t border-ink-100">
          {!loaded ? (
            <div className="py-8 text-center text-sm text-ink-400">Loading…</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b-2 border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                      <th className="px-3 py-2.5 text-center">Rank</th>
                      <th className="px-3 py-2.5 text-left">Team</th>
                      <th className="px-3 py-2.5 text-left">Club</th>
                      <th className="px-3 py-2.5 text-center">W</th>
                      <th className="px-3 py-2.5 text-center">L</th>
                      <th className="px-3 py-2.5 text-center">RF</th>
                      <th className="px-3 py-2.5 text-center">RA</th>
                      <th className="px-3 py-2.5 text-center">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedTeams.map((t) => (
                      <tr key={t.id} className={`border-b border-ink-50 ${t.rank === 1 ? 'bg-amber-50/70' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-extrabold ${t.rank === 1 ? 'bg-amber-400 text-amber-950' : 'bg-ink-100 text-ink-600'}`}
                          >
                            {t.rank === 1 && <Crown size={11} />}
                            {t.rank}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-ink-800">{teamLabel(t)}</td>
                        <td className="px-3 py-2.5 text-ink-500">{t.club_name || '—'}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{t.wins}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{t.losses}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{t.points_for}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{t.points_against}</td>
                        <td className={`px-3 py-2.5 text-center font-mono font-bold ${t.diff >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
                          {t.diff >= 0 ? `+${t.diff}` : t.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {matches.length > 0 && (
                <div className="border-t border-ink-100 bg-ink-50/40 p-4">
                  <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-ink-700">
                    <Radio size={13} className="text-ink-400" /> Recent matches
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {matches.slice(0, 8).map((m) => {
                      const teamA = teams.find((t) => t.id === m.team_a_id);
                      const teamB = teams.find((t) => t.id === m.team_b_id);
                      return (
                        <div key={m.id} className="rounded-lg bg-white px-3 py-2 text-xs text-ink-600 ring-1 ring-ink-100">
                          <span className="font-semibold text-ink-800">{teamA ? teamLabel(teamA) : '—'}</span> vs{' '}
                          <span className="font-semibold text-ink-800">{teamB ? teamLabel(teamB) : '—'}</span> — {m.score_a}–{m.score_b}
                          {m.court ? ` · Court ${m.court}` : ''}
                          {m.umpire_name ? ` · ${m.umpire_name}` : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function BracketsPage() {
  const { eventId } = useParams();
  const { pushToast } = useToast();
  const confirm = useConfirm();
  const { can } = useEventAccess();
  const canRedraw = can('redraw_brackets');

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [brackets, setBrackets] = useState([]);
  const [bracketData, setBracketData] = useState({});
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [liveMatches, setLiveMatches] = useState([]);
  const [bracketProgress, setBracketProgress] = useState([]);
  const [randomizerOpen, setRandomizerOpen] = useState(false);
  const [loadingBrackets, setLoadingBrackets] = useState(false);

  const now = useNow(1000);

  useEffect(() => {
    Promise.all([getEventById(eventId), listCategories(eventId)])
      .then(([ev, cats]) => {
        setEvent(ev);
        setCategories(cats);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [eventId, pushToast]);

  const loadLiveMatches = useCallback(async () => {
    try {
      const live = await listLiveMatchesForEvent(eventId);
      setLiveMatches(live);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    loadLiveMatches();
  }, [loadLiveMatches]);

  const activeCategory = categories[activeCatIdx];

  const loadBrackets = useCallback(async () => {
    if (!activeCategory) return;
    setLoadingBrackets(true);
    try {
      const [bkts, regs] = await Promise.all([listBracketsForCategory(activeCategory.id), listRegistrations(eventId)]);
      // The knockout ladder (if any) lives in its own 'playoff' bracket and
      // is played out from Match List instead — see PlayoffStagesEditor /
      // MatchListPage's Playoffs panel. Only pool brackets show here.
      const poolBrackets = bkts.filter((b) => b.kind !== 'playoff');
      setBrackets(poolBrackets);
      setBracketData({});
      // All pools start expanded — the point of the accordion is to let the
      // organizer collapse the ones they don't need right now, not to hide
      // everything by default the way a brand-new category would.
      setExpandedIds(new Set(poolBrackets.map((b) => b.id)));
      setRegistrations(regs.filter((r) => r.category_id === activeCategory.id && r.status === 'approved'));
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setLoadingBrackets(false);
    }
  }, [activeCategory, eventId, pushToast]);

  useEffect(() => {
    loadBrackets();
  }, [loadBrackets]);

  const loadBracketProgress = useCallback(async () => {
    if (!activeCategory) {
      setBracketProgress([]);
      return;
    }
    try {
      const progress = await getBracketProgressForCategory(activeCategory.id);
      // This page only ever shows pool brackets (see loadBrackets above) —
      // exclude the playoff bracket here too, or its match counts silently
      // bleed into this page's "Category progress" ETA with no section to
      // explain the stray "Bracket PO" entry that appears alongside it.
      setBracketProgress(progress.filter((b) => b.kind !== 'playoff'));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [activeCategory, pushToast]);

  useEffect(() => {
    loadBracketProgress();
  }, [loadBracketProgress]);

  // Every pool's standings + recent matches load together (not lazily per
  // section) since all of them start expanded — staggering it in per
  // section would just mean each one flashes "Loading…" independently.
  const loadAllBracketDetails = useCallback(async () => {
    if (brackets.length === 0) return;
    try {
      const entries = await Promise.all(
        brackets.map(async (b) => {
          const [teams, matches] = await Promise.all([listTeamsForBracket(b.id), listMatchesForBracket(b.id)]);
          return [b.id, { teams, matches }];
        })
      );
      setBracketData(Object.fromEntries(entries));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [brackets, pushToast]);

  useEffect(() => {
    loadAllBracketDetails();
  }, [loadAllBracketDetails]);

  const toggleBracket = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Matches run numCourts-at-a-time, not one after another, so the ETA
  // divides the remaining count across all courts before multiplying by
  // the per-match duration.
  const numCourts = event?.num_courts ?? 4;
  const categoryProgress = useMemo(() => {
    const totalMatches = bracketProgress.reduce((sum, b) => sum + b.totalMatches, 0);
    const completed = bracketProgress.reduce((sum, b) => sum + b.completedCount, 0);
    const remaining = totalMatches - completed;
    const perMatchMinutes = activeCategory?.estimated_match_minutes || event?.match_duration_minutes || 18;
    const estimatedMinutes = Math.ceil(remaining / numCourts) * perMatchMinutes;
    return { totalMatches, completed, remaining, estimatedMinutes };
  }, [bracketProgress, activeCategory, event, numCourts]);

  const handleGenerate = async (grouping) => {
    try {
      if (brackets.length > 0) {
        await deleteBracketsForCategory(activeCategory.id);
      }
      await generateBrackets(activeCategory.id, grouping);
      pushToast('Brackets drawn', 'success');
      setRandomizerOpen(false);
      await Promise.all([loadBrackets(), loadLiveMatches(), loadBracketProgress()]);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleTogglePause = async (match) => {
    try {
      if (match.running_since) {
        await pauseMatch(match.id, liveElapsedSeconds(match, Date.now()));
      } else {
        await resumeMatch(match.id);
      }
      await loadLiveMatches();
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleCancelMatch = async (match) => {
    // A match with a match_code came from a generated match list — cancel
    // resets it to scheduled so its fixture/code isn't lost. An ad-hoc
    // match (no code) has no schedule slot to preserve, so it's deleted.
    const isFromMatchList = !!match.match_code;
    const ok = await confirm({
      title: 'Cancel this match?',
      message: isFromMatchList
        ? 'This match will be reset back to scheduled with no score recorded.'
        : 'The live match will be removed with no score recorded.',
      confirmLabel: 'Cancel match',
    });
    if (!ok) return;
    try {
      if (isFromMatchList) {
        await cancelLiveMatch(match.id);
      } else {
        await deleteMatch(match.id);
      }
      pushToast('Match canceled', 'success');
      await loadLiveMatches();
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleFinishMatch = async (match, sA, sB) => {
    const elapsedSeconds = liveElapsedSeconds(match, Date.now());
    await finishMatch(match.id, {
      score_a: sA,
      score_b: sB,
      winner_team_id: sA > sB ? match.team_a_id : match.team_b_id,
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
    });
    pushToast('Match recorded', 'success');
    await Promise.all([loadAllBracketDetails(), loadLiveMatches(), loadBracketProgress()]);
  };

  const handleRedrawClick = async () => {
    const ok = await confirm({
      title: `Redraw ${activeCategory?.name}?`,
      message: 'This category has already been drawn. Redrawing will erase the current brackets, teams and any recorded match results — including any Quarterfinals/Semifinals/Championship matches already generated — then draw fresh brackets.',
      confirmLabel: 'Redraw',
    });
    if (!ok) return;
    setRandomizerOpen(true);
  };

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Brackets</h1>
        <p className="text-sm text-ink-500">Draw brackets from approved players and track pool standings</p>
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-sm text-ink-400">
          Add categories in Edit event before drawing brackets.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setActiveCatIdx(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  i === activeCatIdx ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {liveMatches.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {liveMatches.map((m) => (
                <LiveMatchCard
                  key={m.id}
                  match={m}
                  now={now}
                  categoryName={m.category_name}
                  onTogglePause={handleTogglePause}
                  onCancel={handleCancelMatch}
                  onFinish={handleFinishMatch}
                />
              ))}
            </div>
          )}

          {loadingBrackets ? (
            <div className="py-10 text-center text-sm text-ink-400">Loading…</div>
          ) : brackets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
              <Shuffle size={22} className="mx-auto mb-2 text-ink-300" />
              <p className="text-sm font-semibold text-ink-700">No brackets drawn yet for {activeCategory?.name}</p>
              <p className="mt-1 text-xs text-ink-400">{registrations.length} approved {registrations.length === 1 ? 'team' : 'teams'} ready.</p>
              {canRedraw && (
                <button
                  onClick={() => setRandomizerOpen(true)}
                  disabled={registrations.length === 0}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                >
                  <Shuffle size={14} /> Run the randomizer
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-ink-800">Pools</h2>
                {canRedraw && (
                  <button
                    onClick={handleRedrawClick}
                    className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-bold text-ink-600 transition hover:bg-ink-100"
                  >
                    <Shuffle size={12} /> Redraw
                  </button>
                )}
              </div>

              {bracketProgress.length > 0 && (
                <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-ink-800">
                      <Timer size={14} className="text-ink-400" /> Category progress
                    </div>
                    <div className="text-xs font-semibold text-ink-600">
                      {categoryProgress.completed}/{categoryProgress.totalMatches} matches played · {categoryProgress.remaining} remaining
                      {categoryProgress.remaining > 0 &&
                        ` · ~${formatDuration(categoryProgress.estimatedMinutes)} left across ${numCourts} ${numCourts === 1 ? 'court' : 'courts'}`}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bracketProgress.map((b) => (
                      <span key={b.bracket_id} className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600 ring-1 ring-ink-200">
                        Bracket {b.letter}: {b.completedCount}/{b.totalMatches} · {b.remaining} left
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {brackets.map((b) => (
                  <BracketSection
                    key={b.id}
                    bracket={b}
                    progress={bracketProgress.find((p) => p.bracket_id === b.id)}
                    expanded={expandedIds.has(b.id)}
                    onToggle={() => toggleBracket(b.id)}
                    teams={bracketData[b.id]?.teams}
                    matches={bracketData[b.id]?.matches || []}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {randomizerOpen && activeCategory && (
        <RandomizerModal
          category={activeCategory}
          registrations={registrations}
          hasExistingBrackets={brackets.length > 0}
          allowSameClub={!!event.randomizer_allow_same_club}
          onConfirm={handleGenerate}
          onClose={() => setRandomizerOpen(false)}
        />
      )}

    </EventWorkspaceLayout>
  );
}
